/**
 * Shared domain model for every image source.
 *
 * Providers translate their native data into these shapes so the aggregator,
 * HTTP API and MCP server never need to know which site a image came from.
 */
import type { Category, ImageStyle, Orientation } from "./vocab.js";

export type { Category, ImageStyle, Orientation, ResolutionTier } from "./vocab.js";

/**
 * How a provider is reached.
 * - api:    official/public JSON API, structured metadata and often direct files
 * - static: curated catalogue built from manifest files, filtered locally
 * - scrape: HTML pages parsed into images
 * - link:   no usable API, a paid/partner API, or terms that forbid automated
 *           access or aggregation; we only build deep search links
 */
export type AccessMethod = "api" | "static" | "scrape" | "link";

/** Pricing model of a source as a whole. */
export type Pricing = "free" | "freemium" | "paid";

/**
 * Can this go into something you publish commercially (an ad, a product,
 * a website, a client project)?
 * - yes:                 no conditions (CC0, public domain, free stock licence without credit)
 * - yes-with-credit:     yes, if you credit the author or source (CC BY, NASA)
 * - restricted:          conditions that usually rule out a normal project (share-alike)
 * - clearance-required:  needs a paid licence or model/property releases per use
 * - check-terms:         unknown or uploader-asserted: read the terms first
 * - no:                  non-commercial only (CC BY-NC, ND, personal-use licences)
 */
export const COMMERCIAL_VERDICTS = ["yes", "yes-with-credit", "restricted", "clearance-required", "check-terms", "no"] as const;
export type CommercialVerdict = (typeof COMMERCIAL_VERDICTS)[number];

export interface License {
  /** SPDX id where one exists (CC0-1.0, CC-BY-4.0, CC-BY-NC-4.0…), else a `LicenseRef-*` id. */
  id: string;
  /** Short human name, e.g. "CC BY 4.0", "Public domain (NASA)". */
  name: string;
  url?: string;
  commercialUse?: boolean;
  attributionRequired?: boolean;
  shareAlike?: boolean;
  /** May the image itself be passed on (re-uploaded, put in a pack or dataset)? */
  redistribution?: boolean;
  /**
   * Fine for news, documentary and education, but not cleared for advertising
   * or endorsement: identifiable people, logos, insignia or brands appear
   * without releases (NASA's insignia and astronauts, historic newsreels).
   */
  editorial?: boolean;
  /**
   * Who states the licence:
   * - source:   the site or institution records it per item (Wikimedia, NASA, Prelinger)
   * - site:     one licence for the whole site
   * - uploader: an anonymous uploader asserted it, unverified (most of Internet Archive)
   */
  assertedBy: "source" | "site" | "uploader";
  verdict: CommercialVerdict;
  /** One line on why the verdict is what it is. */
  note?: string;
}

export interface Price {
  free: boolean;
  amount?: number;
  currency?: string;
}

export interface ImageAsset {
  /** Globally unique id: `${provider}:${nativeId}`. */
  id: string;
  provider: string;
  nativeId: string;
  title: string;
  description?: string;
  /** Human-facing page for the image on the source site. */
  url: string;
  author?: string;
  /** Link to the author's page on the source site. */
  authorUrl?: string;
  tags: string[];
  /** Dot-path category ("nature.ocean", "art.painting"). Filled by the classifier when the source has none. */
  category: Category;
  /** How the category was decided and how sure we are (0..1). */
  categoryEvidence?: { by: "source" | "rules"; confidence: number };
  /** Photo, painting, drawing, illustration, vector, icon, transparent, black-white. */
  styles?: ImageStyle[];
  orientation?: Orientation;
  /** Pixel size of the largest version the source offers (vectors: their view box). */
  width?: number;
  height?: number;
  /** True for scalable vector art (SVG): any size, no pixel limit. */
  vector?: boolean;
  /** True when the image has a transparent background (PNG/SVG cut-outs, icons). */
  transparent?: boolean;
  /** Year the work was made, for art and archive images. */
  year?: number;
  /**
   * A small version (≈ 200–400 px) for result grids. Loaded by the browser
   * straight from the source; this server never proxies image bytes.
   */
  thumbnailUrl?: string;
  /** A display-size version (≈ 800–1600 px) for the detail view, also straight from the source. */
  previewUrl?: string;
  /** Formats known to be available (lowercase, no dot): jpg, png, svg, tif… */
  formats?: string[];
  license?: License;
  /** Ready-to-paste credit line when the licence asks for attribution. */
  attribution?: string;
  price?: Price;
  /** True when getting the full-quality file needs an account on the source site. */
  requiresAccount?: boolean;
  /** True when `getImage` can return direct file URLs. */
  downloadable: boolean;
  createdAt?: string;
  /** Views or downloads on the source, when published. */
  popularity?: number;
  /** Ids of the same image on other providers (a NASA photo also uploaded to Commons). */
  sameAs?: string[];
  /** Relevance score assigned by the aggregator (0..1). */
  score?: number;
}

export interface ImageFile {
  url: string;
  filename: string;
  /** Lowercase format without the dot: jpg, png, webp, svg, tif… */
  format: string;
  /** MIME type when the source states it. */
  mime?: string;
  /**
   * - original:  the full-quality master as published
   * - rendition: a resized copy (Wikimedia thumbnails, IIIF sizes, NASA "large")
   * - thumbnail: a small copy for browsing
   */
  role: "original" | "rendition" | "thumbnail";
  width?: number;
  height?: number;
  sizeBytes?: number;
  /** True when the URL needs the user to be logged in / pay on the source site. */
  requiresAuth?: boolean;
  /**
   * Extra request headers the download needs. The HTTP API and MCP never
   * return `headers` to clients; local downloads use them.
   */
  headers?: Record<string, string>;
}

