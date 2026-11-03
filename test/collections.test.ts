import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { MIN_INDEXABLE, MIN_SOURCES, isIndexable, searchKey as coreSearchKey, selectImages, snapshotCollection, toSnapshotImage, type CollectionSearch, type CollectionSnapshot, type SnapshotImage } from "../src/core/collections.js";
import { setHostResolver, assertPublicHost } from "../src/core/download.js";
import { creativeCommons, license } from "../src/core/licence.js";
import type { SearchResponse } from "../src/core/service.js";
import type { Pricing, ImageAsset } from "../src/core/types.js";
import { makeImage } from "../src/core/util.js";
import { allProviders } from "../src/providers/index.js";
// @ts-expect-error plain .mjs module without type declarations
import { CATEGORIES, readHubs, readSnapshot, readTopics, searchKey, topicErrors } from "../scripts/lib/topics.mjs";
// @ts-expect-error plain .mjs module without type declarations
import { checkPreview, isMediaType, previewChecker } from "../scripts/snapshot-collections.mjs";

const pricing = new Map<string, Pricing>([
  ["commons", "free"],
  ["stock", "freemium"],
  ["paid", "freemium"],
]);

const image = (provider: string, n: number, over: Partial<ImageAsset> = {}): ImageAsset =>
  makeImage({
    provider,
    nativeId: `${provider}-${n}`,
    title: `Ocean waves ${provider} ${n}`,
    category: "nature.ocean",
    tags: [],
    url: `https://${provider}.example/${n}`,
    thumbnailUrl: `https://cdn.${provider}.example/${n}.jpg`,
    previewUrl: `https://cdn.${provider}.example/${n}-1280.jpg`,
    license: license("CC0-1.0"),
    downloadable: true,
    ...over,
  });

const search: CollectionSearch = { q: "waves", categories: ["nature.ocean"], free: true };

describe("toSnapshotImage", () => {
  it("keeps what a page shows, with the licence verdict and image facts", () => {
    const s = toSnapshotImage(image("commons", 1, { width: 3840, height: 2160, transparent: true, year: 2020, styles: ["painting"], description: "the source's copy", license: { ...license("CC0-1.0"), editorial: true } }))!;
    expect(s).toMatchObject({
      id: "commons:commons-1",
      category: "nature.ocean",
      styles: ["painting", "transparent"],
      thumbnailUrl: "https://cdn.commons.example/1.jpg",
      previewUrl: "https://cdn.commons.example/1-1280.jpg",
      license: { id: "CC0-1.0", verdict: "yes", editorial: true },
      orientation: "landscape",
      width: 3840,
      height: 2160,
      transparent: true,
      year: 2020,
    });
    expect(s).not.toHaveProperty("description");
  });

  it("drops images a static page can't show, keeps thumbnail-only or preview-only ones", () => {
    expect(toSnapshotImage(image("commons", 1, { previewUrl: undefined, thumbnailUrl: undefined }))).toBeUndefined();
    expect(toSnapshotImage(image("commons", 1, { previewUrl: "http://insecure.example/1-1280.jpg", thumbnailUrl: "http://insecure.example/1.jpg" }))).toBeUndefined();
    expect(toSnapshotImage(image("commons", 1, { previewUrl: undefined }))?.thumbnailUrl).toBe("https://cdn.commons.example/1.jpg");
    const previewOnly = toSnapshotImage(image("commons", 1, { thumbnailUrl: "http://insecure.example/1.jpg" }))!;
    expect(previewOnly.thumbnailUrl).toBeUndefined();
    expect(previewOnly.previewUrl).toBe("https://cdn.commons.example/1-1280.jpg");
  });
});

