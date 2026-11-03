import { describe, expect, it } from "vitest";
import { commonsFileOf, licenseOf, openverse, searchParams } from "../../src/providers/openverse.js";
import { fixtureCtx } from "../helpers.js";

const routes: [string | RegExp, string][] = [
  ["/v1/images/stats/", "openverse/stats.json"],
  [/\/v1\/images\/ca2f84d6-b8e1-42d5-b269-2ea488282840\//, "openverse/detail.json"],
  ["api.openverse.org/v1/images/?", "openverse/search.json"],
];

describe("openverse", () => {
  it("maps results with Openverse thumbnails, source CDN files and per-image CC licences", async () => {
    const ctx = fixtureCtx(routes);
    const res = await openverse.search({ query: "lighthouse", limit: 4 }, ctx);
    expect(ctx.fetch.requests).toHaveLength(1);
    expect(res.total).toBe(240);
    expect(res.images).toHaveLength(4);
    const first = res.images[0]!;
    expect(first).toMatchObject({
      id: "openverse:ca2f84d6-b8e1-42d5-b269-2ea488282840",
      title: "Wollongong Breakwater Lighthouse",
      url: "https://www.flickr.com/photos/53368913@N05/6038356446",
      author: "Pandora's Perspective",
      width: 1024,
      height: 683,
      orientation: "landscape",
      thumbnailUrl: "https://api.openverse.org/v1/images/ca2f84d6-b8e1-42d5-b269-2ea488282840/thumb/",
      previewUrl: "https://live.staticflickr.com/6149/6038356446_164f13867f_b.jpg",
      downloadable: true,
    });
    // Flickr licences are the uploader's own claim, and NC is never commercial.
    expect(first.license).toMatchObject({ id: "CC-BY-NC-SA-2.0", verdict: "no", assertedBy: "uploader" });
    const commons = res.images.find((i) => i.sameAs?.length)!;
    expect(commons.sameAs).toEqual(["wikimediacommons:Cape_hatteras_lighthouse_img_0529.jpg"]);
    expect(commons.license).toMatchObject({ id: "CC-BY-SA-3.0", verdict: "restricted", assertedBy: "source" });
    expect(commons.attribution).toContain("Henryhartley");
  });

  it("sends orientation, size, format and commercial filters to the API", () => {
    const p = searchParams({ query: "fox", limit: 10, orientations: ["portrait"], minResolution: 2160, formats: ["png"], commercialOnly: true });
    expect(p).toMatchObject({ q: "fox", aspect_ratio: "tall", size: "large", extension: "png", license_type: "commercial" });
    expect(openverse.buildSearchUrl({ query: "fox", limit: 10, commercialOnly: true })).toBe("https://openverse.org/search/image?q=fox&license_type=commercial");
  });

  it("gets one image by id with its files", async () => {
    const d = await openverse.getImage!("ca2f84d6-b8e1-42d5-b269-2ea488282840", fixtureCtx(routes));
    expect(d?.files.map((f) => f.role)).toEqual(["original", "thumbnail"]);
    expect(d?.files[0]).toMatchObject({ format: "jpg", url: "https://live.staticflickr.com/6149/6038356446_164f13867f_b.jpg" });
    expect(await openverse.getImage!("not-a-uuid", fixtureCtx(routes))).toBeNull();
  });

  it("reads licence codes and Commons file names", () => {
    expect(licenseOf({ license: "cc0", source: "smithsonian" }).verdict).toBe("yes");
    expect(licenseOf({ license: "pdm", source: "met" }).id).toBe("CC-PDM-1.0");
    expect(licenseOf({ license: "by", license_version: "4.0", source: "flickr" }).verdict).toBe("check-terms");
    expect(commonsFileOf("https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/A%20b.jpg/640px-A%20b.jpg")).toBe("A b.jpg");
    expect(commonsFileOf("https://live.staticflickr.com/1/2.jpg")).toBeUndefined();
  });

  it("counts the catalogue from the stats endpoint, as a mirror", async () => {
    const c = await openverse.census!(fixtureCtx(routes));
    expect(c.mirror).toBe(true);
    expect(c.total).toBeGreaterThan(900_000_000);
    expect(c.categories?.["Wikimedia Commons"]).toBe(88962441);
  });
});
