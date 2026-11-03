import { creativeCommons, customLicense, license, parseLicense } from "../core/licence.js";
import type { ImageAsset, ImageDetails, ImageFile, ImageQuery, License, Provider, SourceCensus } from "../core/types.js";
import { HttpError } from "../core/http.js";
import { cleanText, formatFromFilename, makeImage, qs } from "../core/util.js";

/**
 * Openverse (openverse.org, run by WordPress): one index over about 800M
 * openly licensed images from Flickr, Wikimedia Commons, museums (the Met,
 * Smithsonian, Cleveland, Rijksmuseum…), StockSnap, Rawpixel's public domain
 * set and more. Searched through the official keyless API at
 * api.openverse.org/v1/images/.
 *
 * - Search: `/v1/images/?q=…&page_size=…&page=…` returns title, licence and
 *   version, creator, source, pixel size, file type and tags per item, plus a
 *   thumbnail that Openverse itself serves (`/v1/images/<id>/thumb/`, about
 *   600 px). The full image (`url`) is on the source's own CDN
 *   (live.staticflickr.com, upload.wikimedia.org…).
 * - Details: `/v1/images/<id>/` (one request), the same fields.
 *
 * Native filters: `license_type=commercial` (CC0, PDM, BY, BY-SA),
 * `aspect_ratio=wide|tall|square`, `size=large` (Openverse's "large" is
 * roughly over 1000 px on the long side) and `extension=jpg,png,svg…`.
 *
 * Limits (headers seen on 2026-11-03): anonymous clients get
 * `anon_burst 20/min` and `anon_sustained 200/day`, `page_size` at most 20
 * and at most 240 results deep. Responses take 7–40 s from a cloud IP and
 * sometimes 504; every answer is cached for an hour, and after a 429 the
 * source pauses until the quota resets instead of retrying. An optional registered app (`OPENVERSE_CLIENT_ID` +
 * `OPENVERSE_CLIENT_SECRET`, from POST /v1/auth_tokens/register/) raises the
 * limits; the token is fetched with client credentials and reused until it
 * expires.
 *
 * Licence: Openverse states the CC licence per image as recorded by the
 * source (Flickr uploaders choose it themselves: `assertedBy: "uploader"`,
 * capped at check-terms; museums and Commons record it per file).
 *
 * It is an aggregator, so it is listed after Wikimedia Commons and the
 * museums: a Commons file found here too gets `sameAs` its Commons id, and
 * de-duplication keeps the Commons copy. Its census is marked `mirror`.
 */

const SITE = "https://openverse.org";
const API = "https://api.openverse.org/v1";
const SOURCE_NAME = "Openverse";
const MAX_PAGE_SIZE = 20;
const MAX_DEPTH = 240;
const TIMEOUT_MS = 20_000;

export interface OpenverseImage {
  id: string;
  title?: string | null;
  foreign_landing_url?: string | null;
  url?: string | null;
  creator?: string | null;
  creator_url?: string | null;
  license?: string | null;
  license_version?: string | null;
  license_url?: string | null;
  provider?: string | null;
  source?: string | null;
  category?: string | null;
  filesize?: number | null;
  filetype?: string | null;
  tags?: { name: string }[] | null;
  attribution?: string | null;
  mature?: boolean;
  height?: number | null;
  width?: number | null;
  thumbnail?: string | null;
  detail_url?: string | null;
  indexed_on?: string | null;
}

interface OpenverseSearch {
  result_count?: number;
  page_count?: number;
  results?: OpenverseImage[];
}

/** "cc0", "pdm", "by-sa" + "4.0" → a License. */
export function licenseOf(img: Pick<OpenverseImage, "license" | "license_version" | "license_url" | "source">): License {
  const code = (img.license ?? "").toLowerCase();
  // Flickr licences are chosen by the uploader; Commons ones are reviewed by the community, so trust Commons.
  const assertedBy: License["assertedBy"] = img.source === "flickr" ? "uploader" : "source";
  if (code === "cc0") return license("CC0-1.0", assertedBy);
  if (code === "pdm") return license("CC-PDM-1.0", assertedBy);
  if (code.startsWith("by")) {
    const parts = code.split("-");
    return creativeCommons({ nc: parts.includes("nc"), nd: parts.includes("nd"), sa: parts.includes("sa") }, img.license_version || "4.0", assertedBy);
  }
  return parseLicense(img.license_url, assertedBy) ?? customLicense(img.license || "Unknown licence", { url: img.license_url ?? undefined, assertedBy });
}

