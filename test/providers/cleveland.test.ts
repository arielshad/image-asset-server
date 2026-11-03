import { describe, expect, it } from "vitest";
import { cleveland } from "../../src/providers/cleveland.js";
import { fixtureCtx } from "../helpers.js";

const routes: [string | RegExp, string][] = [
  ["/api/artworks/?", "cleveland/search.json"],
  ["/api/artworks/151559", "cleveland/artwork.json"],
];

describe("cleveland", () => {
  it("maps CC0 artworks with web, print and full sizes", async () => {
    const ctx = fixtureCtx(routes);
    const res = await cleveland.search({ query: "sunflowers", limit: 3 }, ctx);
    expect(ctx.fetch.requests[0]).toContain("cc0=1");
    expect(res.total).toBe(5);
    expect(res.images).toHaveLength(3);
    expect(res.images[0]).toMatchObject({
      id: "cleveland:151559",
      title: "Vase Decorated with Sunflowers",
      author: "John D. Wareham",
      year: 1899,
      width: 4276,
      height: 4975,
      orientation: "portrait",
      thumbnailUrl: "https://openaccess-cdn.clevelandart.org/1984.10/1984.10_web.jpg",
      url: "https://clevelandart.org/art/1984.10",
      formats: ["tif", "jpg"],
    });
    expect(res.images[0]!.category).toBe("art.sculpture");
    expect(res.images[0]!.license?.verdict).toBe("yes");
  });

  it("returns the master TIFF first", async () => {
    const d = await cleveland.getImage!("151559", fixtureCtx(routes));
    expect(d?.files.map((f) => [f.role, f.format])).toEqual([
      ["original", "tif"],
      ["rendition", "jpg"],
      ["rendition", "jpg"],
    ]);
    expect(d?.files[0]!.sizeBytes).toBeGreaterThan(1_000_000);
  });
});
