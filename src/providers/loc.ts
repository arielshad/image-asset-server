import { pauseOnRefusal } from "./pause.js";
import { customLicense, license } from "../core/licence.js";
import type { ImageAsset, ImageDetails, ImageFile, License, Provider, SourceCensus } from "../core/types.js";
import type { ImageStyle } from "../core/vocab.js";
import { cleanText, makeImage, qs } from "../core/util.js";

/**
 * Library of Congress, Prints & Photographs (loc.gov/photos): about 1.1M
 * digitised photos, prints, drawings, posters and maps that are viewable
 * online, through the keyless loc.gov JSON API (`fo=json`).
 *
 * - Search: `/photos/?q=…&fo=json&c=<per page>&sp=<page>&fa=access-restricted:false`,
 *   one request. Each item carries title, date, subjects, contributors, the
 *   rights advisory and a few image URLs whose size is in the fragment
 *   (`…_150px.jpg#h=150&w=112`, `…r.jpg#h=420&w=314`, `…v.jpg#h=557&w=1024`).
 *   `access-restricted:false` drops items that are only shown as thumbnails
 *   off-site.
 * - Details: `/item/<id>/?fo=json&at=item,resources` lists every file of the
 *   item, up to the master TIFF.
 *
 * Licence: the Library states a rights advisory per item, not a licence.
 * "No known restrictions on publication" → usable (`yes`). Everything else
 * ("Rights status not evaluated", "Publication may be restricted") is
 * check-terms with the advisory as the note.
 *
 * The API asks for no more than about 20 requests a minute on search
 * (it answers 429 beyond that); results are cached for an hour.
 */

const SITE = "https://www.loc.gov";
const SOURCE_NAME = "Library of Congress";
const MAX_PAGE_SIZE = 50;

export interface LocResult {
  id?: string;
  url?: string;
  title?: string;
  date?: string;
  dates?: string[];
  description?: string[];
  subject?: string[];
  contributor?: string[];
  original_format?: string[];
  image_url?: string[];
  access_restricted?: boolean;
  item?: {
    rights_advisory?: string;
    creators?: { title?: string; role?: string }[] | null;
    medium_brief?: string;
    genre?: string[];
    title?: string;
  };
}

interface LocSearch {
  pagination?: { of?: number; total?: number };
  results?: LocResult[];
}

interface LocFile {
  url?: string;
  mimetype?: string;
  width?: number;
  height?: number;
  size?: number;
}

interface LocItem {
  item?: LocResult["item"] & { subjects?: Record<string, string>[]; date?: string; created_published?: string[] | string };
  resources?: { files?: LocFile[][]; image?: string; url?: string }[];
}

/** `https://tile.loc.gov/…/09074r.jpg#h=420&w=314` → url and size. */
export function sizedUrl(u: string): { url: string; width?: number; height?: number } {
  const [url, frag] = u.split("#");
  const p = new URLSearchParams(frag ?? "");
  return { url: url!, width: Number(p.get("w")) || undefined, height: Number(p.get("h")) || undefined };
}

export function licenseOf(advisory: string | undefined): License {
  const text = cleanText(advisory);
  if (/no known restrictions/i.test(text)) return license("LicenseRef-No-Known-Restrictions");
  return customLicense(text ? "Rights advisory (Library of Congress)" : "Rights not stated", {
    url: "https://www.loc.gov/rr/print/195_copr.html",
    verdict: "check-terms",
    assertedBy: "source",
    note: text || "The Library states no rights advisory for this item; check its page.",
  });
}

export function stylesOf(r: Pick<LocResult, "subject" | "original_format"> & { genre?: string[] }): ImageStyle[] | undefined {
  const words = [...(r.subject ?? []), ...(r.genre ?? [])].join(" ").toLowerCase();
  if (/photograph|negative|daguerreotype|lantern slide|stereograph/.test(words)) return ["photo"];
  if (/drawing|sketch|watercolor/.test(words)) return ["drawing"];
  if (/print|lithograph|engraving|etching|woodcut|poster/.test(words)) return ["drawing"];
  return undefined;
}

