import { customLicense, parseLicense } from "../core/licence.js";
import type { ImageAsset, ImageDetails, ImageFile, ImageQuery, ImageStyle, License, Provider, SourceCensus } from "../core/types.js";
import { cleanText, makeImage, qs } from "../core/util.js";
import { IMAGE_MIME } from "../core/vocab.js";

/**
 * Wikimedia Commons: over 100 million freely licensed media files, most of
 * them photos, drawings, maps and diagrams, each with a licence recorded per
 * file. Found with the public MediaWiki API in one request:
 * `action=query&generator=search&gsrnamespace=6&gsrsearch=<q> filetype:bitmap|drawing`
 * with `prop=imageinfo`: the original file, its pixel size, MIME type, a
 * thumbnail (`thumburl`) and the licence (`extmetadata`).
 *
 * Thumbnails: Commons serves resized copies at standard widths (250, 330,
 * 500, 960, 1280, 1920, 3840…) by rewriting the `/thumb/…/<N>px-` part of a
 * thumbnail URL, so one `iiurlwidth` gives the grid thumbnail and the larger
 * sizes are built from it without more requests. SVG drawings come back as
 * PNG thumbnails; the original stays SVG (vector, any size).
 *
 * A minimum resolution goes to the search itself as `filew:>N fileh:>N`
 * (both sides at least N is the same as the short side at least N).
 *
 * nativeId is the file title without "File:" and with underscores for spaces,
 * as in Commons URLs ("Lake_Louise_sunrise.jpg").
 *
 * Rate limits (2026): about 10 requests/minute without a descriptive
 * User-Agent, 200/minute with one. The shared HTTP client sends one with
 * contact details, retries once on a short 429, and results are cached.
 */

const SITE = "https://commons.wikimedia.org";
const API = `${SITE}/w/api.php`;
const MAX_PAGE_SIZE = 50;
const METADATA = "ObjectName|ImageDescription|Artist|LicenseShortName|LicenseUrl|AttributionRequired|DateTimeOriginal|DateTime|Categories";
const SOURCE_NAME = "Wikimedia Commons";
const THUMB_WIDTH = 330;
const PREVIEW_WIDTH = 1280;
/** Standard thumbnail widths Commons renders on request (2025+). */
const STANDARD_WIDTHS = [960, 1920, 3840];

interface Meta {
  value?: string;
}

interface CommonsPage {
  title: string;
  index?: number;
  missing?: boolean;
  imageinfo?: {
    size?: number;
    width?: number;
    height?: number;
    url?: string;
    thumburl?: string;
    descriptionurl?: string;
    mime?: string;
    mediatype?: string;
    extmetadata?: Record<string, Meta | undefined>;
  }[];
}

interface CommonsQuery {
  query?: { pages?: CommonsPage[]; searchinfo?: { totalhits?: number } };
  continue?: Record<string, string | number>;
  /** MediaWiki reports some failures ("cirrussearch-too-busy-error") with HTTP 200 and this body. */
  error?: { code?: string; info?: string };
}

function check(res: CommonsQuery): CommonsQuery {
  if (res.error) throw new Error(`Commons API: ${res.error.info ?? res.error.code ?? "error"}`);
  return res;
}

/** Wikimedia metadata values can hold HTML; keep the text. */
function plain(html: string | undefined): string {
  return cleanText(
    (html ?? "")
      .replace(/<[^>]*>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">"),
  );
}

/** "File:Ocean_waves.webm" / "Ocean_waves.webm" → "Ocean waves.webm" (MediaWiki's canonical title, for API calls). */
export function commonsTitle(title: string): string {
  return title.replace(/^File:/i, "").replace(/_/g, " ").trim();
}

/** "File:Ocean waves.webm" → "Ocean_waves.webm": the nativeId. */
export function commonsNativeId(title: string): string {
  return commonsTitle(title).replace(/ /g, "_");
}

/** Licence, maintenance and upload-bookkeeping categories say nothing about the picture. */
const NOISE_CATEGORY =
  /^(gfdl|cc[- ]|pd[- ]|public domain|self-published|license migration|files with|files by|files from|media (needing|with|missing)|uploaded|images (by|from|with|of size|in)|photographs by|png files|svg files|jpeg files|pages with|attribution|all media|taken with|quality|featured|valued|pictures of the day|photos by|photographs taken on)|license|licence/i;

function sourceCategoriesOf(meta: Record<string, Meta | undefined>): string[] {
  return (meta.Categories?.value ?? "")
    .split("|")
    .map(cleanText)
    .filter((c) => c && !NOISE_CATEGORY.test(c));
}

/** Artist is HTML; "No machine-readable author provided. <a>User</a> assumed (…)" → "User". */
function authorOf(html: string): string | undefined {
  const text = plain(html);
  if (/^no machine-readable author/i.test(text)) {
    const link = /<a [^>]*>([^<]+)<\/a>/.exec(html)?.[1];
    return link ? plain(link).replace(/~commonswiki$/, "").replace(/^User:\s*/i, "") : undefined;
  }
  return text.replace(/^User:\s*/i, "").slice(0, 120) || undefined;
}

