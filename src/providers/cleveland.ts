import { customLicense, license } from "../core/licence.js";
import type { ImageAsset, ImageDetails, ImageFile, Provider, SourceCensus } from "../core/types.js";
import type { ImageStyle } from "../core/vocab.js";
import { cleanText, makeImage, qs } from "../core/util.js";
import { museumCategory } from "./museum.js";

/**
 * The Cleveland Museum of Art (clevelandart.org): about 42k CC0 artworks with
 * images (Open Access), through the official keyless API at
 * openaccess-api.clevelandart.org.
 *
 * - Search: `/api/artworks/?q=…&limit=…&skip=…&has_image=1&cc0=1&fields=…`,
 *   one request; items carry title, creators, date, type, technique,
 *   department, culture and three image sizes with pixel dimensions.
 * - Details: `/api/artworks/<id>?fields=…`, one request.
 *
 * Image sizes on openaccess-cdn.clevelandart.org: `web` (about 900 px JPEG,
 * used as thumbnail and preview: there is no smaller one), `print` (about
 * 3400 px JPEG) and `full` (the master TIFF, often 50+ MB).
 *
 * Licence: `share_license_status: "CC0"`; the search asks for CC0 only. No
 * published rate limit; results are cached.
 */

const SITE = "https://www.clevelandart.org";
const API = "https://openaccess-api.clevelandart.org/api/artworks";
const SOURCE_NAME = "Cleveland Museum of Art";
const MAX_PAGE_SIZE = 50;
const FIELDS = "id,accession_number,share_license_status,title,creation_date,creation_date_earliest,creators,type,technique,department,culture,url,images,description,tombstone,collection";

interface CmaImage {
  url?: string;
  width?: string | number;
  height?: string | number;
  filesize?: string | number;
  filename?: string;
}

export interface CmaArtwork {
  id: number;
  accession_number?: string;
  share_license_status?: string;
  title?: string;
  creation_date?: string;
  creation_date_earliest?: number | null;
  creators?: { description?: string; role?: string }[];
  type?: string;
  technique?: string;
  department?: string;
  culture?: string[];
  collection?: string;
  url?: string;
  description?: string | null;
  images?: { web?: CmaImage | null; print?: CmaImage | null; full?: CmaImage | null } | null;
}

interface CmaSearch {
  info?: { total?: number };
  data?: CmaArtwork[];
}

const num = (v: string | number | undefined): number | undefined => (v === undefined || v === "" ? undefined : Number(v) || undefined);

export function stylesOf(type: string | undefined): ImageStyle[] | undefined {
  const t = (type ?? "").toLowerCase();
  if (/photograph/.test(t)) return ["photo"];
  if (/painting|miniature/.test(t)) return ["painting"];
  if (/drawing|print/.test(t)) return ["drawing"];
  return undefined;
}

function file(img: CmaImage | null | undefined, role: ImageFile["role"]): ImageFile | undefined {
  if (!img?.url) return undefined;
  const filename = img.filename || img.url.split("/").pop()!;
  const ext = filename.split(".").pop()!.toLowerCase();
  return { url: img.url, filename, format: ext === "tiff" ? "tif" : ext === "jpeg" ? "jpg" : ext, role, width: num(img.width), height: num(img.height), sizeBytes: num(img.filesize) };
}

