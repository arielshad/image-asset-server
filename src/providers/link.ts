import type { Category, ImageQuery, License, Pricing, Provider } from "../core/types.js";

export interface LinkProviderSpec {
  id: string;
  name: string;
  homepage: string;
  description: string;
  categories: Category[];
  pricing: Pricing;
  license?: License;
  /** Env var of the source's own API key, when it has an API we could use later. */
  apiKeyEnv?: string;
  buildSearchUrl(q: ImageQuery): string;
}

/**
 * Provider for sites we only deep-link to: paid or partner-only APIs, APIs
 * that need a key we don't have yet, bot walls, or terms that forbid
 * aggregation or automated access. Search returns no images, only a link to
 * the same search on the site, so agents and people can continue there.
 */
export function linkProvider(spec: LinkProviderSpec): Provider {
  return {
    ...spec,
    access: "link",
    supportsDownload: false,
    async search(q) {
      return { images: [], searchUrl: spec.buildSearchUrl(q) };
    },
  };
}

/** The words to put in a site's search box (the facts we parsed out are added back as words where they help). */
export function linkTerms(q: ImageQuery, opts: { orientation?: boolean; resolution?: boolean; transparent?: boolean } = {}): string {
  const parts = [q.query.trim()];
  if (opts.orientation !== false && q.orientations?.length === 1 && q.orientations[0] !== "landscape") parts.push(q.orientations[0] === "portrait" ? "vertical" : "square");
  if (opts.resolution !== false && q.minResolution && q.minResolution >= 2160) parts.push("4k");
  if (opts.transparent !== false && q.transparent) parts.push("transparent");
  return parts.filter(Boolean).join(" ");
}

/** The kind the query asks for, for sites that keep photos, vectors and icons apart. */
export function wantedKind(q: Pick<ImageQuery, "styles" | "formats">): "photo" | "vector" | "illustration" | "icon" | undefined {
  const s = q.styles ?? [];
  if (s.includes("icon")) return "icon";
  if (s.includes("vector") || (q.formats?.length === 1 && q.formats[0] === "svg")) return "vector";
  if (s.includes("illustration")) return "illustration";
  if (s.includes("photo")) return "photo";
  return undefined;
}

/** "drone ocean sunset" → "drone-ocean-sunset" (path-style search URLs). */
export function slug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}
