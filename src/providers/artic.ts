import { license } from "../core/licence.js";
import { USER_AGENT } from "../core/http.js";
import type { ImageAsset, ImageDetails, ImageFile, Provider, ProviderContext, SourceCensus } from "../core/types.js";
import type { ImageStyle } from "../core/vocab.js";
import { cleanText, makeImage, qs } from "../core/util.js";
import { museumCategory } from "./museum.js";

/**
 * Art Institute of Chicago (artic.edu): about 59k public-domain artworks with
 * images, released under CC0, through the official keyless API at
 * api.artic.edu/api/v1.
 *
 * - Search: `/artworks/search?q=…&limit=…&page=…&fields=…` with an
 *   Elasticsearch filter (`query[bool][must][][term][is_public_domain]=true`
 *   and `query[bool][must][][exists][field]=image_id`), one request. Items
 *   carry title, artist, date, artwork type, department, subjects and the
 *   full image's pixel size (`thumbnail.width/height`).
 * - Details: `/artworks/<id>?fields=…`, one request.
 *
 * Images are served by AIC's IIIF Image API:
 * `https://www.artic.edu/iiif/2/<image_id>/full/<w>,/0/default.jpg`.
 * AIC caches and recommends `843,`; we use 400 for the thumbnail, 843 for the
 * preview, 1686 as a large rendition and `full` (public-domain works only)
 * as the original. The IIIF host sits behind a bot check that challenges
 * cloud IPs, but browsers load it fine, and this server never fetches the
 * bytes itself.
 *
 * AIC asks API clients to send an `AIC-User-Agent` header with a contact;
 * we send the server's User-Agent. Anonymous limit: 60 requests a minute.
 *
 * Licence: CC0 for public-domain works (`is_public_domain`); the search only
 * returns those.
 */

const SITE = "https://www.artic.edu";
const API = "https://api.artic.edu/api/v1";
const IIIF = "https://www.artic.edu/iiif/2";
const SOURCE_NAME = "Art Institute of Chicago";
const MAX_PAGE_SIZE = 50;
const FIELDS = [
  "id",
  "title",
  "artist_display",
  "artist_title",
  "date_display",
  "date_start",
  "image_id",
  "thumbnail",
  "is_public_domain",
  "classification_title",
  "classification_titles",
  "subject_titles",
  "style_titles",
  "term_titles",
  "artwork_type_title",
  "department_title",
  "medium_display",
  "credit_line",
  "main_reference_number",
].join(",");

export interface AicArtwork {
  id: number;
  title?: string | null;
  artist_display?: string | null;
  artist_title?: string | null;
  date_display?: string | null;
  date_start?: number | null;
  image_id?: string | null;
  thumbnail?: { width?: number; height?: number; alt_text?: string | null } | null;
  is_public_domain?: boolean;
  classification_title?: string | null;
  classification_titles?: string[] | null;
  subject_titles?: string[] | null;
  style_titles?: string[] | null;
  term_titles?: string[] | null;
  artwork_type_title?: string | null;
  department_title?: string | null;
  medium_display?: string | null;
  credit_line?: string | null;
  main_reference_number?: string | null;
}

interface AicSearch {
  pagination?: { total?: number };
  data?: AicArtwork[];
}

const headers = (): Record<string, string> => ({ "AIC-User-Agent": USER_AGENT });

/** The IIIF URL of `image_id` at `width` px wide ("full" for the original). */
export function iiif(imageId: string, width: number | "full"): string {
  return `${IIIF}/${imageId}/full/${width === "full" ? "full" : `${width},`}/0/default.jpg`;
}

export function stylesOf(a: Pick<AicArtwork, "artwork_type_title" | "classification_title">): ImageStyle[] | undefined {
  const t = `${a.artwork_type_title ?? ""} ${a.classification_title ?? ""}`.toLowerCase();
  if (/photograph/.test(t)) return ["photo"];
  if (/painting/.test(t)) return ["painting"];
  if (/drawing|print|watercolor|etching|engraving|woodcut|lithograph/.test(t)) return ["drawing"];
  return undefined;
}

