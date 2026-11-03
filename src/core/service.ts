import { createHttpClient } from "./http.js";
import { COMMERCIAL_SAFE } from "./licence.js";
import { parseQuery } from "./query.js";
import type {
  ImageAsset,
  ImageDetails,
  ImageFilters,
  ImageQuery,
  HttpClient,
  NativeFilter,
  Provider,
  ProviderContext,
  ProviderInfo,
} from "./types.js";
import { matchScore, parseImageId } from "./util.js";
import { categoryMatches, shortSide, type Category } from "./vocab.js";

export interface SearchRequest extends ImageFilters {
  query: string;
  /** Restrict to these provider ids. */
  providers?: string[];
  /** Only return images this server can hand out direct file URLs for. */
  downloadableOnly?: boolean;
  /**
   * Drop images whose orientation, size or transparency is unknown when that
   * filter is set. Default false: unknown values stay in the list, ranked
   * below known matches.
   */
  strict?: boolean;
  /** Parse "4k", "vertical", "png", "transparent" out of `query` into filters (default true). */
  parse?: boolean;
  /** Total results to return across providers. */
  limit?: number;
  /** Per-provider result offset (for paging deeper into every source). */
  offset?: number;
  /** Per-provider timeout. */
  timeoutMs?: number;
  /** Per-request credentials, passed to providers only. */
  credentials?: Record<string, string>;
}

export type ProviderStatus = "ok" | "error" | "timeout" | "skipped" | "link";

export interface ProviderSearchReport {
  provider: string;
  name: string;
  status: ProviderStatus;
  count: number;
  total?: number;
  searchUrl?: string;
  error?: string;
  /** Filters this source could not apply itself (we applied them to what it returned). */
  filteredLocally?: NativeFilter[];
  tookMs: number;
}

export interface SearchResponse {
  query: string;
  /** The filters in force after parsing the query. */
  filters: ImageFilters;
  results: ImageAsset[];
  providers: ProviderSearchReport[];
}

export interface ImageServiceOptions {
  providers: Provider[];
  http?: HttpClient;
  defaultTimeoutMs?: number;
}

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

/** Small boost for sources whose metadata and files we trust most. */
const ACCESS_WEIGHT = { api: 1, static: 0.9, scrape: 0.8, link: 0 } as const;

export class ImageService {
  readonly http: HttpClient;
  private readonly providers = new Map<string, Provider>();
  private readonly defaultTimeoutMs: number;

  constructor(opts: ImageServiceOptions) {
    this.http = opts.http ?? createHttpClient();
    this.defaultTimeoutMs = opts.defaultTimeoutMs ?? Number(process.env.IMAGE_SERVER_PROVIDER_TIMEOUT_MS ?? 12_000);
    for (const p of opts.providers) this.providers.set(p.id, p);
  }

  listProviders(): (ProviderInfo & { enabled: boolean })[] {
    return [...this.providers.values()].map((p) => ({
      id: p.id,
      name: p.name,
      homepage: p.homepage,
      description: p.description,
      categories: p.categories,
      access: p.access,
      pricing: p.pricing,
      license: p.license,
      apiKeyEnv: p.apiKeyEnv,
      supportsDownload: p.supportsDownload,
      nativeFilters: p.nativeFilters,
      enabled: p.isEnabled?.() ?? true,
    }));
  }

  getProvider(id: string): Provider | undefined {
    return this.providers.get(id);
  }

