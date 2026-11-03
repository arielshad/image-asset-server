import { creativeCommons, customLicense, parseLicense } from "../core/licence.js";
import type { ImageAsset, ImageDetails, License, Provider, ProviderContext, SourceCensus } from "../core/types.js";
import { makeImage, qs } from "../core/util.js";

/**
 * Iconify (iconify.design): about 470k open-source icons in about 280 sets
 * (Material Symbols, Tabler, Lucide, Phosphor, Font Awesome Free, Fluent
 * Emoji…), through the public keyless Iconify API at api.iconify.design.
 *
 * - Search: `/search?query=…&limit=…&start=…` returns icon names
 *   ("tabler:rocket") and, for every set in the results, its name, author,
 *   licence (SPDX id + URL) and grid height. One request. `limit` is at
 *   least 32 and counts from the start of the list, so a page at `offset`
 *   asks for `start=offset&limit=offset+n`.
 * - Details: `/collections?prefix=<set>` for the set's licence and author,
 *   and `/<set>.json?icons=<name>` for the icon's own width and height.
 * - The SVG itself: `/<set>/<name>.svg`, rendered by the API from the icon
 *   data (`?height=` scales it). Iconify serves SVG only; no PNG.
 *
 * Licence: per icon set, as the set's authors chose it. MIT, Apache 2.0 and
 * ISC → yes-with-credit (keep the notice); CC BY → yes-with-credit; OFL and
 * CC0 → yes; CC BY-SA and GPL → restricted (share-alike / copyleft).
 *
 * Every icon is a vector with a transparent background; page URLs point at
 * the set's page on icon-sets.iconify.design.
 */

const SITE = "https://icon-sets.iconify.design";
const API = "https://api.iconify.design";
const SOURCE_NAME = "Iconify";
const MIN_LIMIT = 32;
const MAX_PAGE_SIZE = 96;

export interface IconSet {
  name?: string;
  total?: number;
  author?: { name?: string; url?: string };
  license?: { title?: string; spdx?: string; url?: string };
  height?: number | number[];
  category?: string;
  palette?: boolean;
  tags?: string[];
  hidden?: boolean;
}

interface IconifySearch {
  icons?: string[];
  total?: number;
  collections?: Record<string, IconSet>;
}

interface IconData {
  width?: number;
  height?: number;
  icons?: Record<string, { width?: number; height?: number }>;
}

/** The licence of an icon set, from its SPDX id. */
export function licenseOf(set: IconSet | undefined): License {
  const spdx = set?.license?.spdx ?? "";
  const url = set?.license?.url;
  const title = set?.license?.title ?? spdx;
  if (/^(GPL|LGPL|AGPL)/i.test(spdx)) {
    return customLicense(title || "GPL", {
      url,
      verdict: "restricted",
      commercialUse: true,
      attributionRequired: true,
      note: "Copyleft: software or files that bundle the icon may have to be released under the same licence. Fine in a web page or design; check before shipping it inside a product.",
      assertedBy: "source",
    });
  }
  if (/^MPL/i.test(spdx)) {
    return customLicense(title || "MPL 2.0", { url, verdict: "yes-with-credit", commercialUse: true, attributionRequired: true, note: "Free for any use; changes to the icon files themselves stay under the MPL.", assertedBy: "source" });
  }
  const cc = /^CC-BY(-(NC|ND|SA))*-(\d\.\d)$/i.exec(spdx);
  if (cc) {
    const parts = spdx.toUpperCase().split("-");
    return { ...creativeCommons({ nc: parts.includes("NC"), nd: parts.includes("ND"), sa: parts.includes("SA") }, cc[3]!), ...(url ? { url } : {}) };
  }
  const parsed = parseLicense(spdx) ?? parseLicense(title);
  if (parsed) return url && !parsed.id.startsWith("CC") ? { ...parsed, url } : parsed;
  return customLicense(title || "Licence not stated", { url, assertedBy: "source" });
}

function svgUrl(prefix: string, name: string): string {
  return `${API}/${prefix}/${name}.svg`;
}

