/**
 * Head metadata for share links to /search:
 * - query variants (/search?q=mountain+lake, /search?category=art.painting&orientation=portrait)
 *   get a unique title, description and share card (/og/query.png?…);
 * - image links (/search?image=nasa:…) get the image's title, a generated
 *   description and a card with its thumbnail (/og/image.png?id=…).
 * Both are `noindex, follow`: they are share targets, not landing pages.
 */
import { VERDICT_LABELS } from "../core/licence.js";
import type { ImageDetails } from "../core/types.js";
import { CATEGORIES, ORIENTATIONS, categoryLabel, type Category, type Orientation } from "../core/vocab.js";
import { allProviders } from "../providers/index.js";

const SITES = `${allProviders.length} sites`;

/** Top-level categories read better with their own nouns. */
const TOP_NOUNS: Record<string, [string, string]> = {
  background: ["background", "backgrounds & textures"],
  icons: ["icon", "icons"],
  art: ["artwork", "artworks"],
  "art.painting": ["painting", "paintings"],
  "art.drawing": ["drawing or print", "drawings & prints"],
  archive: ["historical image", "historical images"],
  "archive.map": ["map", "maps"],
  "archive.poster": ["poster", "posters & ephemera"],
  other: ["image", "images"],
};

/** Mid-sentence noun: "ocean & beach images", "paintings", "icons". */
export function categoryNoun(id: string | undefined, plural = true): string {
  if (!id) return plural ? "images" : "image";
  const top = TOP_NOUNS[id];
  if (top) return plural ? top[1] : top[0];
  const label = categoryLabel(id).toLowerCase();
  return `${label} ${plural ? "images" : "image"}`;
}

/** "Commercial use OK" → "commercial use OK" (keeps acronyms). */
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const providerName = (id: string) => allProviders.find((p) => p.id === id)?.name ?? id;
const FEATURED = ["NASA", "Wikimedia Commons", "The Met", "Openverse"];
/** Search engines show about this much of a title and a description. */
export const MAX_TITLE = 70;
export const MAX_DESCRIPTION = 160;

export interface HeadMeta {
  title: string;
  description: string;
  robots: string;
  /** Root-relative share card path. */
  image?: string;
  imageAlt?: string;
}

export interface SearchShare {
  /** Normalised query string identifying the card (also its cache key). */
  key: string;
  kicker: string;
  title: string;
  subtitle: string;
  chips: string[];
}