describe("selectImages", () => {
  it("keeps relevant, free images with media, once per id and title", () => {
    const picked = selectImages(
      [
        image("commons", 1),
        image("commons", 1), // same id again
        image("commons", 2, { title: "Ocean waves commons 1" }), // same title on the same source
        image("commons", 3, { title: "Busy street at night", category: "city.skyline" }), // not about waves
        image("commons", 4, { previewUrl: undefined, thumbnailUrl: undefined }),
        image("commons", 5, { previewUrl: "http://insecure.example/5.mp4", thumbnailUrl: undefined }),
        image("stock", 1, { price: { free: false } }),
        image("stock", 2), // freemium source, price unknown: not provably free
        image("stock", 3, { price: { free: true } }),
      ],
      { search, pricing },
    );
    expect(picked.map((a) => a.id)).toEqual(["commons:commons-1", "stock:stock-3"]);
  });

  it("counts the category as a word, and ignores near misses that only start like the query", () => {
    const sky = selectImages([image("commons", 1, { title: "Golden hour", category: "nature.sky" }), image("commons", 2, { title: "Sky over the bay" }), image("commons", 3, { title: "Harbour", category: "city" })], {
      search: { q: "sky" },
      pricing,
    });
    expect(sky.map((a) => a.title)).toEqual(["Golden hour", "Sky over the bay"]);
    const sea = selectImages([image("commons", 1, { title: "Seattle Downtown", category: "city" }), image("commons", 2, { title: "Sea Stacks" })], { search: { q: "sea" }, pricing });
    expect(sea.map((a) => a.title)).toEqual(["Sea Stacks"]);
  });

  it("keeps only commercial-safe licences when the search asks for them", () => {
    const picked = selectImages(
      [image("commons", 1), image("commons", 2, { license: creativeCommons({ nc: true }) }), image("commons", 3, { license: creativeCommons({}) }), image("commons", 4, { license: undefined })],
      { search: { ...search, commercial: true }, pricing },
    );
    expect(picked.map((a) => a.license?.verdict)).toEqual(["yes", "yes-with-credit"]);
  });

  it("drops excluded title phrases and ids", () => {
    const picked = selectImages([image("commons", 1, { title: "Ocean Waves Lecture Slides" }), image("commons", 2), image("commons", 3)], {
      search: { ...search, exclude: ["lecture slides", "commons:commons-3"] },
      pricing,
    });
    expect(picked.map((a) => a.id)).toEqual(["commons:commons-2"]);
  });

  it("caps one source at 40% of the page", () => {
    const fresh = [...Array.from({ length: 30 }, (_, i) => image("commons", i)), ...Array.from({ length: 5 }, (_, i) => image("stock", i, { price: { free: true } }))];
    const picked = selectImages(fresh, { search, pricing, max: 20 });
    expect(picked.filter((a) => a.provider === "commons")).toHaveLength(8);
    expect(picked.filter((a) => a.provider === "stock")).toHaveLength(5);
  });

  it("keeps previous images in place, fills gaps with new ones and keeps a failed source's images", () => {
    const prev = selectImages([image("commons", 1), image("stock", 1, { price: { free: true } }), image("commons", 2)], { search, pricing });
    // This run: stock failed, commons 2 is gone, commons 9 is new and ranks first.
    const next = selectImages([image("commons", 9), image("commons", 1)], { search, pricing, previous: prev, failed: new Set(["stock"]) });
    expect(next.map((a) => a.id)).toEqual(["commons:commons-1", "stock:stock-1", "commons:commons-9"]);
  });
});

describe("isIndexable", () => {
  const as = (n: number, sources: number) => Array.from({ length: n }, (_, i) => ({ id: `${i}`, provider: `p${i % sources}` }) as SnapshotImage);
  it("needs enough images from more than one source", () => {
    expect(isIndexable(as(MIN_INDEXABLE, MIN_SOURCES))).toBe(true);
    expect(isIndexable(as(MIN_INDEXABLE - 1, MIN_SOURCES))).toBe(false);
    expect(isIndexable(as(40, 1))).toBe(false);
  });
});

