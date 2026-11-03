import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createApp } from "../src/api/app.js";
import { PrometheusAnalytics, noopAnalytics, type ConnectEvent, type ToolCallEvent } from "../src/core/analytics.js";
import { NetworkClassifier } from "../src/core/network.js";
import { prefersMarkdown } from "../src/api/negotiate.js";
import { openApiSpec } from "../src/api/openapi.js";
import { MAX_DESCRIPTION, MAX_TITLE, imageMeta, searchMeta } from "../src/api/search-meta.js";
import { buildCsp, rewriteHead, umamiHead } from "../src/api/site.js";
import { createHash } from "node:crypto";
import { brotliDecompressSync } from "node:zlib";
import {
  assertPublicHost,
  assertPublicUrl,
  downloadImage,
  pickDisplay,
  safeRelative,
  selectFiles,
  setHostResolver,
} from "../src/core/download.js";
import { ImageService, dedupe, passes, rankResults } from "../src/core/service.js";
import { makeImage } from "../src/core/util.js";
import { license } from "../src/core/licence.js";
import { createMcpServer } from "../src/mcp/server.js";
import { allProviders } from "../src/providers/index.js";
import { linkProvider } from "../src/providers/link.js";
import { CITY, OCEAN, STAR, brokenProvider, bytesHttp, fakeProvider, slowProvider } from "./fakes.js";

const stock = linkProvider({
  id: "stock",
  name: "Stock",
  homepage: "https://stock.example",
  description: "Paid photo library.",
  categories: ["nature", "city"],
  pricing: "paid",
  buildSearchUrl: (q) => `https://stock.example/search?q=${encodeURIComponent(q.query)}`,
});

// Test hosts don't resolve; pretend every name is public.
beforeAll(() => setHostResolver(async () => ["93.184.216.34"]));

function service(http = bytesHttp()) {
  return new ImageService({ providers: [fakeProvider, brokenProvider, slowProvider, stock], http, defaultTimeoutMs: 200 });
}

describe("ImageService.search", () => {
  it("merges results and reports every provider", async () => {
    const res = await service().search({ query: "ocean waves" });
    expect(res.results.map((a) => a.id)).toEqual(["fake:ocean"]);
    const status = Object.fromEntries(res.providers.map((p) => [p.provider, p.status]));
    expect(status).toEqual({ fake: "ok", broken: "error", slow: "timeout", stock: "link" });
    expect(res.providers.find((p) => p.provider === "stock")?.searchUrl).toContain("stock.example/search?q=ocean%20waves");
  });

  it("parses size, orientation, format and transparency out of the query into filters", async () => {
    const res = await service().search({ query: "city traffic vertical 1080p photo", providers: ["fake"] });
    expect(res.query).toBe("city traffic");
    expect(res.filters).toMatchObject({ orientations: ["portrait"], minResolution: 1080, styles: ["photo"] });
    expect(res.results.map((a) => a.id)).toEqual(["fake:city"]);
    const fourK = await service().search({ query: "4k", providers: ["fake"] });
    expect(fourK.results.map((a) => a.id)).toContain("fake:ocean");
    expect(fourK.results.map((a) => a.id)).not.toContain("fake:city");
    // Vectors pass any size; unknown size stays outside strict mode only.
    expect(fourK.results.map((a) => a.id)).toContain("fake:star");
    expect(fourK.results.map((a) => a.id)).toContain("fake:rocket");
    const strict = await service().search({ query: "4k", providers: ["fake"], strict: true });
    expect(strict.results.map((a) => a.id).sort()).toEqual(["fake:ocean", "fake:star"]);
    const icon = await service().search({ query: "star icon svg transparent", providers: ["fake"] });
    expect(icon.filters).toMatchObject({ formats: ["svg"], transparent: true });
    expect(icon.filters.styles).toEqual(expect.arrayContaining(["icon", "vector"]));
    expect(icon.results.map((a) => a.id)).toEqual(["fake:star"]);
  });

  it("filters by category and licence verdict", async () => {
    const res = await service().search({ query: "", providers: ["fake"], categories: ["nature"] });
    expect(res.results.map((a) => a.id)).toEqual(["fake:ocean"]);
    const safe = await service().search({ query: "", providers: ["fake"], commercialOnly: true });
    expect(safe.results.map((a) => a.id)).not.toContain("fake:city");
    expect(safe.results.map((a) => a.id)).toContain("fake:star");
  });

  it("skips providers that cannot match the filters", async () => {
    const res = await service().search({ query: "sunflowers", categories: ["art.painting"] });
    expect(res.results).toEqual([]);
    expect(res.providers.find((p) => p.provider === "fake")?.status).toBe("skipped");
  });

  it("supports provider allow-lists and downloadable-only", async () => {
    const res = await service().search({ query: "", providers: ["fake"], downloadableOnly: true });
    expect(res.providers.map((p) => p.provider)).toEqual(["fake"]);
    expect(res.results.map((a) => a.id).sort()).toEqual(["fake:city", "fake:ocean", "fake:star"]);
  });

  it("rejects unknown providers and bad ids", async () => {
    await expect(service().search({ query: "x", providers: ["nope"] })).rejects.toThrow(/Unknown provider/);
    await expect(service().getImage("no-colon")).rejects.toThrow(/Invalid image id/);
    await expect(service().getImage("broken:x")).rejects.toThrow(/does not support/);
  });

  it("drops a re-upload of the same image, keeping the original source", () => {
    const original = makeImage({ provider: "nasa", nativeId: "1", title: "Saturn", url: "https://images.nasa.gov/details/1", downloadable: true });
    const copy = makeImage({ provider: "wikimediacommons", nativeId: "Saturn.jpg", title: "Saturn", url: "https://commons.wikimedia.org/wiki/File:Saturn.jpg", sameAs: ["nasa:1"], downloadable: true });
    const kept = dedupe(
      [
        { image: copy, provider: { id: "wikimediacommons" } },
        { image: original, provider: { id: "nasa" } },
      ],
      ["nasa", "wikimediacommons"],
    );
    expect(kept.map((k) => k.image.id)).toEqual(["nasa:1"]);
  });

  it("applies filters with known-vs-unknown values", () => {
    const unknown = makeImage({ provider: "fake", nativeId: "u", title: "Waves", url: "https://x/u", downloadable: true });
    expect(passes(OCEAN, { orientations: ["portrait"] })).toBe(false);
    expect(passes(CITY, { orientations: ["portrait"] })).toBe(true);
    expect(passes(OCEAN, { minResolution: 2160 })).toBe(true);
    expect(passes(CITY, { minResolution: 1080 })).toBe(true); // vertical 1080×1920 counts as 1080
    expect(passes(CITY, { minResolution: 2160 })).toBe(false);
    expect(passes(STAR, { minResolution: 2160 })).toBe(true); // a vector has no pixel limit
    expect(passes(STAR, { transparent: true })).toBe(true);
    expect(passes(unknown, { transparent: true })).toBe(true); // unknown transparency stays
    expect(passes(unknown, { transparent: true }, { strict: true })).toBe(false);
    expect(passes(OCEAN, { formats: ["svg"] })).toBe(false);
    expect(passes(STAR, { formats: ["svg", "png"] })).toBe(true);
    expect(passes(OCEAN, { styles: ["painting"] })).toBe(true); // soft styles only filter in strict mode
    expect(passes(OCEAN, { styles: ["painting"] }, { strict: true })).toBe(false);
    expect(passes(OCEAN, { styles: ["icon"] })).toBe(false); // vector and icon always filter
    expect(passes(STAR, { styles: ["icon"] })).toBe(true);
    expect(passes(CITY, { commercialOnly: true })).toBe(false);
  });

  it("ranks transparent images first when transparency is asked for", async () => {
    const flat = makeImage({ provider: "fake", nativeId: "a", title: "Coffee cup", url: "https://x/a", downloadable: true });
    const cut = makeImage({ provider: "fake", nativeId: "b", title: "Coffee cup", url: "https://x/b", transparent: true, downloadable: true });
    const ranked = rankResults(
      [
        { image: flat, rank: 0, provider: { id: "fake", access: "api" } },
        { image: cut, rank: 1, provider: { id: "fake", access: "api" } },
      ],
      { query: "coffee cup", transparent: true },
    );
    expect(ranked[0]!.id).toBe("fake:b");
  });
});