/** The Commons file name ("Cape_hatteras_lighthouse.jpg") of an upload.wikimedia.org URL. */
export function commonsFileOf(url: string | null | undefined): string | undefined {
  const m = /^https?:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/?#]+)/i.exec(url ?? "");
  return m ? decodeURIComponent(m[1]!) : undefined;
}

function filetypeOf(img: OpenverseImage): string | undefined {
  const t = (img.filetype ?? "").toLowerCase();
  if (t) return t === "jpeg" ? "jpg" : t === "tiff" ? "tif" : t;
  const f = img.url ? formatFromFilename(img.url) : "";
  return f && f.length <= 4 ? f : undefined;
}

export function toImage(img: OpenverseImage): ImageDetails | undefined {
  if (!img.id || !img.url) return undefined;
  const format = filetypeOf(img);
  const source = img.source ?? img.provider ?? undefined;
  const commonsFile = source === "wikimedia" ? commonsFileOf(img.url) : undefined;
  const width = img.width ?? undefined;
  const height = img.height ?? undefined;
  const thumb = img.thumbnail ?? `${API}/images/${img.id}/thumb/`;
  const files: ImageFile[] = [
    {
      url: img.url,
      filename: decodeURIComponent(img.url.split(/[?#]/)[0]!.split("/").pop() || `${img.id}.${format ?? "jpg"}`),
      format: format ?? "jpg",
      role: "original",
      width,
      height,
      sizeBytes: img.filesize ?? undefined,
    },
    { url: thumb, filename: `${img.id}-thumb.jpg`, format: "jpg", role: "thumbnail" },
  ];
  const image = makeImage({
    provider: "openverse",
    nativeId: img.id,
    title: cleanText(img.title) || "Untitled",
    url: img.foreign_landing_url || `${SITE}/image/${img.id}`,
    author: cleanText(img.creator) || undefined,
    authorUrl: img.creator_url ?? undefined,
    tags: (img.tags ?? []).map((t) => t.name).filter(Boolean).slice(0, 30),
    sourceCategories: source ? [source] : undefined,
    // Openverse's own category is photograph / illustration / digitized_artwork.
    styles: img.category === "photograph" ? ["photo"] : img.category === "illustration" ? ["illustration"] : undefined,
    vector: format === "svg" || undefined,
    width,
    height,
    thumbnailUrl: thumb,
    // The source file is the largest Openverse knows; Flickr's "_b" URLs are 1024 px, a good preview size.
    previewUrl: format === "svg" || source === "flickr" ? img.url : thumb,
    formats: format ? [format] : undefined,
    license: licenseOf(img),
    price: { free: true },
    downloadable: true,
    createdAt: img.indexed_on ?? undefined,
    sameAs: commonsFile ? [`wikimediacommons:${commonsFile.replace(/ /g, "_")}`] : undefined,
    sourceName: source ? `${SOURCE_NAME} / ${source}` : SOURCE_NAME,
  });
  return { ...image, files };
}

/** The API's native filters for a query. */
export function searchParams(q: ImageQuery): Record<string, string | number | undefined> {
  const o = q.orientations?.length === 1 ? q.orientations[0] : undefined;
  const ext = q.formats?.length ? q.formats.map((f) => (f === "tif" ? "tiff" : f)).join(",") : undefined;
  return {
    q: q.query.trim() || undefined,
    license_type: q.commercialOnly ? "commercial" : undefined,
    aspect_ratio: o === "landscape" ? "wide" : o === "portrait" ? "tall" : o === "square" ? "square" : undefined,
    size: q.minResolution && q.minResolution >= 1080 ? "large" : undefined,
    extension: ext,
    category: q.styles?.length === 1 && q.styles[0] === "photo" ? "photograph" : q.styles?.length === 1 && q.styles[0] === "illustration" ? "illustration" : undefined,
    mature: "false",
  };
}

interface Token {
  value: string;
  expires: number;
}
let token: Token | undefined;

async function authHeaders(ctx: Parameters<Provider["search"]>[1]): Promise<Record<string, string>> {
  const id = process.env.OPENVERSE_CLIENT_ID;
  const secret = process.env.OPENVERSE_CLIENT_SECRET;
  if (!id || !secret) return {};
  if (!token || token.expires < Date.now() + 60_000) {
    const res = await ctx.fetch.json<{ access_token: string; expires_in: number }>(`${API}/auth_tokens/token/`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: id, client_secret: secret }).toString(),
      cacheTtlMs: 0,
      signal: ctx.signal,
    });
    token = { value: res.access_token, expires: Date.now() + res.expires_in * 1000 };
  }
  return { authorization: `Bearer ${token.value}` };
}