export interface ImageDetails extends ImageAsset {
  files: ImageFile[];
}

export interface ImageFilters {
  /** Restrict to these categories; a parent ("nature") matches its children. */
  categories?: Category[];
  /** Kind and look: photo, painting, vector, icon, transparent… */
  styles?: ImageStyle[];
  orientations?: Orientation[];
  /** Minimum short side in pixels: 720, 1080, 1440, 2160. Vectors always pass. */
  minResolution?: number;
  /** Only images with a transparent background. */
  transparent?: boolean;
  /** Only these formats (jpg, png, svg…). */
  formats?: string[];
  /** Only images whose licence verdict is yes or yes-with-credit. */
  commercialOnly?: boolean;
  /** Exclude paid images. */
  freeOnly?: boolean;
}

export interface ImageQuery extends ImageFilters {
  /** Free-text query, with size/orientation/format words already parsed out. May be empty to browse. */
  query: string;
  /** Category hints from the query words (used to steer native category filters, not to drop results). */
  hints?: Category[];
  /** Max results per provider. */
  limit: number;
  /** Page offset per provider (0-based item offset). */
  offset?: number;
}

export interface ProviderSearchResult {
  images: ImageAsset[];
  /** Total hits reported by the source if known. */
  total?: number;
  /** Link to the same search on the source website. */
  searchUrl?: string;
}

/** Filters a provider applies itself; the aggregator applies the rest locally. */
export type NativeFilter = "categories" | "styles" | "orientation" | "resolution" | "transparent" | "formats" | "commercialOnly" | "freeOnly";

export interface ProviderInfo {
  id: string;
  name: string;
  homepage: string;
  description: string;
  /** Top-level categories the source carries. */
  categories: Category[];
  access: AccessMethod;
  pricing: Pricing;
  /** Default licence for the source's images, if uniform. */
  license?: License;
  /** Env var holding an optional/required API key. */
  apiKeyEnv?: string;
  /** Whether this server can hand out direct file URLs for images of this provider. */
  supportsDownload: boolean;
  /** Filters the provider applies at the source. */
  nativeFilters?: NativeFilter[];
}

/** One "notable" image a census can point at (most viewed, newest…). */
export interface CensusHighlight {
  label: string;
  title: string;
  url: string;
  value?: number;
}

/**
 * What a source holds, counted by `Provider.census` (run daily, see
 * scripts/census.mjs). Every count is the source's own number of listings,
 * read from search totals: never a crawl.
 */
export interface SourceCensus {
  /** Every image listing on the source (free and paid). */
  total: number;
  /** True when a number is a lower bound (the source caps its counts). */
  atLeast?: boolean;
  /** Free listings, when known. */
  free?: number;
  /** Listings per top-level category; each listing counts once. */
  byCategory: Partial<Record<Category, number>>;
  /** Listings per licence id, when the source mixes licences. */
  byLicense?: Record<string, number>;
  /** The source's own collections or tags (may overlap). */
  categories?: Record<string, number>;
  /** Listings released in the 30 days before the count, when the source dates them. */
  addedLast30Days?: number;
  /** Total views or downloads, when the source publishes them. */
  downloads?: number;
  highlights?: CensusHighlight[];
  /** One line on how this was counted. */
  method: string;
  /** The source re-indexes other sources: it is listed, but left out of the catalogue totals. */
  mirror?: boolean;
}

export interface ProviderContext {
  fetch: HttpClient;
  signal?: AbortSignal;
  /** Per-request credentials a caller passed in. Never logged. */
  credentials?: Record<string, string>;
}

export interface Provider extends ProviderInfo {
  /** Search the source. Link-only providers return an empty list plus `searchUrl`. */
  search(query: ImageQuery, ctx: ProviderContext): Promise<ProviderSearchResult>;
  /** Fetch full details, including every file and rendition when possible. */
  getImage?(nativeId: string, ctx: ProviderContext): Promise<ImageDetails | null>;
  /** Deep link to run the query on the source website. */
  buildSearchUrl(query: ImageQuery): string;
  /** Count what the source holds (a few requests; run daily, not per search). */
  census?(ctx: ProviderContext): Promise<SourceCensus>;
  /** Whether the provider is usable right now (e.g. API key configured). */
  isEnabled?(): boolean;
}

export interface HttpClient {
  json<T = unknown>(url: string, init?: HttpRequestInit): Promise<T>;
  text(url: string, init?: HttpRequestInit): Promise<string>;
  raw(url: string, init?: HttpRequestInit): Promise<Response>;
}

export interface HttpRequestInit {
  headers?: Record<string, string>;
  method?: string;
  body?: string;
  signal?: AbortSignal;
  /** Cache TTL in ms for GET/POST-JSON responses (text/json only). 0 disables. */
  cacheTtlMs?: number;
  /** Cache a body only when this returns true (APIs that report errors with HTTP 200). */
  cacheIf?: (body: string) => boolean;
  /** For `raw` downloads: abort when no bytes arrive for this long (ms), instead of capping the whole transfer. */
  idleTimeoutMs?: number;
  /** Override the client's request timeout (ms) for a slow source. */
  timeoutMs?: number;
  /** "manual" returns 3xx responses instead of following them (downloads re-check every hop). */
  redirect?: "follow" | "manual";
}