function categoriesOf(params: URLSearchParams): Category[] {
  return (params.get("category") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter((t): t is Category => (CATEGORIES as readonly string[]).includes(t))
    .slice(0, 4);
}

/** Normalise /search parameters to the few that change what a share card says. */
export function searchShare(params: URLSearchParams): SearchShare | undefined {
  const q = truncate((params.get("q") ?? "").replace(/\s+/g, " ").trim(), 80);
  const cats = categoriesOf(params);
  const free = params.get("free") === "true";
  const commercial = params.get("commercial") === "true";
  const downloadable = params.get("downloadable") === "true";
  const orientation = ORIENTATIONS.find((o) => o === params.get("orientation")) as Orientation | undefined;
  const res = /^(720|1080|1440|2160|4k|hd|fhd)$/i.test(params.get("min_resolution") ?? "") ? params.get("min_resolution")!.toLowerCase() : undefined;
  const sources = (params.get("providers") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => allProviders.some((p) => p.id === s))
    .slice(0, 6);
  if (!q && !cats.length && !free && !commercial) return undefined;

  const k = new URLSearchParams();
  if (q) k.set("q", q);
  if (cats.length) k.set("category", cats.join(","));
  if (orientation) k.set("orientation", orientation);
  if (res) k.set("min_resolution", res);
  if (free) k.set("free", "true");
  if (commercial) k.set("commercial", "true");
  if (downloadable) k.set("downloadable", "true");
  if (sources.length) k.set("providers", sources.join(","));

  const what = cats.length ? cats.map((c) => categoryNoun(c)).join(" & ") : "images";
  const kind = `${free ? "free " : ""}${what}`;
  const Kind = `${kind[0]!.toUpperCase()}${kind.slice(1)}`;
  return {
    key: k.toString(),
    kicker: cats.length ? `Search · ${what}` : "Search",
    title: q ? `“${q}”` : Kind,
    subtitle: `${Kind} from ${sources.length ? sources.map(providerName).join(", ") : SITES}, with licences and direct downloads.`,
    chips: [
      ...(res ? [res === "2160" || res === "4k" ? "4K+" : `${res.replace(/^(\d+)$/, "$1 px+")}`] : []),
      ...(orientation ? [orientation === "portrait" ? "Vertical" : orientation === "square" ? "Square" : "Landscape"] : []),
      ...(commercial ? ["Commercial use OK"] : []),
      ...(free ? ["Free only"] : []),
      ...(downloadable ? ["Direct download"] : []),
      ...(sources.length ? sources.map(providerName) : FEATURED),
    ].slice(0, 6),
  };
}

export function searchMeta(params: URLSearchParams): HeadMeta | undefined {
  const share = searchShare(params);
  if (!share) return undefined;
  const q = (params.get("q") ?? "").replace(/\s+/g, " ").trim();
  const cats = categoriesOf(params);
  const free = params.get("free") === "true";
  const what = cats.length ? cats.map((c) => categoryNoun(c)).join(" & ") : "images";
  const kind = `${free ? "free " : ""}${what}`;
  const title = q ? `“${truncate(q, 40)}”: ${kind} · Image Asset Server` : `${kind[0]!.toUpperCase()}${kind.slice(1)}: search ${SITES} · Image Asset Server`;
  const description = q
    ? `Search results for “${truncate(q, 60)}” across ${SITES}: ${kind} with licences and direct downloads from NASA, Wikimedia Commons, museums and more.`
    : `Browse ${kind} from ${SITES} at once: check the licence and download the size you need.`;
  return {
    title: imageTitle(title),
    description: truncate(description, MAX_DESCRIPTION),
    robots: "noindex, follow",
    image: `/og/query.png?${share.key}`,
    imageAlt: `${share.title}: ${share.subtitle}`,
  };
}

/** ImageAsset ids look like `provider:nativeId` with a provider this server runs; reject anything else before touching a source. */
export function shareableImageId(raw: string | null | undefined, providerIds: readonly string[]): string | undefined {
  if (!raw || raw.length > 300) return undefined;
  const i = raw.indexOf(":");
  if (i <= 0 || i === raw.length - 1) return undefined;
  return providerIds.includes(raw.slice(0, i)) ? raw : undefined;
}

/** "Paintings · 4096 × 3072 · vertical · 1887" */
export function imageFacts(a: Pick<ImageDetails, "category" | "width" | "height" | "orientation" | "vector" | "transparent" | "year">): string[] {
  return [
    categoryLabel(a.category),
    a.vector ? "vector (SVG)" : a.width && a.height ? `${a.width} × ${a.height}` : undefined,
    a.orientation && a.orientation !== "landscape" ? (a.orientation === "portrait" ? "vertical" : "square") : undefined,
    a.transparent ? "transparent" : undefined,
    a.year ? String(a.year) : undefined,
  ].filter((x): x is string => !!x);
}

/** Keep a page title within MAX_TITLE, shortening the quoted part first. */
function imageTitle(t: string): string {
  if (t.length <= MAX_TITLE) return t;
  const m = t.match(/^“(.*)”(.*)$/);
  if (m) {
    const short = `“${truncate(m[1]!, Math.max(12, MAX_TITLE - m[2]!.length - 2))}”${m[2]}`;
    if (short.length <= MAX_TITLE) return short;
  }
  return truncate(t, MAX_TITLE);
}

export function imageMeta(a: ImageDetails): HeadMeta {
  const source = providerName(a.provider);
  const noun = categoryNoun(a.category, false);
  // "<title>: painting on The Met · Image Asset Server", dropping the source and then
  // shortening the image title when it would run past MAX_TITLE.
  const tail = [`: ${noun} on ${source} · Image Asset Server`, `: ${noun} · Image Asset Server`].find((x) => a.title.length + x.length <= MAX_TITLE) ?? `: ${noun} · Image Asset Server`;
  const name = truncate(a.title, Math.max(20, MAX_TITLE - tail.length));
  const facts = [
    ...imageFacts(a).slice(1),
    a.license ? `${a.license.name}: ${lowerFirst(VERDICT_LABELS[a.license.verdict])}` : undefined,
    a.price ? (a.price.free ? "free" : "paid") : undefined,
  ].filter(Boolean);
  const lead = `${noun[0]!.toUpperCase()}${noun.slice(1)} “${truncate(a.title, 60)}” on ${source}${a.author ? ` by ${truncate(a.author, 40)}` : ""}`;
  const core = `${lead}${facts.length ? ` (${facts.join(", ")})` : ""}.`;
  return {
    title: `${name}${tail}`,
    description: [`${core} Check the licence and download it via Image Asset Server.`].find((d) => d.length <= MAX_DESCRIPTION) ?? truncate(core, MAX_DESCRIPTION),
    robots: "noindex, follow",
    image: `/og/image.png?id=${encodeURIComponent(a.id)}`,
    imageAlt: `${a.title}: ${noun} on ${source}`,
  };
}