/** "http://www.loc.gov/item/2016645615/" → "2016645615". */
export function locId(url: string | undefined): string | undefined {
  return /\/item\/([^/?#]+)/.exec(url ?? "")?.[1];
}

function yearOf(r: LocResult): number | undefined {
  const y = Number(/^(\d{4})/.exec(r.date ?? r.dates?.[0] ?? "")?.[1]);
  return y > 1000 && y <= new Date().getFullYear() ? y : undefined;
}

function authorOf(r: LocResult): string | undefined {
  const c = r.item?.creators?.[0]?.title ?? r.contributor?.[0];
  // "Queen, James Fuller, 1820 or 1821-1886" → "James Fuller Queen".
  if (!c) return undefined;
  const parts = c.split(",").map((s) => s.trim());
  return parts.length >= 2 && !/\d/.test(parts[1]!) ? `${parts[1]} ${parts[0]}` : parts[0];
}

export function toImage(r: LocResult, files?: ImageFile[]): ImageDetails | undefined {
  const id = locId(r.url ?? r.id);
  if (!id || r.access_restricted) return undefined;
  const urls = (r.image_url ?? []).filter((u) => !/\.gif(#|$)/.test(u)).map(sizedUrl);
  if (!urls.length) return undefined;
  const bySize = [...urls].sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  const thumb = bySize.find((u) => (u.width ?? 0) >= 140) ?? bySize[0]!;
  const preview = bySize[bySize.length - 1]!;
  const list: ImageFile[] = files ?? bySize.map((u, i) => ({ url: u.url, filename: u.url.split("/").pop()!, format: "jpg", role: i === 0 ? "thumbnail" : "rendition", width: u.width, height: u.height }));
  const biggest = [...list].filter((f) => f.width).sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0] ?? preview;
  const genre = r.item?.genre ?? [];
  const isMap = [...(r.original_format ?? []), ...(r.subject ?? [])].some((s) => /\bmaps?\b/i.test(s));
  const image = makeImage({
    provider: "loc",
    nativeId: id,
    title: cleanText(r.title).replace(/^\[(.*)\]$/, "$1") || `Item ${id}`,
    description: cleanText((r.description ?? []).join(" ")).slice(0, 500) || cleanText(r.item?.medium_brief) || undefined,
    url: `${SITE}/item/${id}/`,
    author: authorOf(r),
    tags: (r.subject ?? []).slice(0, 30),
    category: isMap ? "archive.map" : undefined,
    sourceCategories: ["archive", ...genre],
    styles: stylesOf({ ...r, genre }),
    width: biggest.width,
    height: biggest.height,
    year: yearOf(r),
    thumbnailUrl: thumb.url,
    previewUrl: preview.url,
    formats: [...new Set(list.map((f) => f.format))],
    license: licenseOf(r.item?.rights_advisory),
    price: { free: true },
    downloadable: true,
    sourceName: SOURCE_NAME,
  });
  return { ...image, files: list };
}

function filesOf(item: LocItem): ImageFile[] {
  const out: ImageFile[] = [];
  const files = item.resources?.[0]?.files?.[0] ?? [];
  for (const f of files) {
    if (!f.url || /gif$/.test(f.mimetype ?? "")) continue;
    const format = f.mimetype === "image/tiff" ? "tif" : "jpg";
    out.push({
      url: f.url,
      filename: f.url.split("/").pop()!,
      format,
      mime: f.mimetype,
      role: format === "tif" ? "original" : (f.width ?? 0) <= 150 ? "thumbnail" : "rendition",
      width: f.width || undefined,
      height: f.height || undefined,
      sizeBytes: f.size || undefined,
    });
  }
  return out.sort((a, b) => (a.role === "original" ? -1 : b.role === "original" ? 1 : (b.width ?? 0) - (a.width ?? 0)));
}

/**
 * loc.gov sits behind a bot wall that refuses some cloud addresses with 403
 * (the shep.bot cluster on 2026-11-04) and rate-limits bursts with 429. After
 * either, pause for 30 minutes (or Retry-After) instead of asking on every
 * search.
 */
export const locPause = pauseOnRefusal("Library of Congress", { status: [403, 429], pauseMs: (e) => (e.retryAfterSec ?? 30 * 60) * 1000 });

export const loc: Provider = {
  id: "loc",
  name: SOURCE_NAME,
  homepage: `${SITE}/photos/`,
  description:
    "About 1.1M historic photos, prints, drawings, posters and maps from the Prints & Photographs Division, many public domain. Rights advisory per item; master TIFFs for most.",
  categories: ["archive", "people", "city", "architecture", "transport", "nature", "art"],
  access: "api",
  pricing: "free",
  supportsDownload: true,
  nativeFilters: ["freeOnly"],

  buildSearchUrl(q) {
    return `${SITE}/photos/${qs({ q: q.query.trim() || undefined, fa: "access-restricted:false" })}`;
  },

  async search(q, ctx) {
    const c = Math.max(1, Math.min(q.limit, MAX_PAGE_SIZE));
    const sp = Math.floor((q.offset ?? 0) / c) + 1;
    const url = `${SITE}/photos/${qs({ q: q.query.trim() || undefined, fo: "json", c, sp: sp > 1 ? sp : undefined, fa: "access-restricted:false", at: "results,pagination" })}`;
    const res = await locPause.run(() => ctx.fetch.json<LocSearch>(url, { cacheTtlMs: 60 * 60_000, signal: ctx.signal }));
    const images: ImageAsset[] = [];
    for (const r of res.results ?? []) {
      const d = toImage(r);
      if (!d) continue;
      const { files: _files, ...image } = d;
      images.push(image);
    }
    return { images, total: res.pagination?.of, searchUrl: this.buildSearchUrl(q) };
  },

  async getImage(nativeId, ctx) {
    if (!/^[\w.-]+$/.test(nativeId)) return null;
    const res = await locPause.run(() => ctx.fetch.json<LocItem>(`${SITE}/item/${nativeId}/${qs({ fo: "json", at: "item,resources" })}`, { cacheTtlMs: 24 * 60 * 60_000, signal: ctx.signal }));
    const it = res.item;
    if (!it) return null;
    const files = filesOf(res);
    const subjects = (it.subjects ?? []).flatMap((s) => Object.keys(s));
    const sized = files.filter((f) => f.format === "jpg").map((f) => `${f.url}#h=${f.height ?? 0}&w=${f.width ?? 0}`);
    const result: LocResult = {
      url: `${SITE}/item/${nativeId}/`,
      title: it.title,
      date: it.date,
      subject: subjects,
      image_url: sized.length ? sized : res.resources?.[0]?.image ? [res.resources[0].image] : [],
      item: it,
    };
    return toImage(result, files) ?? null;
  },

  async census(ctx): Promise<SourceCensus> {
    const count = async (extra: Record<string, string>): Promise<number> =>
      (await ctx.fetch.json<LocSearch>(`${SITE}/photos/${qs({ fo: "json", c: 1, at: "pagination", fa: "access-restricted:false", ...extra })}`, { signal: ctx.signal, cacheTtlMs: 0 })).pagination?.of ?? 0;
    const total = await count({});
    return {
      total,
      free: total,
      byCategory: { archive: total },
      method: "loc.gov /photos/ pagination.of with fa=access-restricted:false",
    };
  },
};