export function toImage(a: AicArtwork): ImageDetails | undefined {
  if (!a.id || !a.image_id || a.is_public_domain === false) return undefined;
  const width = a.thumbnail?.width || undefined;
  const height = a.thumbnail?.height || undefined;
  const scaled = (w: number) => (width && height ? { width: Math.min(w, width), height: Math.round((height * Math.min(w, width)) / width) } : {});
  const files: ImageFile[] = [
    { url: iiif(a.image_id, "full"), filename: `artic-${a.id}.jpg`, format: "jpg", role: "original", width, height },
    { url: iiif(a.image_id, 1686), filename: `artic-${a.id}-1686.jpg`, format: "jpg", role: "rendition", ...scaled(1686) },
    { url: iiif(a.image_id, 843), filename: `artic-${a.id}-843.jpg`, format: "jpg", role: "rendition", ...scaled(843) },
    { url: iiif(a.image_id, 400), filename: `artic-${a.id}-400.jpg`, format: "jpg", role: "thumbnail", ...scaled(400) },
  ];
  // "James McNeill Whistler\nAmerican, 1834-1903" → name, then bio.
  const [artistLine, ...bio] = (a.artist_display ?? "").split("\n");
  const image = makeImage({
    provider: "artic",
    nativeId: String(a.id),
    title: cleanText(a.title) || `Artwork ${a.id}`,
    description: [a.date_display, a.medium_display, bio.join(" "), a.thumbnail?.alt_text].map((s) => cleanText(s)).filter(Boolean).join(". ") || undefined,
    url: `${SITE}/artworks/${a.id}`,
    author: cleanText(a.artist_title) || cleanText(artistLine) || undefined,
    tags: [...(a.subject_titles ?? []), ...(a.style_titles ?? []), ...(a.term_titles ?? [])].slice(0, 30),
    category: museumCategory(stylesOf(a), a.artwork_type_title, a.classification_title, a.department_title),
    sourceCategories: [a.artwork_type_title, a.department_title, ...(a.classification_titles ?? [a.classification_title])].map((s) => cleanText(s)).filter(Boolean),
    styles: stylesOf(a),
    width,
    height,
    year: a.date_start && a.date_start > 0 ? a.date_start : undefined,
    thumbnailUrl: iiif(a.image_id, 400),
    previewUrl: iiif(a.image_id, 843),
    formats: ["jpg"],
    license: license("LicenseRef-Museum-Open-Access"),
    price: { free: true },
    downloadable: true,
    sourceName: SOURCE_NAME,
  });
  return { ...image, files };
}

/** Elasticsearch filter: public domain, with an image. */
const FILTER = {
  "query[bool][must][0][term][is_public_domain]": "true",
  "query[bool][must][1][exists][field]": "image_id",
};

async function searchApi(params: Record<string, string | number | undefined>, ctx: ProviderContext, cacheTtlMs: number): Promise<AicSearch> {
  // The filter clauses go first: AIC answers 400 when must[2] comes before must[0] in the query string.
  const { limit, ...rest } = params;
  return ctx.fetch.json<AicSearch>(`${API}/artworks/search${qs({ ...FILTER, ...rest, limit })}`, { headers: headers(), cacheTtlMs, signal: ctx.signal });
}

export const artic: Provider = {
  id: "artic",
  name: SOURCE_NAME,
  homepage: SITE,
  description:
    "About 59k public-domain artworks with images: Impressionist and modern paintings, prints, drawings, photographs and textiles. CC0, served over IIIF at any size up to the full scan.",
  categories: ["art", "archive", "people", "nature", "architecture"],
  access: "api",
  pricing: "free",
  supportsDownload: true,
  nativeFilters: ["commercialOnly", "freeOnly"],

  buildSearchUrl(q) {
    return `${SITE}/collection${qs({ q: q.query.trim() || undefined, is_public_domain: 1 })}`;
  },

  async search(q, ctx) {
    const limit = Math.max(1, Math.min(q.limit, MAX_PAGE_SIZE));
    const res = await searchApi({ q: q.query.trim() || undefined, limit, from: q.offset || undefined, fields: FIELDS }, ctx, 60 * 60_000);
    const images: ImageAsset[] = [];
    for (const a of res.data ?? []) {
      const d = toImage(a);
      if (!d) continue;
      const { files: _files, ...image } = d;
      images.push(image);
    }
    return { images, total: res.pagination?.total, searchUrl: this.buildSearchUrl(q) };
  },

  async getImage(nativeId, ctx) {
    if (!/^\d+$/.test(nativeId)) return null;
    const res = await ctx.fetch.json<{ data?: AicArtwork }>(`${API}/artworks/${nativeId}${qs({ fields: FIELDS })}`, {
      headers: headers(),
      cacheTtlMs: 24 * 60 * 60_000,
      signal: ctx.signal,
    });
    return (res.data && toImage(res.data)) ?? null;
  },

  async census(ctx): Promise<SourceCensus> {
    const total = (await searchApi({ limit: 0 }, ctx, 0)).pagination?.total ?? 0;
    const paintings = (await searchApi({ limit: 0, "query[bool][must][2][term][artwork_type_id]": 1 }, ctx, 0)).pagination?.total ?? 0;
    return {
      total,
      free: total,
      byCategory: { art: total },
      categories: { paintings },
      method: "api.artic.edu artworks/search pagination.total with is_public_domain=true and an image_id",
    };
  },
};