describe("snapshotCollection", () => {
  const response = (results: ImageAsset[], failed: string[] = []): SearchResponse => ({
    query: "waves",
    filters: {},
    results,
    providers: failed.map((provider) => ({ provider, name: provider, status: "error" as const, count: 0, tookMs: 1 })),
  });
  const fresh = Array.from({ length: 3 }, (_, i) => image("commons", i));

  it("asks the service for the topic's filters", async () => {
    let asked: unknown;
    await snapshotCollection(
      async (req) => ((asked = req), response([])),
      "s",
      { q: "waves", categories: ["nature.ocean"], styles: ["painting"], orientations: ["portrait"], minResolution: 1080, free: true, commercial: true, downloadable: true, providers: ["commons"] },
      { pricing },
    );
    expect(asked).toMatchObject({
      query: "waves",
      categories: ["nature.ocean"],
      styles: ["painting"],
      orientations: ["portrait"],
      minResolution: 1080,
      freeOnly: true,
      commercialOnly: true,
      downloadableOnly: true,
      providers: ["commons"],
      limit: 100,
    });
  });

  it("moves updatedAt only when the list changes", async () => {
    const first = await snapshotCollection(async () => response(fresh), "free-ocean-footage", search, { pricing, now: new Date("2026-10-01T00:00:00Z") });
    expect(first.changed).toBe(true);
    const again = await snapshotCollection(async () => response(fresh), "free-ocean-footage", search, { pricing, previous: first.snapshot, now: new Date("2026-10-02T00:00:00Z") });
    expect(again.changed).toBe(false);
    expect(again.snapshot.updatedAt).toBe("2026-10-01T00:00:00.000Z");
    const more = await snapshotCollection(async () => response([...fresh, image("commons", 7)]), "free-ocean-footage", search, { pricing, previous: again.snapshot, now: new Date("2026-10-03T00:00:00Z") });
    expect(more).toMatchObject({ changed: true, added: 1, kept: 3, dropped: 0 });
    expect(more.snapshot.updatedAt).toBe("2026-10-03T00:00:00.000Z");
  });

  it("skips images whose poster is gone and lets the next one take the slot", async () => {
    const results = Array.from({ length: 4 }, (_, i) => image(i % 2 ? "commons" : "stock", i, { price: { free: true } }));
    const checked: string[] = [];
    const r = await snapshotCollection(async () => response(results), "s", search, {
      pricing,
      checkMedia: async (url) => {
        checked.push(url);
        return !url.includes("/1.jpg");
      },
    });
    expect(r.snapshot.images.map((a) => a.id)).toEqual(["stock:stock-0", "stock:stock-2", "commons:commons-3"]);
    expect(r.brokenMedia).toBe(1);
    expect(checked.every((u) => u.endsWith(".jpg"))).toBe(true); // the poster is what a page loads first
    expect(new Set(checked).size).toBe(checked.length); // each URL checked once
    expect(r.snapshot.search).toEqual(search); // broken ids are not saved into the search
  });

  it("starts over when the search itself changes", async () => {
    const previous: CollectionSnapshot = { slug: "s", search: { q: "clouds" }, updatedAt: "2026-01-01T00:00:00.000Z", images: [{ id: "commons:old" } as SnapshotImage] };
    const r = await snapshotCollection(async () => response(fresh, ["commons"]), "s", search, { pricing, previous });
    expect(r.snapshot.images.map((a) => a.id)).not.toContain("commons:old");
  });
});

describe("media check (scripts/snapshot-collections.mjs)", () => {
  setHostResolver(async (host) => (host === "evil.example" ? ["10.0.0.5"] : ["93.184.216.34"]));
  type Reply = { status?: number; type?: string; location?: string };
  const fakeFetch = (routes: Record<string, Reply | ((method: string) => Reply)>) => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push(`${init.method} ${url}`);
      const route = routes[url];
      const r = typeof route === "function" ? route(String(init.method)) : route;
      if (!r) throw new Error("network down");
      const headers: Record<string, string> = {};
      if (r.type) headers["content-type"] = r.type;
      if (r.location) headers.location = r.location;
      return new Response(null, { status: r.status ?? 200, headers });
    }) as typeof fetch;
    return { calls, fetchImpl };
  };
  const check = (url: string, f: ReturnType<typeof fakeFetch>) => checkPreview(url, { assertHost: assertPublicHost, fetch: f.fetchImpl, timeoutMs: 1000 }) as Promise<boolean>;

  it("accepts images and the generic binary types, refuses pages and other media", () => {
    for (const t of ["image/jpeg", "image/svg+xml", "image/webp", "application/octet-stream"]) expect(isMediaType(t), t).toBe(true);
    for (const t of ["text/html; charset=utf-8", "audio/mpeg", "video/mp4", "application/json"]) expect(isMediaType(t), t).toBe(false);
  });

  it("treats only definite answers as broken", async () => {
    const f = fakeFetch({
      "https://cdn.example/ok.jpg": { type: "image/jpeg" },
      "https://cdn.example/gone.jpg": { status: 404 },
      "https://cdn.example/soft404.jpg": { type: "text/html" },
      "https://cdn.example/busy.jpg": { status: 503, type: "text/html" },
    });
    expect(await check("https://cdn.example/ok.jpg", f)).toBe(true);
    expect(await check("https://cdn.example/gone.jpg", f)).toBe(false);
    expect(await check("https://cdn.example/soft404.jpg", f)).toBe(false);
    expect(await check("https://cdn.example/busy.jpg", f)).toBe(true); // flaky CDN: keep
    expect(await check("https://cdn.example/offline.jpg", f)).toBe(true); // network error: keep
  });

  it("falls back to a ranged GET when HEAD is refused", async () => {
    const f = fakeFetch({ "https://cdn.example/a.png": (m) => (m === "HEAD" ? { status: 405 } : { status: 206, type: "image/png" }) });
    expect(await check("https://cdn.example/a.png", f)).toBe(true);
    expect(f.calls).toEqual(["HEAD https://cdn.example/a.png", "GET https://cdn.example/a.png"]);
  });

  it("follows redirects by hand and refuses internal hosts on any hop", async () => {
    const f = fakeFetch({
      "https://cdn.example/r.jpg": { status: 302, location: "https://media.example/r.jpg" },
      "https://media.example/r.jpg": { type: "image/jpeg" },
      "https://cdn.example/bad.jpg": { status: 302, location: "http://169.254.169.254/latest" },
      "https://evil.example/x.jpg": { type: "image/jpeg" },
    });
    expect(await check("https://cdn.example/r.jpg", f)).toBe(true);
    expect(await check("https://cdn.example/bad.jpg", f)).toBe(false);
    expect(await check("https://evil.example/x.jpg", f)).toBe(false); // resolves to a private address
    expect(f.calls).not.toContain("HEAD http://169.254.169.254/latest");
    expect(f.calls.some((c) => c.includes("evil.example"))).toBe(false);
  });

  it("checks each URL once", async () => {
    const f = fakeFetch({ "https://cdn.example/ok.jpg": { type: "image/jpeg" } });
    const checker = previewChecker({ assertHost: assertPublicHost, fetch: f.fetchImpl, timeoutMs: 1000 }, 2) as (u: string) => Promise<boolean>;
    await Promise.all([checker("https://cdn.example/ok.jpg"), checker("https://cdn.example/ok.jpg")]);
    expect(f.calls).toHaveLength(1);
  });
});