/** "tabler:rocket" → an image. `size` is the icon's own grid size when known. */
export function toImage(fullName: string, set: IconSet | undefined, size?: { width?: number; height?: number }): ImageDetails | undefined {
  const [prefix, name] = fullName.split(":");
  if (!prefix || !name) return undefined;
  const grid = Array.isArray(set?.height) ? set?.height[0] : set?.height;
  const width = size?.width ?? grid;
  const height = size?.height ?? grid;
  const url = svgUrl(prefix, name);
  const words = name.split("-").filter((w) => !/^\d+$/.test(w));
  const image = makeImage({
    provider: "iconify",
    nativeId: fullName,
    title: `${words.join(" ")} (${set?.name ?? prefix})`,
    url: `${SITE}/${prefix}/${name}/`,
    author: set?.author?.name,
    authorUrl: set?.author?.url,
    tags: [...words, set?.name ?? prefix, ...(set?.category ? [set.category] : [])],
    category: "icons",
    categoryEvidence: { by: "source", confidence: 1 },
    styles: ["icon", "vector", "transparent"],
    vector: true,
    transparent: true,
    width,
    height,
    thumbnailUrl: url,
    previewUrl: url,
    formats: ["svg"],
    license: licenseOf(set),
    price: { free: true },
    downloadable: true,
    sourceName: SOURCE_NAME,
  });
  return {
    ...image,
    files: [{ url, filename: `${prefix}-${name}.svg`, format: "svg", mime: "image/svg+xml", role: "original", width, height }],
  };
}

async function setInfo(prefix: string, ctx: ProviderContext): Promise<IconSet | undefined> {
  const res = await ctx.fetch.json<Record<string, IconSet>>(`${API}/collections${qs({ prefix })}`, { cacheTtlMs: 24 * 60 * 60_000, signal: ctx.signal });
  return res[prefix];
}

export const iconify: Provider = {
  id: "iconify",
  name: SOURCE_NAME,
  homepage: "https://iconify.design",
  description:
    "About 470k open-source icons in 280 sets (Material Symbols, Tabler, Lucide, Phosphor, Font Awesome Free…). Every icon an SVG with a transparent background; licence per set (mostly MIT, Apache 2.0 and CC BY).",
  categories: ["icons"],
  access: "api",
  pricing: "free",
  supportsDownload: true,
  nativeFilters: ["categories", "transparent", "formats", "freeOnly"],

  buildSearchUrl(q) {
    return `${SITE}/${qs({ query: q.query.trim() || undefined })}`;
  },

  async search(q, ctx) {
    // Icons answer icon-shaped queries only: a photo or painting search skips them.
    if (q.styles?.length && !q.styles.some((s) => s === "icon" || s === "vector" || s === "transparent")) return { images: [], total: 0, searchUrl: this.buildSearchUrl(q) };
    if (q.formats?.length && !q.formats.includes("svg")) return { images: [], total: 0, searchUrl: this.buildSearchUrl(q) };
    const query = q.query.trim();
    if (!query) return { images: [], total: 0, searchUrl: this.buildSearchUrl(q) };
    const n = Math.max(1, Math.min(q.limit, MAX_PAGE_SIZE));
    const offset = q.offset ?? 0;
    const url = `${API}/search${qs({ query, start: offset || undefined, limit: Math.max(MIN_LIMIT, offset + n) })}`;
    const res = await ctx.fetch.json<IconifySearch>(url, { cacheTtlMs: 60 * 60_000, signal: ctx.signal });
    const images: ImageAsset[] = [];
    for (const icon of (res.icons ?? []).slice(0, n)) {
      const prefix = icon.split(":")[0]!;
      const d = toImage(icon, res.collections?.[prefix]);
      if (!d) continue;
      const { files: _files, ...image } = d;
      images.push(image);
    }
    return { images, total: res.total, searchUrl: this.buildSearchUrl(q) };
  },

  async getImage(nativeId, ctx) {
    const m = /^([a-z0-9-]+):([a-z0-9-]+)$/.exec(nativeId);
    if (!m) return null;
    const [, prefix, name] = m as unknown as [string, string, string];
    const [set, data] = await Promise.all([
      setInfo(prefix, ctx),
      ctx.fetch.json<IconData | 404>(`${API}/${prefix}.json${qs({ icons: name })}`, { cacheTtlMs: 24 * 60 * 60_000, signal: ctx.signal }),
    ]);
    if (!set || data === 404 || !data.icons?.[name]) return null;
    const icon = data.icons[name]!;
    return toImage(nativeId, set, { width: icon.width ?? data.width, height: icon.height ?? data.height }) ?? null;
  },

  async census(ctx): Promise<SourceCensus> {
    const sets = await ctx.fetch.json<Record<string, IconSet>>(`${API}/collections`, { signal: ctx.signal, cacheTtlMs: 0 });
    const byLicense: Record<string, number> = {};
    const categories: Record<string, number> = {};
    let total = 0;
    for (const s of Object.values(sets)) {
      if (s.hidden) continue;
      const n = s.total ?? 0;
      total += n;
      const lic = s.license?.spdx || "unknown";
      byLicense[lic] = (byLicense[lic] ?? 0) + n;
      if (s.category) categories[s.category] = (categories[s.category] ?? 0) + n;
    }
    return {
      total,
      free: total,
      byCategory: { icons: total },
      byLicense,
      categories,
      method: "api.iconify.design /collections: `total` per icon set, summed",
    };
  },
};