function authorUrlOf(html: string): string | undefined {
  const href = /<a [^>]*href="([^"]+)"/.exec(html)?.[1];
  if (!href) return undefined;
  return href.startsWith("//") ? `https:${href}` : href.startsWith("/") ? `${SITE}${href}` : /^https?:\/\//.test(href) ? href : undefined;
}

function licenseOf(meta: Record<string, Meta | undefined>): License {
  const name = plain(meta.LicenseShortName?.value);
  const url = meta.LicenseUrl?.value || undefined;
  const parsed = parseLicense(name) ?? parseLicense(url);
  if (parsed) return parsed;
  if (name) {
    return customLicense(name, {
      url,
      assertedBy: "source",
      attributionRequired: meta.AttributionRequired?.value === "true" || undefined,
    });
  }
  return customLicense("No licence stated", { assertedBy: "source", note: "Commons lists no licence for this file; check its page." });
}

/** Strip the analytics query Commons now appends to upload and thumbnail URLs. */
function cleanUrl(u: string): string {
  return u.replace(/\?utm_[^#]*$/, "");
}

/** A thumbnail URL at another width: ".../thumb/a/ab/X.jpg/330px-X.jpg" → ".../960px-X.jpg". */
export function thumbAt(thumbUrl: string, width: number): string {
  return thumbUrl.replace(/\/(?:lossy-|lossless-)?(?:page\d+-)?\d+px-/, (m) => m.replace(/\d+px-/, `${width}px-`));
}

function formatOf(name: string, mime?: string): string {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
  if (ext) return ext === "jpeg" ? "jpg" : ext === "tiff" ? "tif" : ext;
  return Object.entries(IMAGE_MIME).find(([, m]) => m === mime)?.[0] ?? "jpg";
}

function filesOf(p: CommonsPage): ImageFile[] {
  const info = p.imageinfo?.[0];
  const out: ImageFile[] = [];
  if (!info?.url) return out;
  const url = cleanUrl(info.url);
  const name = decodeURIComponent(url.split("/").pop() ?? commonsNativeId(p.title));
  const format = formatOf(name, info.mime);
  out.push({ url, filename: name, format, mime: info.mime, role: "original", width: info.width, height: info.height, sizeBytes: info.size });
  const thumb = info.thumburl ? cleanUrl(info.thumburl) : undefined;
  if (thumb && info.width && info.height) {
    const thumbFormat = formatOf(thumb);
    const stem = name.replace(/\.[a-z0-9]+$/i, "");
    // Resized copies smaller than the original (any size for a vector).
    for (const w of STANDARD_WIDTHS) {
      if (format !== "svg" && w >= info.width) continue;
      out.push({
        url: thumbAt(thumb, w),
        filename: `${stem}-${w}w.${thumbFormat}`,
        format: thumbFormat,
        role: "rendition",
        width: w,
        height: Math.round((info.height / info.width) * w),
      });
    }
    out.push({ url: thumb, filename: `${stem}-thumb.${thumbFormat}`, format: thumbFormat, role: "thumbnail", width: THUMB_WIDTH, height: Math.round((info.height / info.width) * THUMB_WIDTH) });
  }
  return out;
}

/** Kind from the file and its categories: SVG → vector; maps, drawings, paintings and photos by their words. */
function stylesOf(format: string, cats: string[], title: string): ImageStyle[] {
  const words = `${cats.join(" ")} ${title}`.toLowerCase();
  const out: ImageStyle[] = [];
  if (format === "svg") out.push("vector");
  if (/\bicons?\b/.test(words) && format === "svg") out.push("icon");
  return out;
}

export function toImage(p: CommonsPage): ImageDetails | undefined {
  const info = p.imageinfo?.[0];
  if (!info?.url) return undefined;
  if (info.mediatype && !["BITMAP", "DRAWING"].includes(info.mediatype)) return undefined;
  const meta = info.extmetadata ?? {};
  const nativeId = commonsNativeId(p.title);
  const title = plain(meta.ObjectName?.value) || commonsTitle(p.title).replace(/\.[a-z0-9]{2,5}$/i, "");
  const description = plain(meta.ImageDescription?.value).slice(0, 500) || undefined;
  const files = filesOf(p);
  const original = files.find((f) => f.role === "original");
  const format = original?.format ?? "jpg";
  const thumb = info.thumburl ? cleanUrl(info.thumburl) : undefined;
  const date = meta.DateTimeOriginal?.value ?? meta.DateTime?.value;
  const year = Number(/\b(1[5-9]\d\d|20\d\d)\b/.exec(plain(date))?.[1]) || undefined;
  const cats = sourceCategoriesOf(meta);
  const image = makeImage({
    provider: "wikimediacommons",
    nativeId,
    title,
    description,
    url: info.descriptionurl ? cleanUrl(info.descriptionurl) : `${SITE}/wiki/File:${encodeURIComponent(nativeId)}`,
    author: authorOf(meta.Artist?.value ?? ""),
    authorUrl: authorUrlOf(meta.Artist?.value ?? ""),
    sourceCategories: cats,
    styles: stylesOf(format, cats, title),
    width: info.width,
    height: info.height,
    vector: format === "svg" || undefined,
    year,
    thumbnailUrl: thumb,
    previewUrl: thumb ? (format === "svg" || (info.width ?? 0) > PREVIEW_WIDTH ? thumbAt(thumb, PREVIEW_WIDTH) : cleanUrl(info.url)) : undefined,
    formats: [...new Set(files.filter((f) => f.role !== "thumbnail").map((f) => f.format))],
    license: licenseOf(meta),
    price: { free: true },
    downloadable: true,
    createdAt: parseDate(meta.DateTime?.value),
    sourceName: SOURCE_NAME,
  });
  return { ...image, files };
}

function parseDate(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const d = new Date(plain(v));
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** Error bodies come back with HTTP 200; keep them out of the cache. */
const noError = (body: string): boolean => !/^\s*\{\s*"error"/.test(body);

const PROPS = {
  prop: "imageinfo",
  iiprop: "url|size|mime|mediatype|extmetadata",
  iiurlwidth: THUMB_WIDTH,
  iiextmetadatafilter: METADATA,
  iiextmetadatalanguage: "en",
};

/** The search string Commons gets: the words, the file type, and the minimum size. */
export function searchText(q: Pick<ImageQuery, "query" | "minResolution" | "styles" | "formats">): string {
  const vectorOnly = (q.styles?.length && q.styles.every((s) => s === "vector" || s === "icon")) || (q.formats?.length === 1 && q.formats[0] === "svg");
  const parts = [q.query.trim(), vectorOnly ? "filetype:drawing" : "filetype:bitmap|drawing"];
  if (q.minResolution && !vectorOnly) {
    // Both sides above N-1 ⇔ the short side is at least N (3% slack for cropped masters).
    const n = Math.floor(q.minResolution * 0.97) - 1;
    parts.push(`filew:>${n}`, `fileh:>${n}`);
  }
  return parts.filter(Boolean).join(" ");
}

export const wikimediacommons: Provider = {
  id: "wikimediacommons",
  name: SOURCE_NAME,
  homepage: SITE,
  description:
    "Over 100 million freely licensed photos, drawings, maps, diagrams and SVGs: nature, places, people, history, science and art. Licence recorded per file (CC0, public domain, CC BY, CC BY-SA); resized copies up to 4K and the original file.",
  categories: ["nature", "animals", "city", "architecture", "people", "food", "objects", "tech", "transport", "space", "science", "art", "archive", "background", "icons"],
  access: "api",
  pricing: "free",
  supportsDownload: true,
  nativeFilters: ["resolution", "freeOnly"],

  buildSearchUrl(q) {
    return `${SITE}/w/index.php${qs({ search: q.query.trim(), title: "Special:MediaSearch", type: "image" })}`;
  },

  async search(q, ctx) {
    const limit = Math.max(1, Math.min(q.limit, MAX_PAGE_SIZE));
    const url = `${API}${qs({
      action: "query",
      format: "json",
      formatversion: 2,
      generator: "search",
      gsrnamespace: 6,
      gsrsearch: searchText(q),
      gsrlimit: limit,
      gsroffset: q.offset || undefined,
      ...PROPS,
    })}`;
    const res = check(await ctx.fetch.json<CommonsQuery>(url, { cacheTtlMs: 60 * 60_000, cacheIf: noError, signal: ctx.signal }));
    const pages = [...(res.query?.pages ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    const images: ImageAsset[] = [];
    for (const p of pages) {
      const c = toImage(p);
      if (!c) continue;
      const { files: _files, ...image } = c;
      images.push(image);
    }
    return { images, searchUrl: this.buildSearchUrl(q) };
  },

  async getImage(nativeId, ctx) {
    const url = `${API}${qs({ action: "query", format: "json", formatversion: 2, titles: `File:${commonsTitle(nativeId)}`, ...PROPS })}`;
    const res = check(await ctx.fetch.json<CommonsQuery>(url, { cacheTtlMs: 60 * 60_000, cacheIf: noError, signal: ctx.signal }));
    const page = res.query?.pages?.[0];
    if (!page || page.missing) return null;
    return toImage(page) ?? null;
  },

  async census(ctx): Promise<SourceCensus> {
    const count = async (search: string): Promise<number> => {
      const r = check(await ctx.fetch.json<CommonsQuery>(
        `${API}${qs({ action: "query", format: "json", formatversion: 2, list: "search", srnamespace: 6, srsearch: search, srinfo: "totalhits", srlimit: 1, srprop: "" })}`,
        { signal: ctx.signal, cacheTtlMs: 0 },
      ));
      return r.query?.searchinfo?.totalhits ?? 0;
    };
    const total = await count("filetype:bitmap|drawing");
    const drawings = await count("filetype:drawing");
    const uhd = await count("filetype:bitmap filew:>2094 fileh:>2094");
    return {
      total,
      free: total,
      byCategory: {},
      categories: { "Vector drawings (SVG)": drawings, "4K or larger": uhd },
      method: "MediaWiki search totalhits for filetype:bitmap|drawing (and filetype:drawing, filew/fileh for the tiers)",
    };
  },
};