describe("collection topics", () => {
  const topics = readTopics() as { slug: string; data: { search: CollectionSearch; hub: string } }[];
  const hubs = readHubs() as { id: string; title: string; description: string; intro: string; categories?: string[]; orientations?: string[] }[];
  const ctx = { hubs: hubs.map((h) => h.id), slugs: topics.map((t) => t.slug), providers: allProviders.map((p) => p.id) };

  it("has hubs with copy and a valid category scope", () => {
    expect(hubs.length).toBeGreaterThanOrEqual(5);
    for (const h of hubs) {
      expect(h.id, h.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(h.title.length, h.id).toBeLessThanOrEqual(60);
      expect(h.description.length, h.id).toBeGreaterThanOrEqual(110);
      expect(h.description.length, h.id).toBeLessThanOrEqual(160);
      expect(h.intro.length, h.id).toBeGreaterThan(200);
      expect(h.categories?.length || h.orientations?.length, h.id).toBeTruthy();
      for (const c of h.categories ?? []) expect(CATEGORIES, h.id).toContain(c);
    }
  });

  // Topic pages are added by people and by the weekly drafting workflow; the
  // repository may start with none.
  it.each(topics.map((t) => [t.slug, t]))("%s meets the editorial rules", (_, t) => {
    expect(topicErrors(t, ctx)).toEqual([]);
  });

  it("gives every topic its own search, with the same identity the server uses", () => {
    const keys = topics.map((t) => searchKey(t.data.search));
    expect(new Set(keys).size).toBe(keys.length);
    const s: CollectionSearch = { q: " Crashing  Waves ", categories: ["nature.ocean", "nature"], styles: ["photo"], orientations: ["portrait"], minResolution: 1080, free: true, commercial: true, downloadable: true, providers: ["b", "a"] };
    expect(searchKey(s)).toBe(coreSearchKey(s));
  });

  // Only that a snapshot exists: how many images it holds depends on the live
  // sources (a thin page is noindexed by the site), and the daily refresh must
  // never fail CI. New topics are held to the indexable minimum by the gate.
  it.each(topics.map((t) => [t.slug]))("%s has a snapshot", (slug) => {
    const snap = readSnapshot(slug) as CollectionSnapshot | undefined;
    expect(snap, `run: node scripts/snapshot-collections.mjs ${slug}`).toBeDefined();
    expect(snap!.slug).toBe(slug);
    for (const a of snap!.images) {
      expect(a.thumbnailUrl ?? a.previewUrl).toMatch(/^https:\/\//);
      expect(a.license?.verdict ?? "check-terms").toBeTruthy();
    }
  });

  it("has no snapshot without a topic", () => {
    const dir = new URL("../web/src/data/collections/", import.meta.url);
    if (!existsSync(dir)) return;
    for (const f of readdirSync(dir)) expect(ctx.slugs, f).toContain(f.replace(/\.json$/, ""));
  });

  it("keeps the website's thresholds in step with the snapshot's", () => {
    for (const file of ["../web/src/lib/collections.ts", "../web/integrations/sitemap-meta.mjs"]) {
      const src = readFileSync(new URL(file, import.meta.url), "utf8");
      expect(src, file).toContain(`MIN_INDEXABLE = ${MIN_INDEXABLE};`);
      expect(src, file).toContain(`MIN_SOURCES = ${MIN_SOURCES};`);
    }
  });
});