describe("selectFiles and pickDisplay", () => {
  it("prefers the original, then the biggest rendition", () => {
    expect(selectFiles(OCEAN).map((f) => f.filename)).toEqual(["ocean.tif"]);
    const noOriginal = { ...OCEAN, files: OCEAN.files.filter((f) => f.role !== "original") };
    expect(selectFiles(noOriginal).map((f) => f.filename)).toEqual(["ocean-1920.jpg"]);
  });
  it("picks the smallest file at least as wide as asked, else the biggest below; an SVG always fits", () => {
    expect(selectFiles(OCEAN, { width: 1600 }).map((f) => f.filename)).toEqual(["ocean-1920.jpg"]);
    expect(selectFiles(OCEAN, { width: 1200 }).map((f) => f.filename)).toEqual(["ocean-1280.jpg"]);
    expect(selectFiles(OCEAN, { width: 8000 }).map((f) => f.filename)).toEqual(["ocean.tif"]);
    expect(selectFiles(STAR, { width: 4000 }).map((f) => f.filename)).toEqual(["star.svg"]);
  });
  it("honours format and role, and picks thumbnails or files behind a login only when nothing else is there", () => {
    expect(selectFiles(OCEAN, { format: "jpeg" }).map((f) => f.filename)).toEqual(["ocean-1920.jpg"]);
    expect(selectFiles(OCEAN, { role: "thumbnail" }).map((f) => f.filename)).toEqual(["ocean-330.jpg"]);
    expect(selectFiles(OCEAN, { format: "webp" })).toEqual([]);
    const locked = { ...OCEAN, files: OCEAN.files.map((f) => (f.role === "original" ? { ...f, requiresAuth: true } : f)) };
    expect(selectFiles(locked).map((f) => f.filename)).toEqual(["ocean-1920.jpg"]);
    expect(selectFiles({ files: [OCEAN.files[0]!] }).map((f) => f.filename)).toEqual(["ocean-330.jpg"]);
  });
  it("shows a browser-friendly file near 1280 px, straight from the source", () => {
    expect(pickDisplay(OCEAN)).toMatchObject({ url: "https://cdn.fake.example/ocean-1280.jpg", type: "image/jpeg", width: 1280 });
    expect(pickDisplay(STAR)).toMatchObject({ url: "https://cdn.fake.example/star.svg", type: "image/svg+xml" });
    // Without files, the preview.
    expect(pickDisplay({ files: [], previewUrl: "https://cdn.fake.example/p.jpg" })).toEqual({ url: "https://cdn.fake.example/p.jpg" });
    // A TIFF original alone is not shown in a browser.
    expect(pickDisplay({ files: [OCEAN.files[1]!] })).toBeUndefined();
  });
});

