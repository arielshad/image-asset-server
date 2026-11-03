import { describe, expect, it } from "vitest";
import { filesFrom, licenseFor, nasa } from "../../src/providers/nasa.js";
import { fixtureCtx } from "../helpers.js";

const routes: [string | RegExp, string][] = [
  ["nasa_id=PIA03606", "nasa/item-PIA03606.json"],
  ["/search?", "nasa/search.json"],
  ["/PIA03606/collection.json", "nasa/collection-PIA03606.json"],
];

describe("nasa", () => {
  it("searches images with thumbnails, previews and a NASA credit", async () => {
    const ctx = fixtureCtx(routes);
    const res = await nasa.search({ query: "saturn", limit: 3 }, ctx);
    expect(ctx.fetch.requests[0]).toContain("media_type=image");
    expect(res.images).toHaveLength(3);
    for (const a of res.images) {
      expect(a.id).toMatch(/^nasa:PIA\d+$/);
      expect(a.thumbnailUrl).toMatch(/^https:\/\/images-assets\.nasa\.gov\/image\/.+~(thumb|small|medium)\.jpg$/);
      expect(a.previewUrl).toMatch(/^https:\/\//);
      expect(a.category.startsWith("space")).toBe(true);
      expect(a.license).toMatchObject({ verdict: "yes-with-credit", editorial: true });
      expect(a.url).toBe(`https://images.nasa.gov/details/${a.nativeId}`);
    }
  });

  it("lists the original and NASA's resized copies, biggest first", async () => {
    const d = await nasa.getImage!("PIA03606", fixtureCtx(routes));
    expect(d).not.toBeNull();
    expect(d!.width).toBe(3864);
    expect(d!.files[0]).toMatchObject({ role: "original", format: "jpg", width: 3864 });
    const renditions = d!.files.filter((f) => f.role === "rendition").map((f) => f.width);
    expect(renditions).toEqual([...renditions].sort((a, b) => b! - a!));
    expect(d!.files.at(-1)!.role).toBe("thumbnail");
  });

  it("flags third-party credits as check-terms", () => {
    expect(licenseFor({ nasa_id: "x", secondary_creator: "ESA/Hubble" }).verdict).toBe("check-terms");
    expect(licenseFor({ nasa_id: "x", photographer: "NASA/Bill Ingalls" }).verdict).toBe("yes-with-credit");
  });

  it("ignores metadata and non-image files", () => {
    const files = filesFrom("X", ["http://images-assets.nasa.gov/image/X/X~orig.tif", "http://images-assets.nasa.gov/image/X/metadata.json"], { width: 4000, height: 3000 });
    expect(files).toEqual([expect.objectContaining({ role: "original", format: "tif", url: "https://images-assets.nasa.gov/image/X/X~orig.tif" })]);
  });
});