export function toImage(a: CmaArtwork): ImageDetails | undefined {
  const web = a.images?.web;
  if (!a.id || !web?.url) return undefined;
  const files = [file(a.images?.full, "original"), file(a.images?.print, "rendition"), file(web, "rendition")].filter((f): f is ImageFile => !!f);
  const biggest = files[0]!;
  // "John D. Wareham (American, 1871–1954)" → "John D. Wareham".
  const author = a.creators?.[0]?.description?.replace(/\s*\(.*$/, "").trim() || undefined;
  const cc0 = (a.share_license_status ?? "").toUpperCase() === "CC0";
  const image = makeImage({
    provider: "cleveland",
    nativeId: String(a.id),
    title: cleanText(a.title) || a.accession_number || `Artwork ${a.id}`,
    description: cleanText(a.description ?? undefined).slice(0, 500) || cleanText(a.technique) || undefined,
    url: a.url || `${SITE}/art/${a.accession_number}`,
    author,
    tags: [a.type, a.technique, ...(a.culture ?? [])].map((s) => cleanText(s)).filter(Boolean),
    category: museumCategory(stylesOf(a.type), a.type, a.department, a.collection),
    sourceCategories: [a.type, a.department, a.collection].map((s) => cleanText(s)).filter(Boolean),
    styles: stylesOf(a.type),
    width: biggest.width,
    height: biggest.height,
    year: a.creation_date_earliest && a.creation_date_earliest > 0 ? a.creation_date_earliest : undefined,
    thumbnailUrl: web.url,
    previewUrl: web.url,
    formats: [...new Set(files.map((f) => f.format))],
    license: cc0 ? license("LicenseRef-Museum-Open-Access") : customLicense("Copyrighted (Cleveland Museum of Art)", { verdict: "no", commercialUse: false, url: `${SITE}/open-access` }),
    price: { free: true },
    downloadable: true,
    sourceName: SOURCE_NAME,
  });
  return { ...image, files };
}

export const cleveland: Provider = {
  id: "cleveland",
  name: SOURCE_NAME,
  homepage: SITE,
  description:
    "About 42k CC0 artworks with images: paintings, prints, drawings, photographs, ceramics, textiles and arms from around the world. Print-size JPEGs and master TIFFs.",
  categories: ["art", "archive", "people", "nature", "animals", "objects"],
  access: "api",
  pricing: "free",
  supportsDownload: true,
  nativeFilters: ["commercialOnly", "freeOnly"],

  buildSearchUrl(q) {
    return `${SITE}/art/collection/search${qs({ search: q.query.trim() || undefined, "only-open-access": 1, filter_images: 1 })}`;
  },

  async search(q, ctx) {
    const limit = Math.max(1, Math.min(q.limit, MAX_PAGE_SIZE));
    const url = `${API}/${qs({ q: q.query.trim() || undefined, limit, skip: q.offset || undefined, has_image: 1, cc0: 1, fields: FIELDS })}`;
    const res = await ctx.fetch.json<CmaSearch>(url, { cacheTtlMs: 60 * 60_000, signal: ctx.signal });
    const images: ImageAsset[] = [];
    for (const a of res.data ?? []) {
      const d = toImage(a);
      if (!d) continue;
      const { files: _files, ...image } = d;
      images.push(image);
    }
    return { images, total: res.info?.total, searchUrl: this.buildSearchUrl(q) };
  },

  async getImage(nativeId, ctx) {
    if (!/^\d+$/.test(nativeId)) return null;
    const res = await ctx.fetch.json<{ data?: CmaArtwork }>(`${API}/${nativeId}${qs({ fields: FIELDS })}`, { cacheTtlMs: 24 * 60 * 60_000, signal: ctx.signal });
    return (res.data && toImage(res.data)) ?? null;
  },

  async census(ctx): Promise<SourceCensus> {
    const count = async (extra: Record<string, string>): Promise<number> =>
      (await ctx.fetch.json<CmaSearch>(`${API}/${qs({ has_image: 1, cc0: 1, limit: 1, fields: "id", ...extra })}`, { signal: ctx.signal, cacheTtlMs: 0 })).info?.total ?? 0;
    const total = await count({});
    const paintings = await count({ type: "Painting" });
    const photographs = await count({ type: "Photograph" });
    return {
      total,
      free: total,
      byCategory: { art: total },
      categories: { paintings, photographs },
      method: "openaccess-api.clevelandart.org info.total with has_image=1&cc0=1 (and type= for the breakdown)",
    };
  },
};