describe("download safety", () => {
  it("rejects path traversal and internal URLs", async () => {
    expect(() => safeRelative("../etc/passwd")).toThrow();
    expect(safeRelative("./nature//a.mp4")).toBe("nature/a.mp4");
    expect(() => assertPublicUrl("http://127.0.0.1/x")).toThrow();
    expect(() => assertPublicUrl("http://localhost:8080/x")).toThrow();
    expect(() => assertPublicUrl("http://[::ffff:10.0.0.1]/x")).toThrow();
    expect(() => assertPublicUrl("file:///etc/passwd")).toThrow();
    expect(assertPublicUrl("https://upload.wikimedia.org/a.webm").hostname).toBe("upload.wikimedia.org");
  });

  it("refuses names that resolve to private addresses", async () => {
    setHostResolver(async () => ["10.1.2.3"]);
    try {
      await expect(assertPublicHost("https://evil.example/x.mp4")).rejects.toThrow(/private address/);
    } finally {
      setHostResolver(async () => ["93.184.216.34"]);
    }
  });

  it("re-checks redirects", async () => {
    const http = {
      ...bytesHttp(),
      async raw(url: string) {
        if (url.includes("start")) return new Response(null, { status: 302, headers: { location: "http://127.0.0.1/secret" } });
        return new Response("x");
      },
    };
    const dir = await mkdtemp(join(tmpdir(), "dl-"));
    try {
      const s = { ...OCEAN, files: [{ url: "https://cdn.fake.example/start.jpg", filename: "x.jpg", format: "jpg", role: "original" as const }] };
      await expect(downloadImage(http, s, s.files, dir)).rejects.toThrow(/private address|Refusing/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("downloadImage", () => {
  let dir: string | undefined;
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it("files images by category with their width, and never leaves a partial file", async () => {
    dir = await mkdtemp(join(tmpdir(), "images-"));
    const res = await downloadImage(bytesHttp(), OCEAN, selectFiles(OCEAN, { width: 1920 }), dir);
    const rel = res.files.map((f) => f.path.slice(dir!.length + 1).replaceAll("\\", "/"));
    expect(rel).toEqual(["nature/ocean/fake-ocean Ocean Waves at Sunset (1920w).jpg"]);
    expect(await readFile(res.files[0]!.path, "utf8")).toBe("data:ocean-1920.jpg");
    const failing = { ...bytesHttp(), raw: async () => new Response("x", { status: 500 }) };
    await expect(downloadImage(failing, OCEAN, selectFiles(OCEAN, { width: 1280 }), dir)).rejects.toThrow(/HTTP 500/);
  });

  it("enforces the size limit before downloading", async () => {
    dir = await mkdtemp(join(tmpdir(), "images-"));
    await expect(downloadImage(bytesHttp(), OCEAN, selectFiles(OCEAN), dir, { maxBytes: 3 })).rejects.toThrow(/limit/);
  });
});

const SITE = fileURLToPath(new URL("./fixtures/site", import.meta.url));

describe("HTTP API", () => {
  const app = createApp(service(), { siteRoot: SITE });

  it("searches with image filters", async () => {
    const res = await app.request("/v1/search?q=ocean&category=nature&min_resolution=4k&providers=fake");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { filters: object; results: { id: string }[] };
    expect(body.filters).toMatchObject({ categories: ["nature"], minResolution: 2160 });
    expect(body.results[0]?.id).toBe("fake:ocean");
    const city = (await (await app.request("/v1/search?q=city&orientation=portrait&providers=fake")).json()) as { filters: object; results: { id: string }[] };
    expect(city.filters).toMatchObject({ orientations: ["portrait"] });
    expect(city.results.map((r) => r.id)).toEqual(["fake:city"]);
    const icons = (await (await app.request("/v1/search?q=star&transparent=true&format=svg&providers=fake")).json()) as { filters: object; results: { id: string }[] };
    expect(icons.filters).toMatchObject({ transparent: true, formats: ["svg"] });
    expect(icons.results.map((r) => r.id)).toEqual(["fake:star"]);
  });

  it("validates parameters", async () => {
    expect((await app.request("/v1/search?q=x&category=spaceship")).status).toBe(400);
    expect((await app.request("/v1/search?q=x&min_resolution=huge")).status).toBe(400);
    expect((await app.request("/v1/search?q=x&orientation=diagonal")).status).toBe(400);
    expect((await app.request("/v1/search?q=x&style=dance")).status).toBe(400);
    expect((await app.request("/v1/search?q=x&providers=nope")).status).toBe(400);
    expect((await app.request("/v1/images/fake:missing")).status).toBe(404);
  });

  it("never returns file request headers", async () => {
    const withHeaders = {
      ...fakeProvider,
      async getImage() {
        return { ...OCEAN, files: OCEAN.files.map((f) => ({ ...f, headers: { authorization: "Bearer secret", referer: "https://x" } })) };
      },
    };
    const a = createApp(new ImageService({ providers: [withHeaders], http: bytesHttp() }), { siteRoot: SITE });
    const body = await (await a.request("/v1/images/fake:ocean")).text();
    expect(body).not.toContain("secret");
    expect(body).not.toContain("headers");
    const files = await (await a.request("/v1/images/fake:ocean/files?all=true")).text();
    expect(files).not.toContain("secret");
    // Files that need request headers can't be handed out as a redirect.
    expect((await a.request("/v1/images/fake:ocean/download")).status).toBe(409);
  });

  it("returns image details with a display URL on the source and a share link", async () => {
    const res = await app.request(`/v1/images/${encodeURIComponent("fake:ocean")}`);
    const body = (await res.json()) as { display: { url: string }; files: unknown[]; shareUrl: string };
    expect(body.display.url).toBe("https://cdn.fake.example/ocean-1280.jpg");
    expect(body.files).toHaveLength(4);
    expect(body.shareUrl).toMatch(/\/search\?image=fake%3Aocean$/);
  });

  it("downloads by redirecting to the source, never proxying the image", async () => {
    const res = await app.request("/v1/images/fake:ocean/download?width=1600");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://cdn.fake.example/ocean-1920.jpg");
    expect(res.headers.get("x-license")).toBe("CC0-1.0; verdict=yes");
    const original = await app.request("/v1/images/fake:ocean/download");
    expect(original.headers.get("location")).toBe("https://cdn.fake.example/ocean.tif");
    expect((await app.request("/v1/images/fake:ocean/download?format=webp")).status).toBe(404);
  });

  it("serves credits as Markdown, JSON or a zip without the image", async () => {
    const md = await app.request("/v1/images/fake:city/credits");
    expect(md.headers.get("content-type")).toContain("text/markdown");
    expect(await md.text()).toContain("not cleared for commercial use");
    const json = (await (await app.request("/v1/images/fake:city/credits?format=json")).json()) as { images: { id: string }[]; commercialSafe: boolean };
    expect(json.images[0]!.id).toBe("fake:city");
    expect(json.commercialSafe).toBe(false);
    const zip = await app.request("/v1/images/fake:ocean/credits?format=zip");
    expect(zip.headers.get("content-type")).toBe("application/zip");
    const entries = unzipSync(new Uint8Array(await zip.arrayBuffer()));
    expect(Object.keys(entries).sort()).toEqual(["fake-ocean/ATTRIBUTION.md", "fake-ocean/credits.json"]);
  });

  it("plans an image set with exports", async () => {
    const res = await app.request("/v1/sets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slots: ["ocean waves (1600px)", "city traffic", "star icon"], commercialOnly: false, providers: ["fake"], name: "demo" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { plan: { slots: { image?: { id: string }; width: number; file?: { url: string } }[] }; exports: Record<string, string> };
    expect(body.plan.slots.map((s) => [s.image?.id, s.width])).toEqual([
      ["fake:ocean", 1600],
      ["fake:city", 1600],
      ["fake:star", 1600],
    ]);
    expect(body.plan.slots[0]!.file?.url).toBe("https://cdn.fake.example/ocean-1920.jpg");
    expect(Object.keys(body.exports).sort()).toEqual(["ATTRIBUTION.md", "credits.html", "credits.json", "download.sh", "images.json"]);
    expect(body.exports["download.sh"]).toContain("https://cdn.fake.example/ocean-1920.jpg");
    expect(body.exports["credits.html"]).toContain("<figcaption>");
    expect((await app.request("/v1/sets", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).status).toBe(400);
  });

  it("serves the website to browsers and JSON to API clients", async () => {
    const html = await app.request("/", { headers: { accept: "text/html" } });
    expect(html.headers.get("content-type")).toContain("text/html");
    expect(html.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(html.headers.get("content-security-policy")).toContain("media-src 'self'"); expect(html.headers.get("content-security-policy")).toContain("img-src 'self' https: data:");
    expect(html.headers.get("link")).toBe('</AGENTS.md>; rel="alternate"; type="text/markdown"');
    expect(await html.text()).toContain("Image Asset Server");
    const json = (await (await app.request("/")).json()) as { name: string; agents: { instructions: string } };
    expect(json.name).toBe("image-asset-server");
    expect(json.agents.instructions).toBe("/AGENTS.md");
  });

  it("gives agents markdown when they ask for it", async () => {
    const root = await app.request("/", { headers: { accept: "text/markdown, text/html;q=0.9" } });
    expect(root.headers.get("content-type")).toContain("text/markdown");
    expect(await root.text()).toContain("agent guide");
    const mcp = await app.request("/docs/mcp", { headers: { accept: "text/markdown" } });
    expect((await mcp.text()).replace(/\r\n/g, "\n")).toBe("# MCP setup\n");
    expect((await app.request("/agents.md")).status).toBe(200);
    expect(await (await app.request("/llms.txt")).text()).toContain("Image Asset Server");
  });

  it("negotiates Markdown vs HTML on the homepage with Vary: Accept", async () => {
    const md = await app.request("/", { headers: { accept: "text/markdown" } });
    expect(md.status).toBe(200);
    expect(md.headers.get("content-type")).toContain("text/markdown");
    expect(md.headers.get("vary")).toContain("Accept");
    expect((await md.text()).length).toBeGreaterThan(0);
    const html = await app.request("/", { headers: { accept: "text/html" } });
    expect(html.headers.get("content-type")).toContain("text/html");
    expect(html.headers.get("vary")).toContain("Accept");
    const json = await app.request("/");
    expect(json.headers.get("vary")).toContain("Accept");
    const twin = await app.request("/docs/mcp", { headers: { accept: "text/markdown" } });
    expect(twin.headers.get("content-type")).toContain("text/markdown");
    expect(twin.headers.get("vary")).toContain("Accept");
    // A client that ranks HTML above Markdown gets HTML.
    const ranked = await app.request("/", { headers: { accept: "text/markdown;q=0.5, text/html" } });
    expect(ranked.headers.get("content-type")).toContain("text/html");
  });

  it("answers unknown paths with a Markdown 404 for agents and HTML for browsers", async () => {
    const md = await app.request("/__ora-404-probe", { headers: { accept: "text/markdown" } });
    expect(md.status).toBe(404);
    expect(md.headers.get("content-type")).toContain("text/markdown");
    expect(md.headers.get("vary")).toContain("Accept");
    const body = await md.text();
    expect(body.length).toBeGreaterThan(20);
    expect(body).toContain("/llms.txt");
    expect(body).toContain("/sitemap-index.xml");
    expect(body).toContain("/__ora-404-probe");
    const html = await app.request("/__ora-404-probe", { headers: { accept: "text/html" } });
    expect(html.status).toBe(404);
    expect(html.headers.get("content-type")).toContain("text/html");
    // Hostile paths can't break out of the inline code span.
    const hostile = await app.request("/a%60%0A%23injected", { headers: { accept: "text/markdown" } });
    expect(hostile.status).toBe(404);
    expect(hostile.headers.get("content-type")).toContain("text/markdown");
    expect(await hostile.text()).not.toMatch(/\n#\s*injected/);
    const backtick = await (await app.request("/x`y", { headers: { accept: "text/markdown" } })).text();
    expect(backtick).toContain("`/xy`");
    // API paths keep JSON errors.
    const api = await app.request("/v1/nope", { headers: { accept: "text/markdown" } });
    expect(api.headers.get("content-type")).toContain("application/json");
  });

  it("redirects predictable developer URLs and browser visits to /mcp", async () => {
    for (const [from, to] of [["/api", "/docs/api"], ["/developers", "/docs"], ["/reference", "/docs/api/reference"], ["/privacy-policy", "/privacy"]]) {
      const res = await app.request(from!);
      expect(res.status).toBe(301);
      expect(res.headers.get("location")).toBe(to);
    }
    const browser = await app.request("/mcp", { headers: { accept: "text/html,application/xhtml+xml" } });
    expect(browser.status).toBe(302);
    expect(browser.headers.get("location")).toBe("/docs/mcp");
  });

  it("serves site pages with canonical URLs, caching and a 404 page", async () => {
    expect((await app.request("/docs/mcp")).status).toBe(200);
    const slash = await app.request("/docs/mcp/?x=1");
    expect(slash.status).toBe(301);
    expect(slash.headers.get("location")).toBe("/docs/mcp?x=1");
    const asset = await app.request("/_astro/app.abc123.js");
    expect(asset.headers.get("cache-control")).toContain("immutable");
    const again = await app.request("/_astro/app.abc123.js", { headers: { "if-none-match": asset.headers.get("etag")! } });
    expect(again.status).toBe(304);
    const missing = await app.request("/no/such/page");
    expect(missing.status).toBe(404);
    expect(missing.headers.get("content-type")).toContain("text/html");
    const apiMissing = await app.request("/v1/nope");
    expect(apiMissing.status).toBe(404);
    expect(apiMissing.headers.get("content-type")).toContain("application/json");
  });

  it("records analytics for searches, downloads and page views", async () => {
    const lines: string[] = [];
    const analytics = new PrometheusAnalytics((l) => lines.push(l));
    const tracked = createApp(service(), { siteRoot: SITE, analytics });
    await tracked.request("/v1/search?q=Ocean+vertical&providers=fake", { headers: { "x-image-client": "web", "user-agent": "Mozilla/5.0" } });
    await tracked.request("/v1/images/fake:ocean/download?width=1920", { headers: { "user-agent": "curl/8.5" } });
    await tracked.request("/docs/mcp");
    const metrics = await analytics.registry.metrics();
    expect(metrics).toContain(
      'image_server_searches_total{surface="web",client="browser",category="any",orientation="portrait",min_resolution="any",free_only="false",has_results="false"} 1',
    );
    expect(metrics).toContain('image_server_provider_requests_total{provider="fake",status="ok"} 1');
    expect(metrics).toContain('image_server_downloads_total{surface="api",client="curl",provider="fake",kind="redirect",quality="large"} 1');
    expect(metrics).toContain('image_server_page_views_total{page="/docs/mcp"} 1');
    expect(metrics).toContain('image_server_http_requests_total{route="/v1/search",method="GET",status="2xx"} 1');
    const search = JSON.parse(lines.find((l) => l.includes('"event":"search"'))!);
    expect(search).toMatchObject({ event: "search", surface: "web", query: "ocean vertical", orientations: ["portrait"], results: 0 });
  });

  it("counts MCP tool calls by client", async () => {
    const analytics = new PrometheusAnalytics(() => undefined);
    const tracked = createApp(service(), { siteRoot: SITE, analytics });
    await tracked.request("/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "user-agent": "claude-code/2.1.0" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "list_sources", arguments: {} } }),
    });
    expect(await analytics.registry.metrics()).toContain(
      'image_server_mcp_tool_calls_total{tool="list_sources",client="claude-code",outcome="ok",network="unknown",consistency="no_session"} 1',
    );
  });

  it("labels MCP tool calls with the client declared at initialize, the caller's network and consistency", async () => {
    const lines: string[] = [];
    const analytics = new PrometheusAnalytics((l) => lines.push(l));
    const networks = new NetworkClassifier();
    const tracked = createApp(service(), { siteRoot: SITE, analytics, networks, mcpSessionSecret: "test-secret" });
    const headers = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "user-agent": "node",
      "x-forwarded-for": "160.79.105.20",
    };
    const init = await tracked.request("/mcp", {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "claude-ai", version: "0.1.0" } },
      }),
    });
    expect(init.status).toBe(200);
    const sessionId = init.headers.get("mcp-session-id");
    expect(sessionId).toBeTruthy();
    expect(((await init.json()) as { result: { serverInfo: { name: string } } }).result.serverInfo.name).toBe("image-asset-server");

    const call = (session: string | undefined, ip: string) =>
      tracked.request("/mcp", {
        method: "POST",
        headers: { ...headers, "x-forwarded-for": ip, "mcp-protocol-version": "2025-06-18", ...(session ? { "mcp-session-id": session } : {}) },
        body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "list_sources", arguments: {} } }),
      });
    expect((await call(sessionId!, "160.79.105.20")).status).toBe(200);
    expect((await call(sessionId!, "160.79.105.20")).status).toBe(200);
    // A session ID this server did not issue is still served, just labelled.
    expect((await call("someone-elses-session", "10.0.0.3")).status).toBe(200);

    const metrics = await analytics.registry.metrics();
    expect(metrics).toContain('image_server_mcp_connects_total{client="claude-ai",client_version="0.1",network="anthropic"} 1');
    expect(metrics).toContain(
      'image_server_mcp_tool_calls_total{tool="list_sources",client="claude-ai",outcome="ok",network="anthropic",consistency="consistent"} 2',
    );
    expect(metrics).toContain(
      'image_server_mcp_tool_calls_total{tool="list_sources",client="node",outcome="ok",network="private",consistency="bad_session"} 1',
    );
    expect(metrics).toContain('image_server_mcp_new_callers_total{client="claude-ai",network="anthropic"} 1');
    const connect = JSON.parse(lines.find((l) => l.includes('"event":"mcp_connect"'))!);
    expect(connect).toMatchObject({ client: "claude-ai", client_name: "claude-ai", client_version: "0.1", network: "anthropic" });
    // The address itself is never logged.
    expect(lines.join("\n")).not.toContain("160.79.105.20");
  });

  it("requires the API key when configured", async () => {
    const secured = createApp(service(), { apiKey: "s3cret", siteRoot: SITE });
    expect((await secured.request("/v1/providers")).status).toBe(401);
    expect((await secured.request("/v1/providers", { headers: { authorization: "Bearer s3cret" } })).status).toBe(200);
    // Never in the URL: it would leak into logs and Referer headers.
    expect((await secured.request("/v1/providers?api_key=s3cret")).status).toBe(401);
    expect((await secured.request("/health")).status).toBe(200);
    expect((await secured.request("/", { headers: { accept: "text/html" } })).status).toBe(200);
  });

  it("serves MCP over streamable HTTP", async () => {
    const init = await app.request("/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } },
      }),
    });
    expect(init.status).toBe(200);
    const list = await app.request("/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": "2025-06-18",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
    });
    const body = (await list.json()) as { result: { tools: { name: string }[] } };
    // download_image writes to disk, so it is off for the HTTP transport by default.
    expect(body.result.tools.map((t) => t.name).sort()).toEqual(["build_image_set", "get_image", "list_sources", "search_images"]);
  });

  it("can turn off HTTP MCP and keep the website and search API", async () => {
    const webOnly = createApp(service(), { siteRoot: SITE, httpMcpDisabled: true });
    const mcp = await webOnly.request("/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } } }),
    });
    expect(mcp.status).toBe(404);
    // No redirect to the setup guide either: there is nothing to set up.
    expect((await webOnly.request("/mcp", { headers: { accept: "text/html" } })).status).toBe(404);
    expect((await webOnly.request("/v1/search?q=ocean&category=nature&providers=fake")).status).toBe(200);
    expect((await webOnly.request("/", { headers: { accept: "text/html" } })).status).toBe(200);
    const index = (await (await webOnly.request("/", { headers: { accept: "application/json" } })).json()) as { agents: object; endpoints: object };
    expect(index.agents).not.toHaveProperty("mcp");
    expect(index.endpoints).not.toHaveProperty("mcp");
  });
});

