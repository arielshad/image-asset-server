import { describe, expect, it } from "vitest";
import { iconify, licenseOf } from "../../src/providers/iconify.js";
import { fixtureCtx } from "../helpers.js";

const routes: [string | RegExp, string][] = [
  ["api.iconify.design/search", "iconify/search.json"],
  ["api.iconify.design/collections?prefix=tabler", "iconify/collection-tabler.json"],
  ["api.iconify.design/tabler.json", "iconify/icon-tabler.json"],
];

describe("iconify", () => {
  it("maps icon names to SVG icons with their set's licence", async () => {
    const ctx = fixtureCtx(routes);
    const res = await iconify.search({ query: "rocket", limit: 32 }, ctx);
    expect(ctx.fetch.requests[0]).toContain("limit=32");
    expect(res.images).toHaveLength(32);
    const tabler = res.images.find((i) => i.nativeId === "tabler:rocket")!;
    expect(tabler).toMatchObject({
      title: "rocket (Tabler Icons)",
      category: "icons",
      vector: true,
      transparent: true,
      width: 24,
      height: 24,
      thumbnailUrl: "https://api.iconify.design/tabler/rocket.svg",
      url: "https://icon-sets.iconify.design/tabler/rocket/",
      author: "Paweł Kuna",
      formats: ["svg"],
    });
    expect(tabler.styles).toEqual(expect.arrayContaining(["icon", "vector", "transparent"]));
    expect(tabler.license).toMatchObject({ id: "MIT", verdict: "yes-with-credit" });
  });

  it("pages with start and skips photo-only searches", async () => {
    const ctx = fixtureCtx(routes);
    await iconify.search({ query: "rocket", limit: 10, offset: 40 }, ctx);
    expect(ctx.fetch.requests[0]).toContain("start=40");
    expect(ctx.fetch.requests[0]).toContain("limit=50");
    const photos = await iconify.search({ query: "rocket", limit: 10, styles: ["photo"] }, ctx);
    expect(photos.images).toHaveLength(0);
  });

  it("gets one icon with its own size", async () => {
    const d = await iconify.getImage!("tabler:rocket", fixtureCtx(routes));
    expect(d?.files).toEqual([expect.objectContaining({ format: "svg", role: "original", url: "https://api.iconify.design/tabler/rocket.svg" })]);
    expect(await iconify.getImage!("Bad Id", fixtureCtx(routes))).toBeNull();
  });

  it("maps set licences to verdicts", () => {
    expect(licenseOf({ license: { spdx: "CC-BY-4.0" } }).verdict).toBe("yes-with-credit");
    expect(licenseOf({ license: { spdx: "CC-BY-SA-4.0" } }).verdict).toBe("restricted");
    expect(licenseOf({ license: { spdx: "GPL-3.0-or-later", title: "GPL 3.0" } }).verdict).toBe("restricted");
    expect(licenseOf({ license: { spdx: "OFL-1.1" } }).verdict).toBe("yes");
    expect(licenseOf({ license: { spdx: "Apache-2.0", url: "https://x/LICENSE" } })).toMatchObject({ verdict: "yes-with-credit", url: "https://x/LICENSE" });
  });
});
