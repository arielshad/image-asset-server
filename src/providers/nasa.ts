import { asEditorial, customLicense, license } from "../core/licence.js";
import type { ImageDetails, ImageFile, License, Provider, SourceCensus } from "../core/types.js";
import { cleanText, makeImage, qs } from "../core/util.js";

/**
 * NASA Image and Video Library (images.nasa.gov): about 140k NASA photos —
 * the planets, galaxies and nebulae (Hubble, Webb, Chandra), Earth from
 * orbit, launches, astronauts, aircraft and the people of NASA — through the
 * official keyless API at images-api.nasa.gov.
 *
 * - Search: `/search?media_type=image&q=…` returns title, description,
 *   keywords, centre, date and the item's image links: the grid thumbnail
 *   (`preview`, ≈640 px), the resized copies (`alternate`) and the original
 *   (`canonical`), with pixel sizes where NASA knows them.
 * - Details: `<asset>/collection.json` lists every file NASA keeps: `~orig`
 *   and, when the original is big enough, `~large` (≈1920 px), `~medium`
 *   (≈1280 px), `~small` (≈640 px), plus `~thumb`.
 *
 * Licence: NASA media is generally not copyrighted in the US. NASA asks to be
 * credited, forbids implying endorsement and using its insignia, and needs
 * permission for identifiable people in ads, so every item is
 * yes-with-credit and editorial-flagged. Items whose credit line names
 * another organisation (ESA, a university, a photo agency) may be
 * copyrighted by them: those are "check-terms".
 */

const SITE = "https://images.nasa.gov";
const API = "https://images-api.nasa.gov";
const ASSETS = "https://images-assets.nasa.gov";
const SOURCE_NAME = "NASA Image and Video Library";
const MAX_PAGE_SIZE = 100;

/** Rendition name → nominal long side in pixels (capped by the original). */
const RENDITIONS: Record<string, number> = { large: 1920, medium: 1280, small: 640, thumb: 400 };

interface NasaData {
  nasa_id: string;
  title?: string;
  description?: string;
  description_508?: string;
  keywords?: string[];
  center?: string;
  date_created?: string;
  media_type?: string;
  photographer?: string;
  secondary_creator?: string;
  location?: string;
  album?: string[];
}

interface NasaLink {
  href: string;
  rel?: string;
  render?: string;
  width?: number;
  height?: number;
  size?: number;
}

interface NasaItem {
  href?: string;
  data?: NasaData[];
  links?: NasaLink[];
}

interface NasaSearch {
  collection?: { items?: NasaItem[]; metadata?: { total_hits?: number } };
}