describe("MCP tools", () => {
  let dir: string | undefined;
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  async function connect(downloadDir?: string, publicBaseUrl?: string) {
    const server = createMcpServer(service(), { allowLocalDownload: true, downloadDir, publicBaseUrl });
    const [a, b] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test", version: "1" });
    await Promise.all([server.connect(a), client.connect(b)]);
    return client;
  }

  const text = (r: unknown) => JSON.parse((r as { content: { text: string }[] }).content[0]!.text);

  it("labels stdio tool calls with the client's declared name", async () => {
    const calls: ToolCallEvent[] = [];
    const connects: ConnectEvent[] = [];
    const analytics = { ...noopAnalytics, toolCall: (e: ToolCallEvent) => calls.push(e), mcpConnect: (e: ConnectEvent) => connects.push(e) };
    const server = createMcpServer(service(), { allowLocalDownload: false, analytics });
    const [a, b] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "claude-code", version: "2.1.0" });
    await Promise.all([server.connect(a), client.connect(b)]);
    await client.callTool({ name: "list_sources", arguments: {} });
    expect(connects).toEqual([{ client: "claude-code", clientVersion: "2", clientName: "claude-code" }]);
    expect(calls).toMatchObject([{ tool: "list_sources", client: "claude-code", outcome: "ok" }]);
  });

  it("search_images returns compact results with licence verdicts, commercial-safe by default", async () => {
    const client = await connect();
    const r = text(await client.callTool({ name: "search_images", arguments: { query: "", providers: ["fake", "stock"] } }));
    expect(r.results.map((x: { id: string }) => x.id)).not.toContain("fake:city");
    expect(r.results.find((x: { id: string }) => x.id === "fake:ocean")).toMatchObject({ category: "nature.ocean", orientation: "landscape", size: "3840×2160 (4K+ 2160+)", license: { verdict: "yes" }, downloadable: true });
    expect(r.results.find((x: { id: string }) => x.id === "fake:ocean").thumbnail).toBe("https://cdn.fake.example/ocean-330.jpg");
    expect(r.results.find((x: { id: string }) => x.id === "fake:star")).toMatchObject({ size: "vector (any size)", transparent: true, license: { verdict: "yes-with-credit" } });
    expect(r.also_search_on[0].provider).toBe("Stock");
    const all = text(await client.callTool({ name: "search_images", arguments: { query: "city", orientation: "portrait", commercial_only: false, providers: ["fake"] } }));
    expect(all.results[0]).toMatchObject({ id: "fake:city", license: { verdict: "no" } });
    const broken = text(await client.callTool({ name: "search_images", arguments: { query: "ocean" } }));
    expect(broken.unavailable.map((u: { provider: string }) => u.provider).sort()).toEqual(["broken", "slow"]);
  });

  it("get_image shows files, the display URL and the selection", async () => {
    const client = await connect();
    const r = text(await client.callTool({ name: "get_image", arguments: { id: "fake:ocean", width: 1600 } }));
    expect(r.files.map((f: { filename: string }) => f.filename)).toEqual(["ocean.tif", "ocean-1920.jpg", "ocean-1280.jpg"]);
    expect(r.display).toBe("https://cdn.fake.example/ocean-1280.jpg");
    expect(r.selection).toMatchObject({ file: "ocean-1920.jpg", size: "1920×1080", downloadUrl: "https://cdn.fake.example/ocean-1920.jpg" });
    expect(r.shareUrl).toBeUndefined();
    const linked = text(await (await connect(undefined, "https://image.shep.bot/")).callTool({ name: "get_image", arguments: { id: "fake:ocean", width: 1600 } }));
    expect(linked.shareUrl).toBe("https://image.shep.bot/search?image=fake%3Aocean");
    expect(linked.selection.downloadUrl).toBe("https://image.shep.bot/v1/images/fake%3Aocean/download?width=1600");
  });

  it("without local downloads, tells agents to fetch downloadUrl themselves", async () => {
    const server = createMcpServer(service(), { allowLocalDownload: false, publicBaseUrl: "https://image.shep.bot" });
    const [a, b] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test", version: "1" });
    await Promise.all([server.connect(a), client.connect(b)]);
    expect(client.getInstructions()).toContain("selection.downloadUrl");
    expect(client.getInstructions()).not.toContain("download_image");
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).not.toContain("download_image");
    expect(tools.map((t) => t.name).sort()).toEqual(["build_image_set", "get_image", "list_sources", "search_images"]);
    expect(tools.find((t) => t.name === "get_image")?.description).not.toContain("download_image");
  });

  it("download_image files the image by category and writes the credits", async () => {
    dir = await mkdtemp(join(tmpdir(), "mcp-"));
    const client = await connect(dir);
    const r = text(await client.callTool({ name: "download_image", arguments: { id: "fake:ocean", width: 1280 } }));
    expect(r.directory).toBe(dir);
    expect(r.files).toEqual([join(dir, "nature/ocean/fake-ocean Ocean Waves at Sunset (1280w).jpg")]);
    const credits = JSON.parse(await readFile(join(dir, "credits.json"), "utf8"));
    expect(JSON.stringify(credits)).toContain("fake:ocean");
    expect(await readFile(join(dir, "ATTRIBUTION.md"), "utf8")).toContain("Ocean Waves at Sunset");
    // A second download merges into the same credits.
    await client.callTool({ name: "download_image", arguments: { id: "fake:city" } });
    const both = JSON.stringify(JSON.parse(await readFile(join(dir, "credits.json"), "utf8")));
    expect(both).toContain("fake:ocean");
    expect(both).toContain("fake:city");
  });

  it("build_image_set plans slots and, locally, downloads them with the exports", async () => {
    dir = await mkdtemp(join(tmpdir(), "set-"));
    const client = await connect(dir);
    const planned = text(await client.callTool({ name: "build_image_set", arguments: { slots: "hero: ocean waves (1600px)\ncity traffic", commercial_only: false, providers: ["fake"] } }));
    expect(planned.slots.map((s: { pick?: { id: string } }) => s.pick?.id)).toEqual(["fake:ocean", "fake:city"]);
    expect(planned.exports["download.sh"]).toContain("curl");
    expect(planned.exports["images.json"].images[0]).toMatchObject({ id: "fake:ocean", src: "https://cdn.fake.example/ocean-1920.jpg", alt: "Ocean Waves at Sunset" });
    const out = join(dir, "set");
    const saved = text(await client.callTool({ name: "build_image_set", arguments: { slots: ["ocean waves"], providers: ["fake"], download: true, dest_dir: out } }));
    expect(saved.directory).toBe(out);
    const manifest = JSON.parse(await readFile(join(out, "images.json"), "utf8"));
    expect(manifest.images[0].src).toBe("images/01-ocean-waves.jpg");
    expect(await readFile(join(out, "images/01-ocean-waves.jpg"), "utf8")).toBe("data:ocean-1920.jpg");
    expect(await readFile(join(out, "credits.html"), "utf8")).toContain('src="images/01-ocean-waves.jpg"');
  });

  it("reports errors as tool errors", async () => {
    const client = await connect();
    const r = await client.callTool({ name: "get_image", arguments: { id: "fake:missing" } });
    expect(r.isError).toBe(true);
  });
});

