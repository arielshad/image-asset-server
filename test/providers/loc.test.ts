import { describe, expect, it } from "vitest";
import { licenseOf, loc, sizedUrl } from "../../src/providers/loc.js";
import { fixtureCtx } from "../helpers.js";

const routes: [string | RegExp, string][] = [
  ["loc.gov/photos/", "loc/search.json"],
  ["loc.gov/item/2016645615/", "loc/item.json"],
];

describe("loc", () => {
  it("maps viewable items with the rights advisory as the licence", async () => {
    const ctx = fixtureCtx(routes);
    const res = await loc.search({ query: "lighthouse", limit: 3 }, ctx);
    expect(ctx.fetch.requests[0]).toContain("fa=access-restricted%3Afalse");
    expect(res.total).toBe(1295);
    expect(res.images).toHaveLength(3);
    const free = res.images.find((i) => i.nativeId === "2016645615")!;
    expect(free).toMatchObject({
      title: "Lighthouse with outbuildings",
      author: "James Fuller Queen",
      year: 1850,
      width: 1024,
      height: 557,
      styles: ["drawing"],
      thumbnailUrl: "https://tile.loc.gov/storage-services/service/pnp/ppmsca/40200/40217_150px.jpg",
      previewUrl: "https://tile.loc.gov/storage-services/service/pnp/ppmsca/40200/40217v.jpg",
      url: "https://www.loc.gov/item/2016645615/",
    });
    expect(free.license).toMatchObject({ id: "LicenseRef-No-Known-Restrictions", verdict: "yes" });
    const restricted = res.images.find((i) => i.nativeId === "2019681337")!;
    expect(restricted.license).toMatchObject({ verdict: "check-terms" });
    expect(restricted.license?.note).toContain("Publication may be restricted");
  });

  it("gets every file of an item, master TIFF first", async () => {
    const d = await loc.getImage!("2016645615", fixtureCtx(routes));
    expect(d?.files[0]).toMatchObject({ role: "original", format: "tif", sizeBytes: 25288314 });
    expect(d?.files.filter((f) => f.format === "jpg").length).toBe(3);
    expect(d?.license?.verdict).toBe("yes");
  });

  it("parses sizes and advisories", () => {
    expect(sizedUrl("https://x/a.jpg#h=420&w=314")).toEqual({ url: "https://x/a.jpg", width: 314, height: 420 });
    expect(licenseOf(undefined).verdict).toBe("check-terms");
  });
});