export const openverse: Provider = {
  id: "openverse",
  name: SOURCE_NAME,
  homepage: SITE,
  description:
    "About 800M openly licensed images in one index: Flickr, Wikimedia Commons, museums and free stock sites. CC0, public domain and every CC licence, stated per image.",
  categories: ["nature", "animals", "city", "architecture", "people", "food", "objects", "tech", "transport", "space", "science", "art", "archive", "background"],
  access: "api",
  pricing: "free",
  supportsDownload: true,
  nativeFilters: ["orientation", "formats", "commercialOnly", "freeOnly"],

  buildSearchUrl(q) {
    const p = searchParams(q);
    return `${SITE}/search/image${qs({ q: p.q as string | undefined, license_type: p.license_type as string | undefined, aspect_ratio: p.aspect_ratio as string | undefined, size: p.size as string | undefined, extension: p.extension as string | undefined })}`;
  },

  async search(q, ctx) {
    const pageSize = Math.max(1, Math.min(q.limit, MAX_PAGE_SIZE));
    const offset = q.offset ?? 0;
    if (offset >= MAX_DEPTH) return { images: [], total: MAX_DEPTH, searchUrl: this.buildSearchUrl(q) };
    const page = Math.floor(offset / pageSize) + 1;
    const url = `${API}/images/${qs({ ...searchParams(q), page_size: pageSize, page: page > 1 ? page : undefined })}`;
    const res = await guarded(async () => ctx.fetch.json<OpenverseSearch>(url, { headers: await authHeaders(ctx), cacheTtlMs: 60 * 60_000, timeoutMs: TIMEOUT_MS, signal: ctx.signal }));
    const images: ImageAsset[] = [];
    for (const r of res.results ?? []) {
      if (r.mature) continue;
      const d = toImage(r);
      if (!d) continue;
      const { files: _files, ...image } = d;
      images.push(image);
    }
    return { images, total: res.result_count, searchUrl: this.buildSearchUrl(q) };
  },

  async getImage(nativeId, ctx) {
    if (!/^[0-9a-f-]{36}$/i.test(nativeId)) return null;
    const res = await guarded(async () => ctx.fetch.json<OpenverseImage>(`${API}/images/${nativeId}/`, { headers: await authHeaders(ctx), cacheTtlMs: 24 * 60 * 60_000, timeoutMs: TIMEOUT_MS, signal: ctx.signal }));
    return toImage(res) ?? null;
  },

  async census(ctx): Promise<SourceCensus> {
    // Anonymous result counts are capped at 240 per query, so the catalogue size comes from the stats endpoint.
    const stats = await ctx.fetch.json<{ source_name: string; display_name?: string; media_count: number }[]>(`${API}/images/stats/`, {
      signal: ctx.signal,
      cacheTtlMs: 0,
      timeoutMs: TIMEOUT_MS * 2,
    });
    const categories: Record<string, number> = {};
    let total = 0;
    for (const s of stats) {
      total += s.media_count;
      categories[s.display_name || s.source_name] = s.media_count;
    }
    return {
      total,
      free: total,
      byCategory: {},
      categories,
      method: "api.openverse.org /v1/images/stats/: media_count per source, summed",
      mirror: true,
    };
  },
};

/**
 * After a 429, stop asking until the quota resets (Retry-After, else the next
 * UTC midnight for the daily quota), so a busy server doesn't keep hitting
 * Openverse while it is out of requests. Searches fail fast meanwhile and the
 * source shows as "error" with the reason.
 */
let blockedUntil = 0;

async function guarded<T>(run: () => Promise<T>): Promise<T> {
  if (Date.now() < blockedUntil) {
    throw new Error(`Openverse rate limit reached; paused until ${new Date(blockedUntil).toISOString()} (set OPENVERSE_CLIENT_ID and OPENVERSE_CLIENT_SECRET for a higher limit)`);
  }
  try {
    return await run();
  } catch (e) {
    if (e instanceof HttpError && e.status === 429) {
      const midnight = new Date();
      midnight.setUTCHours(24, 0, 0, 0);
      blockedUntil = e.retryAfterSec ? Date.now() + e.retryAfterSec * 1000 : midnight.getTime();
    }
    throw e;
  }
}

/** For tests: forget a cached OAuth token and any rate-limit pause. */
export function resetOpenverseToken(): void {
  token = undefined;
  blockedUntil = 0;
}