describe("content negotiation", () => {
  it("prefers Markdown only when ranked at least as high as HTML", () => {
    expect(prefersMarkdown("text/markdown")).toBe(true);
    expect(prefersMarkdown("text/markdown, text/html;q=0.9")).toBe(true);
    expect(prefersMarkdown("text/html, text/markdown")).toBe(true);
    expect(prefersMarkdown("text/markdown;q=0.5, text/html")).toBe(false);
    expect(prefersMarkdown("text/markdown;q=0")).toBe(false);
    expect(prefersMarkdown("text/html,application/xhtml+xml,*/*;q=0.8")).toBe(false);
    expect(prefersMarkdown(undefined)).toBe(false);
  });
});

describe("rate limiting", () => {
  const make = (limit = 3) => {
    let now = 1_000_000;
    const app = createApp(service(), { siteRoot: SITE, rateLimit: { limit, windowSec: 60, now: () => now } });
    return { app, tick: (s: number) => (now += s * 1000) };
  };
  const from = (ip: string) => ({ headers: { "x-forwarded-for": `${ip}, 10.42.0.7` } });

  it("sends RateLimit headers and 429 + Retry-After past the limit", async () => {
    const { app } = make(3);
    const first = await app.request("/v1/providers", from("203.0.113.1"));
    expect(first.status).toBe(200);
    expect(first.headers.get("ratelimit-policy")).toBe('"default";q=3;w=60');
    expect(first.headers.get("ratelimit")).toBe('"default";r=2;t=60');
    expect(first.headers.get("ratelimit-limit")).toBe("3");
    expect(first.headers.get("ratelimit-remaining")).toBe("2");
    expect(first.headers.get("ratelimit-reset")).toBe("60");
    expect(first.headers.get("access-control-expose-headers")).toContain("RateLimit");
    await app.request("/v1/providers", from("203.0.113.1"));
    await app.request("/v1/providers", from("203.0.113.1"));
    const over = await app.request("/v1/providers", from("203.0.113.1"));
    expect(over.status).toBe(429);
    expect(over.headers.get("retry-after")).toBe("60");
    expect(over.headers.get("ratelimit-remaining")).toBe("0");
    expect(((await over.json()) as { retryAfter: number }).retryAfter).toBe(60);
  });

  it("counts clients separately, resets per window and leaves pages and health alone", async () => {
    const { app, tick } = make(1);
    expect((await app.request("/v1/providers", from("203.0.113.1"))).status).toBe(200);
    expect((await app.request("/v1/providers", from("203.0.113.1"))).status).toBe(429);
    expect((await app.request("/v1/providers", from("203.0.113.2"))).status).toBe(200);
    tick(61);
    expect((await app.request("/v1/providers", from("203.0.113.1"))).status).toBe(200);
    for (let i = 0; i < 3; i++) {
      expect((await app.request("/health", from("203.0.113.1"))).status).toBe(200);
      expect((await app.request("/docs/mcp", from("203.0.113.1"))).status).toBe(200);
    }
  });

  it("limits the MCP endpoint too", async () => {
    const { app } = make(1);
    const call = () =>
      app.request("/mcp", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "x-forwarded-for": "198.51.100.9" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      });
    expect((await call()).status).toBe(200);
    expect((await call()).status).toBe(429);
  });

  it("is documented in the OpenAPI spec with a versioning policy", () => {
    const spec = openApiSpec() as unknown as {
      paths: Record<string, Record<string, { responses: Record<string, { headers?: Record<string, unknown> }> }>>;
      "x-api-lifecycle": { deprecationPolicy: string };
    };
    expect(spec.paths["/v1/search"]!.get!.responses["429"]).toBeDefined();
    expect(spec.paths["/v1/search"]!.get!.responses["200"]!.headers).toHaveProperty("RateLimit");
    expect(spec.paths["/mcp"]!.post!.responses["429"]).toBeDefined();
    expect(spec.paths["/health"]!.get!.responses["429"]).toBeUndefined();
    expect(spec["x-api-lifecycle"].deprecationPolicy).toContain("/docs/api/versioning");
  });
});