function https(u: string): string {
  return u.replace(/^http:\/\//, "https://");
}

function assetBase(nasaId: string): string {
  const id = encodeURIComponent(nasaId);
  return `${ASSETS}/image/${id}/${id}`;
}

/** The credit NASA gives: "NASA/Bill Ingalls", the outside photographer ("Rocket Lab"), or the centre. */
function creditOf(d: NasaData): string | undefined {
  const who = cleanText(d.photographer || d.secondary_creator);
  if (who && !/^(n\/a|na|none)$/i.test(who)) return who.length > 80 ? `NASA ${d.center ?? ""}`.trim() + ` (${who.split(",")[0]} et al.)` : /\bnasa\b/i.test(who) ? who : `NASA/${who}`;
  return d.center ? `NASA ${d.center}` : "NASA";
}

/**
 * Outside organisations whose pictures NASA distributes ("NASA/SpaceX",
 * "Courtesy of ESA", "STScI/AURA"): they may be copyrighted by them.
 * Individual names are NASA staff or contractors and stay NASA media.
 */
const THIRD_PARTY =
  /\b(spacex|united launch alliance|ula|rocket ?lab|boeing|lockheed|northrop|blue origin|sierra (space|nevada)|axiom|firefly|intuitive machines|astrobotic|virgin (galactic|orbit)|esa|european space agency|jaxa|roscosmos|csa|canadian space agency|isro|getty|reuters|ap photo|associated press|courtesy|copyright)\b|©/i;

export function licenseFor(d: NasaData): License {
  const credit = [d.photographer, d.secondary_creator].map((x) => cleanText(x)).filter(Boolean).join("; ");
  const outside = THIRD_PARTY.exec(credit)?.[0];
  if (outside) {
    return customLicense("NASA media (third-party credit)", {
      url: "https://www.nasa.gov/nasa-brand-center/images-and-media/",
      verdict: "check-terms",
      attributionRequired: true,
      assertedBy: "source",
      note: `Credited to ${credit}: pictures from ${outside} may be copyrighted by them even though NASA distributes them. Ask before commercial use.`,
    });
  }
  return asEditorial(license("LicenseRef-NASA-Media", "source"), "");
}

function linkOf(item: NasaItem, rel: string): NasaLink | undefined {
  return item.links?.find((l) => l.rel === rel && l.render === "image");
}

function baseImage(d: NasaData, item?: NasaItem) {
  const description = cleanText(d.description || d.description_508).slice(0, 600) || undefined;
  const year = Number(d.date_created?.slice(0, 4)) || undefined;
  const thumb = item ? linkOf(item, "preview") : undefined;
  const orig = item ? linkOf(item, "canonical") : undefined;
  // Search lists the resized copies NASA has for this item ("alternate", 640–1920 px wide).
  const display = (item?.links ?? [])
    .filter((l) => l.rel === "alternate" && l.width && l.width <= 1400)
    .sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];
  const base = assetBase(d.nasa_id);
  const ext = orig ? (/\.([a-z0-9]+)$/i.exec(orig.href)?.[1]?.toLowerCase() ?? "jpg") : "jpg";
  return {
    provider: "nasa",
    nativeId: d.nasa_id,
    title: cleanText(d.title) || d.nasa_id,
    description,
    url: `${SITE}/details/${encodeURIComponent(d.nasa_id)}`,
    author: creditOf(d),
    tags: d.keywords ?? [],
    sourceCategories: [...(d.keywords ?? []), ...(d.album ?? [])],
    styles: ["photo" as const].filter(() => !/\b(illustration|artist'?s? (concept|rendering|impression)|animation|graphic|logo|diagram)\b/i.test(`${d.title} ${(d.keywords ?? []).join(" ")}`)),
    width: orig?.width,
    height: orig?.height,
    year,
    thumbnailUrl: thumb ? https(thumb.href) : `${base}~thumb.jpg`,
    previewUrl: display ? https(display.href) : orig && (orig.size ?? Infinity) < 2_000_000 ? https(orig.href) : thumb ? https(thumb.href) : undefined,
    formats: [ext === "jpeg" ? "jpg" : ext],
    license: licenseFor(d),
    price: { free: true },
    downloadable: true,
    createdAt: d.date_created,
    sourceName: SOURCE_NAME,
  };
}

/** Scale a nominal long side to the original's aspect ratio, never above the original. */
function sizeFor(long: number, master?: { width?: number; height?: number }): { width?: number; height?: number } {
  if (!master?.width || !master?.height) return {};
  const l = Math.max(master.width, master.height);
  if (long >= l) return { width: master.width, height: master.height };
  const k = long / l;
  return { width: Math.round(master.width * k), height: Math.round(master.height * k) };
}

export function filesFrom(nasaId: string, urls: string[], master?: { width?: number; height?: number; sizeBytes?: number }): ImageFile[] {
  const out: ImageFile[] = [];
  for (const raw of urls) {
    const url = https(raw);
    const name = decodeURIComponent(url.split("/").pop() ?? "");
    const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
    if (!ext || !["jpg", "jpeg", "png", "tif", "tiff", "gif", "webp"].includes(ext)) continue;
    const format = ext === "jpeg" ? "jpg" : ext === "tiff" ? "tif" : ext;
    const variant = /~([a-z]+)\.[a-z0-9]+$/i.exec(name)?.[1]?.toLowerCase();
    if (variant === "orig") {
      out.push({ url, filename: name, format, role: "original", width: master?.width, height: master?.height, sizeBytes: master?.sizeBytes });
    } else if (variant && RENDITIONS[variant]) {
      out.push({ url, filename: name, format, role: variant === "thumb" ? "thumbnail" : "rendition", ...sizeFor(RENDITIONS[variant]!, master) });
    }
  }
  // Originals stay first, then renditions from big to small.
  return out.sort((a, b) => roleOrder(a) - roleOrder(b) || (b.width ?? 0) - (a.width ?? 0));
  function roleOrder(f: ImageFile) {
    return ["original", "rendition", "thumbnail"].indexOf(f.role);
  }
}

export const nasa: Provider = {
  id: "nasa",
  name: SOURCE_NAME,
  homepage: SITE,
  description:
    "About 140k NASA photos: planets, galaxies and nebulae, Earth from orbit, launches, astronauts and aircraft. Public domain in the US with credit to NASA (no endorsement, no insignia); originals up to full camera resolution plus 640–1920 px copies.",
  categories: ["space", "science", "nature", "tech", "transport", "people", "archive"],
  access: "api",
  pricing: "free",
  supportsDownload: true,
  nativeFilters: ["freeOnly"],

  buildSearchUrl(q) {
    return `${SITE}/search${qs({ q: q.query.trim() || undefined, media: "image" })}`;
  },

  async search(q, ctx) {
    const pageSize = Math.max(1, Math.min(q.limit, MAX_PAGE_SIZE));
    const page = Math.floor((q.offset ?? 0) / pageSize) + 1;
    const url = `${API}/search${qs({ q: q.query.trim() || "nasa", media_type: "image", page_size: pageSize, page })}`;
    const res = await ctx.fetch.json<NasaSearch>(url, { cacheTtlMs: 60 * 60_000, signal: ctx.signal });
    const images = (res.collection?.items ?? [])
      .map((item) => {
        const d = item.data?.[0];
        if (!d?.nasa_id || (d.media_type && d.media_type !== "image")) return undefined;
        return makeImage(baseImage(d, item));
      })
      .filter((c): c is NonNullable<typeof c> => !!c);
    return { images, total: res.collection?.metadata?.total_hits, searchUrl: this.buildSearchUrl(q) };
  },

  async getImage(nativeId, ctx) {
    const search = await ctx.fetch.json<NasaSearch>(`${API}/search${qs({ nasa_id: nativeId, media_type: "image" })}`, { cacheTtlMs: 24 * 3600_000, signal: ctx.signal });
    const item = search.collection?.items?.[0];
    const d = item?.data?.[0];
    if (!item || !d) return null;
    const urls = await ctx.fetch
      .json<string[]>(`${ASSETS}/image/${encodeURIComponent(d.nasa_id)}/collection.json`, { cacheTtlMs: 24 * 3600_000, signal: ctx.signal })
      .catch(() => [] as string[]);
    const base = baseImage(d, item);
    const orig = linkOf(item, "canonical");
    const files = filesFrom(d.nasa_id, urls, { width: base.width, height: base.height, sizeBytes: orig?.size });
    const formats = [...new Set(files.filter((f) => f.role !== "thumbnail").map((f) => f.format))];
    const image = makeImage({ ...base, formats: formats.length ? formats : base.formats });
    return { ...image, files } satisfies ImageDetails;
  },

  async census(ctx): Promise<SourceCensus> {
    const res = await ctx.fetch.json<NasaSearch>(`${API}/search${qs({ media_type: "image", page_size: 1, q: "nasa" })}`, { signal: ctx.signal, cacheTtlMs: 0 });
    const total = res.collection?.metadata?.total_hits ?? 0;
    const hubble = await ctx.fetch.json<NasaSearch>(`${API}/search${qs({ media_type: "image", page_size: 1, q: "hubble" })}`, { signal: ctx.signal, cacheTtlMs: 0 });
    const earth = await ctx.fetch.json<NasaSearch>(`${API}/search${qs({ media_type: "image", page_size: 1, q: "earth" })}`, { signal: ctx.signal, cacheTtlMs: 0 });
    return {
      total,
      atLeast: true,
      free: total,
      byCategory: {},
      categories: { Hubble: hubble.collection?.metadata?.total_hits ?? 0, Earth: earth.collection?.metadata?.total_hits ?? 0 },
      method: "images-api.nasa.gov search total_hits for media_type=image (q=nasa matches almost every item, so it is a lower bound)",
    };
  },
};
