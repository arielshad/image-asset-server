import { license } from "../core/licence.js";
import type { ImageAsset, ImageDetails, ImageFile, ImageQuery, Provider, ProviderContext, SourceCensus } from "../core/types.js";
import type { ImageStyle } from "../core/vocab.js";
import { cleanText, makeImage, qs } from "../core/util.js";
import { museumCategory } from "./museum.js";

/**
 * The Metropolitan Museum of Art (metmuseum.org): over 370k public-domain
 * artworks with images released under CC0 (Open Access), through the
 * official keyless Collection API.
 *
 * - Search: `/public/collection/v1.1/search?q=…&hasImages=true&isPublicDomain=true&offset=…&limit=…`
 *   returns `{ total, objectIDs }` only. (The v1 search, which returned every
 *   matching id at once, was retired on 2026-10-01; v1.1 is paginated.) The
 *   `isPublicDomain` and `hasImages` flags narrow the ranking but do not
 *   filter strictly, so objects are checked again below.
 * - Details: `/public/collection/v1/objects/<id>` per object: title, artist,
 *   date, department, classification, tags and image URLs. A search page is
 *   therefore 1 + N requests (run 6 at a time, cached for a day).
 *
 * Images on images.metmuseum.org come in three sizes: `web-additional`
 * (about 300 px, the thumbnail), `web-large` (about 1000 px, the preview) and
 * `original` (the full scan, often 20+ MB). The API gives no pixel sizes.
 *
 * Licence: objects with `isPublicDomain: true` are CC0 (Open Access); objects
 * without it have no downloadable image and are skipped.
 *
 * Rate limit: the Met asks for at most 80 requests per second.
 */

const SITE = "https://www.metmuseum.org";
const API = "https://collectionapi.metmuseum.org/public/collection";
const SOURCE_NAME = "The Metropolitan Museum of Art";
const MAX_PAGE_SIZE = 24;
const CONCURRENCY = 6;
const DAY = 24 * 60 * 60_000;

export interface MetObject {
  objectID: number;
  isPublicDomain?: boolean;
  primaryImage?: string;
  primaryImageSmall?: string;
  additionalImages?: string[];
  title?: string;
  objectName?: string;
  department?: string;
  classification?: string;
  culture?: string;
  period?: string;
  medium?: string;
  artistDisplayName?: string;
  artistDisplayBio?: string;
  artistWikidata_URL?: string;
  objectDate?: string;
  objectBeginDate?: number;
  objectEndDate?: number;
  creditLine?: string;
  objectURL?: string;
  tags?: { term: string }[] | null;
  message?: string;
}

interface MetSearch {
  total?: number;
  objectIDs?: number[] | null;
}

