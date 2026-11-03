import { describe, expect, it } from "vitest";
import { artic, iiif } from "../../src/providers/artic.js";
import { fixtureCtx } from "../helpers.js";

const routes: [string | RegExp, string][] = [
  ["/artworks/search", "artic/search.json"],
  ["/artworks/20029", "artic/artwork.json"],
];

describe("artic", () => {
  it("searches public-domain works with IIIF thumbnails and previews, sending AIC-User-Agent", async () => {
    const ctx = fixtureCtx(routes);
    let sent: Record<string, string> | undefined;
    const json = ctx.fetch.json.bind(ctx.fetch);
    ctx.fetch.json = (async (url: string, init?: { headers?: Record<string, string> }) => {
      sent = init?.headers;
      return json(url);
    }) as typeof ctx.fetch.json;
    const res = await artic.search({ query: "sunflowers", limit: 3 }, ctx);
    expect(sent?.["AIC-User-Agent"]).toBeTruthy();
    expect(decodeURIComponent(ctx.fetch.requests[0]!)).toContain("query[bool][must][0][term][is_public_domain]=true");
    expect(res.images).toHaveLength(3);
    const first = res.images[0]!;
    expect(first).toMatchObject({
      id: "artic:20029",
      title: "Sunflowers, Marché St Germain, Paris",
      author: "James McNeill Whistler",
      width: 2784,
      height: 2250,
      orientation: "landscape",
      year: 1888,
      styles: ["drawing"],
      thumbnailUrl: iiif("2e9476db-2d28-c197-25d8-9b525d63d5a0", 400),
      previewUrl: "https://www.artic.edu/iiif/2/2e9476db-2d28-c197-25d8-9b525d63d5a0/full/843,/0/default.jpg",
      url: "https://www.artic.edu/artworks/20029",
    });
    expect(first.category.startsWith("art")).toBe(true);
    expect(first.license?.verdict).toBe("yes");
  });

  it("lists IIIF sizes up to the full scan", async () => {
    const d = await artic.getImage!("20029", fixtureCtx(routes));
    expect(d?.files.map((f) => [f.role, f.width])).toEqual([
      ["original", 2784],
      ["rendition", 1686],
      ["rendition", 843],
      ["thumbnail", 400],
    ]);
    expect(d?.files[0]!.url).toBe("https://www.artic.edu/iiif/2/2e9476db-2d28-c197-25d8-9b525d63d5a0/full/full/0/default.jpg");
  });
});
