import { describe, expect, it } from "vitest";
import { searchText, thumbAt, wikimediacommons } from "../../src/providers/wikimediacommons.js";
import { fixtureCtx } from "../helpers.js";

const routes: [string | RegExp, string][] = [["generator=search", "wikimediacommons/search.json"]];

describe("wikimediacommons", () => {
  it("searches bitmaps and drawings with a licence per file", async () => {
    const ctx = fixtureCtx(routes);
    const res = await wikimediacommons.search({ query: "saturn", limit: 3 }, ctx);
    expect(decodeURIComponent(ctx.fetch.requests[0]!)).toContain("filetype:bitmap|drawing");
    expect(res.images).toHaveLength(3);
    const first = res.images[0]!;
    expect(first).toMatchObject({ provider: "wikimediacommons", category: "space.planets", downloadable: true });
    expect(first.license).toMatchObject({ id: "CC-PDM-1.0", verdict: "yes" });
    expect(first.thumbnailUrl).toMatch(/\/330px-/);
    expect(first.previewUrl).toMatch(/\/1280px-/);
    expect(first.width).toBeGreaterThan(1280);
  });

  it("builds the search text with the size and kind", () => {
    expect(searchText({ query: "saturn", minResolution: 2160 })).toBe("saturn filetype:bitmap|drawing filew:>2094 fileh:>2094");
    expect(searchText({ query: "rocket", styles: ["icon"] })).toBe("rocket filetype:drawing");
  });

  it("resizes thumbnails by rewriting the width", () => {
    expect(thumbAt("https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/X.jpg/330px-X.jpg", 1920)).toBe("https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/X.jpg/1920px-X.jpg");
  });
});