describe("site security, compression and SEO variants", () => {
  const app = createApp(service(), { siteRoot: SITE, publicBaseUrl: "https://image.shep.bot" });
  const html = { headers: { accept: "text/html" } };

  it("sends a strict per-page CSP with hashes instead of 'unsafe-inline'", async () => {
    const res = await app.request("/", html);
    const csp = res.headers.get("content-security-policy")!;
    expect(csp).not.toContain("'unsafe-inline'");
    const hash = (s: string) => `'sha256-${createHash("sha256").update(s).digest("base64")}'`;
    expect(csp).toContain(`script-src 'self' ${hash('document.documentElement.dataset.ok="1"')}`);
    expect(csp).toContain(hash("astro-island{display:contents}"));
    expect(csp).toContain(`'unsafe-hashes' ${hash("color:red")}`);
    expect(csp).not.toContain(hash('{"@context":"https://schema.org"}')); // JSON-LD is not executable
    expect(res.headers.get("permissions-policy")).toContain("camera=()");
    expect(res.headers.get("cross-origin-opener-policy")).toBe("same-origin");
    expect(res.headers.get("cross-origin-resource-policy")).toBe("same-origin");
  });

  it("builds CSPs for nonces and the inline-style exception", () => {
    expect(buildCsp("<p></p>", { styleNonce: "abc" })).toContain("style-src 'self' 'nonce-abc'");
    expect(buildCsp("<p></p>", { inlineStyles: true })).toContain("style-src 'self' 'unsafe-inline'");
    expect(buildCsp('<script src="/a.js"></script>')).toContain("script-src 'self';");
    expect(buildCsp('<p style="a:&quot;b&quot;">')).toContain(`'sha256-${createHash("sha256").update('a:"b"').digest("base64")}'`);
  });

  it("adds the Umami tracker to every page only when configured", async () => {
    const umami = { websiteId: "8e5f2c1a-3b4d-4e6f-9a0b-1c2d3e4f5a6b", host: "https://stats.example/", domain: "image.shep.bot" };
    const tracked = createApp(service(), { siteRoot: SITE, umami });
    const hash = (s: string) => `'sha256-${createHash("sha256").update(s).digest("base64")}'`;
    const helper = /<script>([\s\S]*?)<\/script><script defer src="https:\/\/stats\.example\/script\.js"/;

    for (const path of ["/", "/search?q=oak+tree", "/docs/api/playground"]) {
      const res = await tracked.request(path, html);
      const body = await res.text();
      expect(body, path).toContain(
        '<script defer src="https://stats.example/script.js" data-website-id="8e5f2c1a-3b4d-4e6f-9a0b-1c2d3e4f5a6b" data-domains="image.shep.bot" data-do-not-track="true" data-before-send="umamiBeforeSend"></script></head>',
      );
      const csp = res.headers.get("content-security-policy")!;
      expect(csp, path).toContain("script-src 'self' https://stats.example ");
      expect(csp, path).toContain("connect-src 'self' https: https://stats.example;");
      expect(csp, path).toContain(hash(helper.exec(body)![1]!));
    }
    const off = await app.request("/", html);
    expect(await off.text()).not.toContain("umami");
    expect(off.headers.get("content-security-policy")).toContain("connect-src 'self' https:;");
    // Same file, different markup: the ETag changes so caches refetch.
    expect((await tracked.request("/", html)).headers.get("etag")).not.toBe(off.headers.get("etag"));
    expect(() => umamiHead({ ...umami, websiteId: '"><script>' })).toThrow(/UUID/);
  });

  it("keeps search text out of what the Umami helper lets through", () => {
    const head = umamiHead({ websiteId: "8e5f2c1a-3b4d-4e6f-9a0b-1c2d3e4f5a6b", host: "https://stats.example" });
    const code = /<script>([\s\S]*?)<\/script>/.exec(head)![1]!;
    const win: { umamiBeforeSend?: (type: string, p: Record<string, string>) => Record<string, string> | null } = {};
    const doc = { addEventListener() {} };
    new Function("window", "document", "location", code)(win, doc, { href: "https://image.shep.bot/" });
    const send = win.umamiBeforeSend!;

    const view = send("event", { url: "https://image.shep.bot/search?q=oak+tree&utm_source=news#x", title: "“oak tree”: images", referrer: "https://image.shep.bot/search?q=waves" });
    expect(view).toEqual({ url: "https://image.shep.bot/search?utm_source=news", title: "", referrer: "https://image.shep.bot/search" });
    // Search rewrites the query as you type: same path, no second view.
    expect(send("event", { url: "https://image.shep.bot/search?q=rock", title: "“rock”" })).toBeNull();
    expect(send("event", { url: "https://image.shep.bot/docs", title: "Docs" })).toEqual({ url: "https://image.shep.bot/docs", title: "Docs" });
    // Custom events always go through, with the same cleaning.
    expect(send("event", { name: "outbound", url: "https://image.shep.bot/search?q=x", title: "“x”" })).toMatchObject({ url: "https://image.shep.bot/search", title: "" });
  });

  it("sends HSTS on HTTPS only", async () => {
    expect((await app.request("/", html)).headers.get("strict-transport-security")).toBe("max-age=31536000; includeSubDomains");
    const plain = createApp(service(), { siteRoot: SITE });
    expect((await plain.request("/", html)).headers.get("strict-transport-security")).toBeNull();
    const proxied = await plain.request("/", { headers: { accept: "text/html", "x-forwarded-proto": "https" } });
    expect(proxied.headers.get("strict-transport-security")).toContain("max-age=31536000");
  });

  it("allows CORS on the API and machine-readable files but not on pages", async () => {
    const origin = { headers: { origin: "https://example.com", accept: "text/html" } };
    expect((await app.request("/", origin)).headers.get("access-control-allow-origin")).toBeNull();
    expect((await app.request("/docs/mcp", origin)).headers.get("access-control-allow-origin")).toBeNull();
    expect((await app.request("/v1/providers", origin)).headers.get("access-control-allow-origin")).toBe("*");
    expect((await app.request("/llms.txt", origin)).headers.get("access-control-allow-origin")).toBe("*");
    expect((await app.request("/AGENTS.md", origin)).headers.get("access-control-allow-origin")).toBe("*");
  });

  it("serves Brotli to clients that accept it", async () => {
    const res = await app.request("/", { headers: { accept: "text/html", "accept-encoding": "gzip, br" } });
    expect(res.headers.get("content-encoding")).toBe("br");
    expect(res.headers.get("vary")).toContain("Accept-Encoding");
    expect(brotliDecompressSync(Buffer.from(await res.arrayBuffer())).toString()).toContain("<h1");
    const identity = await app.request("/", html);
    expect(identity.headers.get("content-encoding")).not.toBe("br");
  });

  it("caches unhashed static files for a day and fingerprinted assets forever", async () => {
    expect((await app.request("/llms.txt")).headers.get("cache-control")).toBe("public, max-age=86400");
    expect((await app.request("/_astro/app.abc123.js")).headers.get("cache-control")).toContain("immutable");
    expect((await app.request("/", html)).headers.get("cache-control")).toContain("max-age=0");
  });

  it("gives /search query variants unique, noindex metadata and a style nonce", async () => {
    const res = await app.request("/search?q=crashing%20waves&category=nature.ocean", html);
    const body = await res.text();
    expect(body).toContain("<title>“crashing waves”: ocean &amp; beach images · Image Asset Server</title>");
    expect(body).toContain('<meta name="robots" content="noindex, follow">');
    expect(body).toContain('<meta property="og:title" content="“crashing waves”: ocean &amp; beach images · Image Asset Server">');
    const nonce = body.match(/<meta property="csp-nonce" content="([^"]+)">/)![1]!;
    expect(res.headers.get("content-security-policy")).toContain(`'nonce-${nonce}'`);
    expect(res.headers.get("etag")).toBeNull();
    const other = await (await app.request("/search?category=art.painting&free=true", html)).text();
    expect(other).toContain(`<title>Free paintings: search ${allProviders.length} sites · Image Asset Server</title>`);
    const plain = await (await app.request("/search", html)).text();
    expect(plain).toMatch(/<title>[^<]*Image Asset Server<\/title>/);
    expect(plain).not.toContain("noindex");
    expect(plain).toContain('content="index, follow"');
    const again = await (await app.request("/search", html)).text();
    expect(again.match(/csp-nonce" content="([^"]+)"/)![1]).not.toBe(plain.match(/csp-nonce" content="([^"]+)"/)![1]);
  });

  it("only relaxes inline styles for the API playground", async () => {
    expect((await app.request("/docs/api/playground", html)).headers.get("content-security-policy")).toContain("style-src 'self' 'unsafe-inline'");
    expect((await app.request("/docs/mcp", html)).headers.get("content-security-policy")).not.toContain("'unsafe-inline'");
  });

  it("builds search metadata and escapes it into the head", () => {
    expect(searchMeta(new URLSearchParams(""))).toBeUndefined();
    expect(searchMeta(new URLSearchParams("category=archive.map&free=true"))!.title).toBe(`Free maps: search ${allProviders.length} sites · Image Asset Server`);
    const long = searchMeta(new URLSearchParams(`q=${"very long query words ".repeat(6)}&category=nature.ocean,icons&free=true`))!;
    expect(long.title.length).toBeLessThanOrEqual(MAX_TITLE);
    expect(long.description.length).toBeLessThanOrEqual(MAX_DESCRIPTION);
    const image = imageMeta({ id: "fake:1", provider: "fake", title: "Oil Painting Of A Very Long Mountain Range At Golden Hour In Autumn With Cows", category: "art.painting", author: "someone with a long name", url: "https://example.com", width: 3840, height: 2160, license: { id: "CC-BY-4.0", name: "CC BY 4.0", verdict: "yes-with-credit" } } as never);
    expect(image.title.length).toBeLessThanOrEqual(MAX_TITLE);
    expect(image.title).toMatch(/: painting( on .+)? · Image Asset Server$/);
    expect(image.description).toContain("3840 × 2160");
    expect(image.description.length).toBeLessThanOrEqual(MAX_DESCRIPTION);
    const out = rewriteHead('<title>x</title><meta name="description" content="y">', { title: '<b>"t"</b>', description: "d & e" });
    expect(out).toBe('<title>&lt;b&gt;&quot;t&quot;&lt;/b&gt;</title><meta name="description" content="d &amp; e">');
  });
});

