import { describe, expect, it } from "vitest";
import { met, stylesOf } from "../../src/providers/met.js";
import { fixtureCtx } from "../helpers.js";

const routes: [string | RegExp, string][] = [
  ["/v1.1/search", "met/search.json"],
  ["/v1/objects/436524", "met/object-436524.json"],
  ["/v1/objects/480725", "met/object-480725.json"],
  ["/v1/objects/484935", "met/object-484935.json"],
];

describe("met", () => {
  it("searches ids, fetches each object and keeps the public-domain ones with an image", async () => {
    const ctx = fixtureCtx(routes);
    const res = await met.search({ query: "sunflowers", limit: 3 }, ctx);
    expect(ctx.fetch.requests).toHaveLength(4);
    expect(ctx.fetch.requests[0]).toContain("isPublicDomain=true");
    expect(res.total).toBe(153);
    // Two of the three objects are not public domain and have no image.
    expect(res.images).toHaveLength(1);
    expect(res.images[0]).toMatchObject({
      id: "met:436524",
      title: "Sunflowers",
      author: "Vincent van Gogh",
      year: 1887,
      category: "art.painting",
      styles: ["painting"],
      thumbnailUrl: "https://images.metmuseum.org/CRDImages/ep/web-additional/DP-41223-001.jpg",
      previewUrl: "https://images.metmuseum.org/CRDImages/ep/web-large/DP-41223-001.jpg",
      url: "https://www.metmuseum.org/art/collection/search/436524",
      downloadable: true,
    });
    expect(res.images[0]!.license).toMatchObject({ id: "LicenseRef-Museum-Open-Access", verdict: "yes" });
  });

  it("returns the original scan and the web sizes as files", async () => {
    const d = await met.getImage!("436524", fixtureCtx(routes));
    expect(d?.files.map((f) => [f.role, f.url.split("/").slice(-2, -1)[0]])).toEqual([
      ["original", "original"],
      ["rendition", "web-large"],
      ["thumbnail", "web-additional"],
    ]);
    expect(await met.getImage!("480725", fixtureCtx(routes))).toBeNull();
  });

  it("reads the kind from the classification", () => {
    expect(stylesOf({ classification: "Photographs" })).toEqual(["photo"]);
    expect(stylesOf({ classification: "Prints", objectName: "Print" })).toEqual(["drawing"]);
    expect(stylesOf({ classification: "Ceramics" })).toBeUndefined();
  });
});
