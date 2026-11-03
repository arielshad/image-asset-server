/**
 * Collections (/collections/<slug>): curated topic pages built from a topic file
 * (src/content/collections/<slug>.md) and its saved search results
 * (src/data/collections/<slug>.json, refreshed by scripts/snapshot-collections.mjs).
 * Hubs (/collections/<hub>) group them by kind of image; source pages
 * (/sources/<id>) show what each site contributes. A topic whose snapshot
 * is missing still builds: an empty, noindex page that links to the live search.
 */
import { getCollection, type CollectionEntry } from "astro:content";
import hubsJson from "@/data/collection-hubs.json";
import sourceNotes from "@/data/source-notes.json";
import { CATALOG, type CatalogSource } from "./catalog";
import { PROVIDERS, SITE, type Provider } from "./site";
import { categoryLabel, verdictTone } from "./vocab";

/** Same thresholds as src/core/collections.ts (MIN_INDEXABLE, MIN_SOURCES). */
const MIN_INDEXABLE = 12;
const MIN_SOURCES = 2;

/** One saved search result (src/core/collections.ts SnapshotImage). */
export interface SnapshotImage {
  id: string;
  provider: string;
  title: string;
  category: string;
  styles?: string[];
  url: string;
  /** Grid thumbnail (https), loaded from the source. */
  thumbnailUrl?: string;
  /** Display-size version (https), loaded from the source. */
  previewUrl?: string;
  author?: string;
  license?: { id: string; name: string; url?: string; verdict: string; attributionRequired?: boolean; editorial?: boolean };
  free?: boolean;
  formats?: string[];
  orientation?: string;
  width?: number;
  height?: number;
  vector?: boolean;
  transparent?: boolean;
  year?: number;
  downloadable: boolean;
}

interface Snapshot {
  slug: string;
  updatedAt: string;
  images?: SnapshotImage[];
}

export interface Hub {
  id: string;
  name: string;
  title: string;
  description: string;
  intro: string;
  /** What the hub covers (from collection-hubs.json). */
  categories?: string[];
  styles?: string[];
  orientations?: string[];
  aliases?: string[];
  /** Editorial sections shown under the collections (plain text). */
  sections?: { heading: string; body: string }[];
  /** Questions answered on the hub (FAQPage JSON-LD). */
  faq?: { q: string; a: string }[];
  /** Guides (src/content/guides slugs) linked from the hub. */
  guides?: string[];
}

export type Topic = CollectionEntry<"collections">;

export interface Collection {
  slug: string;
  path: string;
  topic: Topic;
  hub: Hub;
  images: SnapshotImage[];
  updatedAt?: Date;
  indexable: boolean;
  sources: { id: string; name: string; count: number }[];
  facts: { cleared: number; free: number; direct: number; editorial: number; hd: number; licences: { name: string; count: number }[] };
}

export const HUBS = hubsJson as Hub[];

const snapshots = import.meta.glob<Snapshot>("../data/collections/*.json", { eager: true, import: "default" });
const snapshotOf = (slug: string) => snapshots[`../data/collections/${slug}.json`];

export const COLLECTIONS_PATH = "/collections";
export const collectionPath = (slug: string) => `${COLLECTIONS_PATH}/${slug}`;
export const hubPath = (hub: Hub) => `${COLLECTIONS_PATH}/${hub.id}`;
export const sourcePath = (id: string) => `/sources/${id}`;

export function providerName(id: string): string {
  return PROVIDERS.find((p) => p.id === id)?.name ?? id;
}

const synthesized = new Map<string, Hub>();
/** The hub a topic belongs to. A topic naming a hub that collection-hubs.json lacks gets a plain one (and a build warning). */
export function hubById(id: string): Hub {
  const hub = HUBS.find((h) => h.id === id) ?? synthesized.get(id);
  if (hub) return hub;
  console.warn(`collections: unknown hub "${id}" (add it to src/data/collection-hubs.json)`);
  const name = categoryLabel(id) || id.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  const made: Hub = { id, name, title: `Free ${name.toLowerCase()} images`, description: `Free ${name.toLowerCase()} images from many sites, with the licence verdict on every image.`, intro: "" };
  synthesized.set(id, made);
  return made;
}