/** "…/web-large/DP-41223-001.jpg" → the same image at another size. */
function sized(url: string, size: "web-additional" | "web-large" | "original"): string {
  return url.replace(/\/(web-large|web-additional|original)\//, `/${size}/`);
}

/** Painting, drawing/print or photo, from the Met's classification and object name. */
export function stylesOf(o: Pick<MetObject, "classification" | "objectName" | "medium">): ImageStyle[] | undefined {
  const text = `${o.classification ?? ""} ${o.objectName ?? ""}`.toLowerCase();
  if (/photograph/.test(text)) return ["photo"];
  if (/painting/.test(text)) return ["painting"];
  if (/drawing|print|etching|engraving|woodcut|lithograph/.test(text)) return ["drawing"];
  return undefined;
}

export function toImage(o: MetObject): ImageDetails | undefined {
  const small = o.primaryImageSmall || o.primaryImage;
  if (!o.objectID || !small || !o.isPublicDomain) return undefined;
  const original = o.primaryImage || sized(small, "original");
  const files: ImageFile[] = [
    { url: original, filename: original.split("/").pop() ?? `${o.objectID}.jpg`, format: "jpg", role: "original" },
    { url: sized(small, "web-large"), filename: `${o.objectID}-web-large.jpg`, format: "jpg", role: "rendition" },
    { url: sized(small, "web-additional"), filename: `${o.objectID}-small.jpg`, format: "jpg", role: "thumbnail" },
  ];
  const artist = cleanText(o.artistDisplayName) || undefined;
  const image = makeImage({
    provider: "met",
    nativeId: String(o.objectID),
    title: cleanText(o.title) || cleanText(o.objectName) || `Object ${o.objectID}`,
    description: [o.objectDate, o.medium, o.culture, o.artistDisplayBio].map(cleanText).filter(Boolean).join(". ") || undefined,
    url: o.objectURL || `${SITE}/art/collection/search/${o.objectID}`,
    author: artist,
    authorUrl: o.artistWikidata_URL || undefined,
    tags: (o.tags ?? []).map((t) => t.term),
    // Department and classification are the reliable signals ("European Paintings", "Prints").
    category: museumCategory(stylesOf(o), o.classification, o.objectName, o.department),
    sourceCategories: [o.classification, o.objectName, o.department].map(cleanText).filter(Boolean),
    styles: stylesOf(o),
    year: o.objectBeginDate && o.objectBeginDate > 0 ? o.objectBeginDate : undefined,
    thumbnailUrl: sized(small, "web-additional"),
    previewUrl: sized(small, "web-large"),
    formats: ["jpg"],
    license: license("LicenseRef-Museum-Open-Access"),
    price: { free: true },
    downloadable: true,
    sourceName: SOURCE_NAME,
  });
  return { ...image, files };
}

async function getObject(id: number | string, ctx: ProviderContext): Promise<MetObject | null> {
  try {
    return await ctx.fetch.json<MetObject>(`${API}/v1/objects/${id}`, { cacheTtlMs: DAY, signal: ctx.signal });
  } catch {
    // A deleted object answers 404; one missing object should not fail the page.
    return null;
  }
}

/** Run `fn` over `items`, `n` at a time, keeping order. */
async function mapLimit<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!);
      }
    }),
  );
  return out;
}

function searchQuery(q: Pick<ImageQuery, "query">): string {
  return q.query.trim() || "*";
}

export const met: Provider = {
  id: "met",
  name: SOURCE_NAME,
  homepage: SITE,
  description:
    "Over 370k public-domain artworks from 5,000 years of art: paintings, drawings, prints, photographs, sculpture, armour and decorative arts. Every image CC0 (Open Access), originals at full scan size.",
  categories: ["art", "archive", "people", "nature", "animals", "objects"],
  access: "api",
  pricing: "free",
  supportsDownload: true,
  nativeFilters: ["commercialOnly", "freeOnly"],

  buildSearchUrl(q) {
    return `${SITE}/art/collection/search${qs({ q: q.query.trim() || undefined, showOnly: "openAccess|withImage" })}`;
  },

  async search(q, ctx) {
    const limit = Math.max(1, Math.min(q.limit, MAX_PAGE_SIZE));
    const url = `${API}/v1.1/search${qs({ q: searchQuery(q), hasImages: "true", isPublicDomain: "true", offset: q.offset || undefined, limit })}`;
    const res = await ctx.fetch.json<MetSearch>(url, { cacheTtlMs: 60 * 60_000, signal: ctx.signal });
    const ids = (res.objectIDs ?? []).slice(0, limit);
    const objects = await mapLimit(ids, CONCURRENCY, (id) => getObject(id, ctx));
    const images: ImageAsset[] = [];
    for (const o of objects) {
      const d = o && toImage(o);
      if (!d) continue;
      const { files: _files, ...image } = d;
      images.push(image);
    }
    return { images, total: res.total, searchUrl: this.buildSearchUrl(q) };
  },

  async getImage(nativeId, ctx) {
    if (!/^\d+$/.test(nativeId)) return null;
    const o = await getObject(nativeId, ctx);
    return (o && toImage(o)) ?? null;
  },

  async census(ctx): Promise<SourceCensus> {
    const count = async (query: string): Promise<number> =>
      (await ctx.fetch.json<MetSearch>(`${API}/v1.1/search${qs({ q: query, hasImages: "true", isPublicDomain: "true", limit: 1 })}`, { signal: ctx.signal, cacheTtlMs: 0 })).total ?? 0;
    const total = await count("*");
    const paintings = await count("painting");
    const photographs = await count("photograph");
    return {
      total,
      free: total,
      byCategory: {},
      categories: { paintings, photographs },
      method: "collectionapi.metmuseum.org v1.1 search totals with hasImages=true&isPublicDomain=true",
    };
  },
};