  async search(req: SearchRequest): Promise<SearchResponse> {
    const limit = Math.min(Math.max(req.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const timeoutMs = req.timeoutMs ?? this.defaultTimeoutMs;
    const wanted = req.providers?.length ? new Set(req.providers) : undefined;
    const unknown = req.providers?.filter((p) => !this.providers.has(p)) ?? [];
    if (unknown.length) throw new UnknownProviderError(unknown);

    const parsed = req.parse === false ? { query: req.query.trim(), hints: [] as Category[] } : parseQuery(req.query);
    const p = parsed as Partial<ImageFilters>;
    // Explicit filters win over words parsed from the query.
    const filters: ImageFilters = dropUndefined({
      categories: req.categories?.length ? req.categories : undefined,
      styles: req.styles?.length ? req.styles : p.styles,
      orientations: req.orientations?.length ? req.orientations : p.orientations,
      minResolution: req.minResolution ?? p.minResolution,
      transparent: req.transparent ?? p.transparent,
      formats: req.formats?.length ? req.formats : p.formats,
      commercialOnly: req.commercialOnly || undefined,
      freeOnly: req.freeOnly || undefined,
    });

    // Ask each source for a full page so the merged ranking has enough to choose from.
    const perProvider = Math.min(limit, 50);
    const q: ImageQuery = { ...filters, query: parsed.query, hints: parsed.hints, limit: perProvider, offset: req.offset };

    const reports: ProviderSearchReport[] = [];
    const ranked: { image: ImageAsset; rank: number; provider: Provider }[] = [];

    await Promise.all(
      [...this.providers.values()].map(async (prov) => {
        const started = Date.now();
        const base = { provider: prov.id, name: prov.name, count: 0 };
        const skip = (reason: string): void => {
          reports.push({ ...base, status: "skipped", error: reason, tookMs: 0 });
        };
        if (wanted && !wanted.has(prov.id)) return;
        if (prov.isEnabled && !prov.isEnabled()) return skip(`disabled (set ${prov.apiKeyEnv ?? "its API key"})`);
        if (filters.categories && !filters.categories.some((c) => prov.categories.some((pc) => categoryMatches(c, [pc]) || categoryMatches(pc, [c]))))
          return skip("does not carry the requested categories");
        if (req.downloadableOnly && !prov.supportsDownload) return skip("no direct downloads");
        if (filters.freeOnly && prov.pricing === "paid") return skip("paid only");
        if (filters.commercialOnly && prov.license && !COMMERCIAL_SAFE.has(prov.license.verdict))
          return skip(`licence is ${prov.license.verdict === "no" ? "non-commercial" : prov.license.verdict}`);

        const searchUrl = prov.buildSearchUrl(q);
        const signal = AbortSignal.timeout(timeoutMs);
        const ctx: ProviderContext = { fetch: this.http, signal, credentials: req.credentials };
        try {
          const res = await withTimeout(prov.search(q, ctx), timeoutMs, signal);
          const local = localFilters(filters, prov.nativeFilters);
          let images = res.images.filter((c) => passes(c, filters, req));
          if (req.downloadableOnly) images = images.filter((c) => c.downloadable);
          images.forEach((image, rank) => ranked.push({ image, rank, provider: prov }));
          reports.push({
            ...base,
            status: prov.access === "link" ? "link" : "ok",
            count: images.length,
            total: res.total,
            searchUrl: res.searchUrl ?? searchUrl,
            ...(local.length && prov.access !== "link" ? { filteredLocally: local } : {}),
            tookMs: Date.now() - started,
          });
        } catch (e) {
          const timedOut = signal.aborted || e instanceof TimeoutError;
          reports.push({
            ...base,
            status: timedOut ? "timeout" : "error",
            error: timedOut ? `timed out after ${timeoutMs}ms` : errorMessage(e),
            searchUrl,
            tookMs: Date.now() - started,
          });
        }
      }),
    );

    const order = [...this.providers.keys()];
    const results = rankResults(dedupe(ranked, order), q).slice(0, limit);
    reports.sort((a, b) => order.indexOf(a.provider) - order.indexOf(b.provider));
    return { query: q.query, filters, results, providers: reports };
  }

  async getImage(id: string, credentials?: Record<string, string>): Promise<ImageDetails | null> {
    const parsed = parseImageId(id);
    if (!parsed) throw new InvalidImageIdError(id);
    const p = this.providers.get(parsed.provider);
    if (!p) throw new UnknownProviderError([parsed.provider]);
    if (!p.getImage) throw new UnsupportedError(`${p.name} does not support image details; open the source site instead.`);
    const signal = AbortSignal.timeout(this.defaultTimeoutMs * 2);
    return p.getImage(parsed.nativeId, { fetch: this.http, signal, credentials });
  }
}

function dropUndefined<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

const FILTER_KEYS: [NativeFilter, (f: ImageFilters) => boolean][] = [
  ["categories", (f) => !!f.categories],
  ["styles", (f) => !!f.styles],
  ["orientation", (f) => !!f.orientations],
  ["resolution", (f) => f.minResolution !== undefined],
  ["transparent", (f) => f.transparent !== undefined],
  ["formats", (f) => !!f.formats?.length],
  ["commercialOnly", (f) => !!f.commercialOnly],
  ["freeOnly", (f) => !!f.freeOnly],
];

function localFilters(f: ImageFilters, native: NativeFilter[] = []): NativeFilter[] {
  return FILTER_KEYS.filter(([k, active]) => active(f) && !native.includes(k)).map(([k]) => k);
}

/** 3% slack: a 1920×1050 master still counts as 1080p. */
const RESOLUTION_SLACK = 0.97;

/**
 * Apply the filters to one image. Known mismatches always go; unknown
 * orientation, size or transparency only go in strict mode. Vectors pass any
 * size. Category and licence are always known (the classifier fills
 * category; no licence fails commercialOnly). Styles are a soft filter for
 * what sources rarely state: an image without a matching style is dropped
 * only in strict mode, unless the style is "vector" or "icon", which sources
 * always state.
 */
export function passes(c: ImageAsset, f: ImageFilters, opts: { strict?: boolean } = {}): boolean {
  const strict = !!opts.strict;
  if (f.categories && !categoryMatches(c.category, f.categories)) return false;
  if (f.styles) {
    const has = f.styles.some((s) => c.styles?.includes(s));
    const hard = f.styles.every((s) => s === "vector" || s === "icon");
    if (!has && (strict || hard)) return false;
  }
  if (f.orientations) {
    if (c.orientation ? !f.orientations.includes(c.orientation) : strict) return false;
  }
  if (f.minResolution !== undefined && !c.vector) {
    const s = shortSide(c.width, c.height);
    if (s !== undefined ? s < f.minResolution * RESOLUTION_SLACK : strict) return false;
  }
  if (f.transparent) {
    if (c.transparent === undefined ? strict : !c.transparent) return false;
  }
  if (f.formats?.length) {
    if (c.formats?.length ? !f.formats.some((x) => c.formats!.includes(x)) : strict) return false;
  }
  if (f.commercialOnly && !(c.license && COMMERCIAL_SAFE.has(c.license.verdict))) return false;
  if (f.freeOnly && c.price?.free === false) return false;
  return true;
}

/**
 * The same image reached through two sources (a NASA photo also uploaded to
 * Wikimedia Commons): keep the copy from the source listed first. Matching is
 * by `sameAs` ids and by identical page or preview URLs.
 */
export function dedupe<T extends { image: ImageAsset; provider: Pick<Provider, "id"> }>(items: T[], order: string[]): T[] {
  const byPriority = [...items].sort((a, b) => order.indexOf(a.provider.id) - order.indexOf(b.provider.id));
  const seen = new Set<string>();
  const keep = new Set<T>();
  for (const it of byPriority) {
    const keys = [it.image.id, ...(it.image.sameAs ?? []), `url:${normUrl(it.image.url)}`];
    if (it.image.previewUrl) keys.push(`url:${normUrl(it.image.previewUrl)}`);
    if (it.image.thumbnailUrl) keys.push(`url:${normUrl(it.image.thumbnailUrl)}`);
    if (keys.some((k) => seen.has(k))) continue;
    keys.forEach((k) => seen.add(k));
    keep.add(it);
  }
  return items.filter((it) => keep.has(it));
}

function normUrl(u: string): string {
  return u.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "").toLowerCase();
}

/**
 * Merge per-provider results into one list.
 * Score = text relevance (dominant) + the source's own ranking + how well the
 * known image facts fit what was asked (category hint, orientation,
 * size, transparency, format, style) + small boosts for commercial-safe, free,
 * downloadable and watchable (has a preview) images, then a diversity penalty
 * so one large catalogue can't fill the whole first page.
 */
export function rankResults(
  items: { image: ImageAsset; rank: number; provider: Pick<Provider, "id" | "access"> }[],
  q: Pick<ImageQuery, "query" | "hints" | "categories" | "orientations" | "minResolution" | "transparent" | "formats" | "styles">,
): ImageAsset[] {
  const scored = items.map(({ image, rank, provider }) => {
    const relevance = matchScore({ ...image, tags: [...image.tags, image.category.replace(/\./g, " ")] }, q.query);
    const sourceRank = 1 / (1 + rank * 0.15);
    const score =
      0.5 * relevance +
      0.15 * sourceRank +
      0.08 * ACCESS_WEIGHT[provider.access] +
      0.15 * imageFit(image, q) +
      0.04 * (image.license && COMMERCIAL_SAFE.has(image.license.verdict) ? 1 : 0) +
      0.02 * (image.price?.free !== false ? 1 : 0) +
      0.03 * (image.downloadable ? 1 : 0) +
      0.03 * (image.thumbnailUrl || image.previewUrl ? 1 : 0);
    return { image, provider: provider.id, score };
  });
  scored.sort((a, b) => b.score - a.score);

  const seenPerProvider = new Map<string, number>();
  const diversified = scored.map((s) => {
    const n = seenPerProvider.get(s.provider) ?? 0;
    seenPerProvider.set(s.provider, n + 1);
    return { ...s, score: s.score * Math.pow(0.93, n) };
  });
  diversified.sort((a, b) => b.score - a.score);
  return diversified.map((s) => ({ ...s.image, score: round(s.score) }));
}

/** 0..1: how well the known image facts fit what was asked. Unknowns score less than a match. */
function imageFit(c: ImageAsset, q: Pick<ImageQuery, "hints" | "categories" | "orientations" | "minResolution" | "transparent" | "formats" | "styles">): number {
  const parts: number[] = [];
  const hints = q.categories?.length ? q.categories : q.hints;
  if (hints?.length) {
    const exact = hints.some((h) => c.category === h || c.category.startsWith(`${h}.`));
    const conf = c.categoryEvidence?.confidence ?? 0.5;
    parts.push(exact ? 0.5 + 0.5 * conf : 0);
  }
  if (q.orientations) parts.push(c.orientation === undefined ? 0.4 : 1);
  if (q.minResolution !== undefined) parts.push(c.vector ? 1 : c.width === undefined ? 0.4 : 1);
  if (q.transparent) parts.push(c.transparent ? 1 : 0.3);
  if (q.formats?.length) parts.push(c.formats?.some((f) => q.formats!.includes(f)) ? 1 : 0.4);
  if (q.styles) parts.push(q.styles.some((s) => c.styles?.includes(s)) ? 1 : 0.3);
  if (!parts.length) return 0.5;
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

class TimeoutError extends Error {}

function withTimeout<T>(p: Promise<T>, ms: number, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new TimeoutError(`timed out after ${ms}ms`));
    if (signal.aborted) return onAbort();
    signal.addEventListener("abort", onAbort, { once: true });
    p.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export class UnknownProviderError extends Error {
  constructor(readonly ids: string[]) {
    super(`Unknown provider(s): ${ids.join(", ")}`);
    this.name = "UnknownProviderError";
  }
}

export class InvalidImageIdError extends Error {
  constructor(id: string) {
    super(`Invalid image id "${id}". Expected "<provider>:<id>", e.g. "nasa:PIA12348".`);
    this.name = "InvalidImageIdError";
  }
}

export class UnsupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedError";
  }
}