function build(topic: Topic): Collection {
  const snap = snapshotOf(topic.id);
  const images = snap?.images ?? [];
  const counts = new Map<string, number>();
  for (const a of images) counts.set(a.provider, (counts.get(a.provider) ?? 0) + 1);
  const sources = [...counts].map(([id, count]) => ({ id, name: providerName(id), count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const licenceCounts = new Map<string, number>();
  for (const a of images) if (a.license) licenceCounts.set(a.license.name, (licenceCounts.get(a.license.name) ?? 0) + 1);
  return {
    slug: topic.id,
    path: collectionPath(topic.id),
    topic,
    hub: hubById(topic.data.hub),
    images,
    updatedAt: snap ? new Date(snap.updatedAt) : undefined,
    indexable: images.length >= MIN_INDEXABLE && sources.length >= MIN_SOURCES,
    sources,
    facts: {
      cleared: images.filter((a) => verdictTone(a.license?.verdict) === "green").length,
      free: images.filter((a) => a.free !== false).length,
      direct: images.filter((a) => a.downloadable).length,
      editorial: images.filter((a) => a.license?.editorial).length,
      hd: images.filter((a) => a.width && a.height && Math.min(a.width, a.height) >= 1080 * 0.97).length,
      licences: [...licenceCounts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    },
  };
}

let cache: Collection[] | undefined;

const hubOrder = (h: Hub) => {
  const i = HUBS.indexOf(h);
  return i === -1 ? HUBS.length : i;
};

/** Every collection, in hub order, then by title. */
export async function allCollections(): Promise<Collection[]> {
  if (cache) return cache;
  const topics = await getCollection("collections");
  cache = topics.map(build).sort((a, b) => hubOrder(a.hub) - hubOrder(b.hub) || a.topic.data.title.localeCompare(b.topic.data.title));
  return cache;
}

/** Hubs that have at least one collection, plus every hub listed in collection-hubs.json. */
export async function allHubs(): Promise<Hub[]> {
  const all = await allCollections();
  const used = [...new Set(all.map((c) => c.hub))];
  return [...HUBS, ...used.filter((h) => !HUBS.includes(h))];
}

export async function collectionsInHub(hub: Hub): Promise<Collection[]> {
  return (await allCollections()).filter((c) => c.hub.id === hub.id);
}

/** A collection's related pages: its own picks first, then others in the same hub. */
export async function relatedTo(c: Collection, n = 6): Promise<Collection[]> {
  const all = await allCollections();
  const picked = c.topic.data.related.map((s) => all.find((x) => x.slug === s)).filter((x): x is Collection => Boolean(x));
  const more = all.filter((x) => x.hub.id === c.hub.id && x.slug !== c.slug && !picked.includes(x));
  return [...picked, ...more].slice(0, n);
}

/** Latest content change among collections (for hub and index pages). */
export function latest(cs: Collection[]): Date | undefined {
  const times = cs.map((c) => c.updatedAt?.getTime()).filter((t): t is number => t !== undefined);
  return times.length ? new Date(Math.max(...times)) : undefined;
}

type Search = Topic["data"]["search"];

function searchParams(s: Search): URLSearchParams {
  const p = new URLSearchParams({ q: s.q });
  if (s.categories?.length) p.set("category", s.categories.join(","));
  if (s.styles?.length) p.set("style", s.styles.join(","));
  if (s.orientations?.length) p.set("orientation", s.orientations.join(","));
  if (s.minResolution) p.set("min_resolution", String(s.minResolution));
  if (s.commercial) p.set("commercial", "true");
  if (s.free) p.set("free", "true");
  if (s.downloadable) p.set("downloadable", "true");
  if (s.providers?.length) p.set("providers", s.providers.join(","));
  return p;
}

/** Same search in the web app: /search?q=ocean+waves&category=nature.ocean&commercial=true */
export const searchHref = (s: Search) => `/search?${searchParams(s)}`;

/** Same search on the REST API, as an absolute URL for curl. */
export const apiHref = (s: Search) => `${SITE.url}/v1/search?${searchParams(s)}`;

/** "36 images" */
export function countLabel(images: SnapshotImage[]): string {
  return `${images.length} ${images.length === 1 ? "image" : "images"}`;
}

export const dateFmt = new Intl.DateTimeFormat("en", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

/** Editorial notes for a source page (src/data/source-notes.json). */
export interface SourceNotes {
  about: string;
  bestFor: string;
  licence: string;
  searching: string;
  examples: { label: string; q: string; category?: string; commercial?: boolean }[];
  guides?: string[];
}

export const SOURCE_NOTES = sourceNotes as Record<string, SourceNotes>;

/** A live search on one source, for the source page's example links. */
export function sourceSearchHref(id: string, e: { q: string; category?: string; commercial?: boolean }): string {
  const p = new URLSearchParams({ q: e.q });
  if (e.category) p.set("category", e.category);
  if (e.commercial) p.set("commercial", "true");
  p.set("providers", id);
  return `/search?${p}`;
}

export interface SourcePage {
  provider: Provider;
  notes?: SourceNotes;
  census?: CatalogSource;
  /** Collections with at least one image from this source, and how many. */
  collections: { collection: Collection; count: number }[];
  /** Some of its images from those collections (one per collection first). */
  images: SnapshotImage[];
  indexable: boolean;
}

export async function sourcePages(): Promise<SourcePage[]> {
  const all = await allCollections();
  return PROVIDERS.map((provider) => {
    const census = CATALOG.sources.find((s) => s.id === provider.id);
    const featured = all
      .map((collection) => ({ collection, count: collection.images.filter((a) => a.provider === provider.id).length }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count);
    const seen = new Set<string>();
    const images: SnapshotImage[] = [];
    // Round-robin over the collections so the selection shows the source's range.
    for (let round = 0; images.length < 12 && round < 12; round++) {
      for (const { collection } of featured) {
        const a = collection.images.filter((x) => x.provider === provider.id)[round];
        if (a && !seen.has(a.id) && images.length < 12) {
          seen.add(a.id);
          images.push(a);
        }
      }
    }
    // A link-only site (no census, nothing in any collection) has too little of its own to index;
    // a searched source with its own editorial notes has enough (same rule in integrations/sitemap-meta.mjs).
    const notes = SOURCE_NOTES[provider.id];
    return { provider, notes, census, collections: featured, images, indexable: Boolean(census) || images.length >= 4 || (provider.access !== "link" && Boolean(notes)) };
  });
}
