import { describe, expect, it } from "vitest";
import { classify, wordTokens } from "../src/core/classify.js";
import { asEditorial, attributionLine, creativeCommons, license, parseLicense, royaltyFree } from "../src/core/licence.js";
import { formatSize, frameSizeFromText, parseQuery } from "../src/core/query.js";
import { makeImage, matchScore, parseImageId } from "../src/core/util.js";
import { orientationOf, resolutionLabel, resolutionTier } from "../src/core/vocab.js";

describe("classify", () => {
  it.each([
    ["Ocean waves crashing on the beach", "nature.ocean"],
    ["Waterfall in the forest", "nature.water"],
    ["Storm clouds at sunset", "nature.sky"],
    ["Field of sunflowers", "nature.plants"],
    ["Red fox in the snow", "animals"],
    ["Earth from space: ISS view", "space.earth"],
    ["Falcon 9 rocket launch", "space.missions"],
    ["Saturn and its rings", "space.planets"],
    ["New York skyline at night", "city.skyline"],
    ["Gothic cathedral interior", "architecture"],
    ["Portrait of a baker at work", "people"],
    ["Oil painting of a harbour", "art.painting"],
    ["Woodcut of a horse", "art.drawing"],
    ["Antique map of Paris", "archive.map"],
    ["Vintage travel poster", "archive.poster"],
    ["Old paper texture background", "background"],
    ["Rocket icon", "icons"],
    ["Untitled 0042", "other"],
  ])("%s -> %s", (title, category) => expect(classify({ title }).category).toBe(category));

  it("uses the source's keywords and tags, and lets context cancel an alias", () => {
    expect(classify({ title: "Image 12", sourceCategories: ["Planets & Moons", "Mars"] }).category).toBe("space.planets");
    expect(classify({ title: "Untitled", tags: ["coral", "reef"] }).category).toBe("nature.ocean");
    expect(classify({ title: "Watercolor of a heron" }).category).not.toBe("nature.water");
  });

  it("finds styles in titles, tags and keywords", () => {
    expect(classify({ title: "Watercolor of a heron" }).styles).toEqual(["painting"]);
    expect(classify({ title: "Pen and ink sketch of a tree" }).styles).toEqual(["drawing"]);
    expect(classify({ title: "Coney Island", tags: ["B&W"] }).styles).toEqual(["black-white"]);
    expect(classify({ title: "Coffee cup isolated on transparent background" }).styles).toEqual(["transparent"]);
  });

  it("splits camelCase and digits, keeping b&w", () => {
    expect(wordTokens("EarthFromSpace4K B&W")).toEqual(["earth", "from", "space", "4", "k", "b&w"]);
  });
});

describe("query parsing", () => {
  it("pulls size, orientation, format, transparency and style out of the query", () => {
    expect(parseQuery("4k vertical mountain lake")).toMatchObject({
      query: "mountain lake",
      minResolution: 2160,
      orientations: ["portrait"],
      hints: expect.arrayContaining(["nature.water", "nature.mountain"]),
    });
    expect(parseQuery("city skyline 16:9 1080p")).toMatchObject({ query: "city skyline", orientations: ["landscape"], minResolution: 1080 });
    expect(parseQuery("high resolution van gogh painting")).toMatchObject({ query: "van gogh painting", minResolution: 1440, styles: ["painting"] });
    expect(parseQuery("rocket icon svg")).toMatchObject({ query: "rocket", formats: ["svg"], styles: expect.arrayContaining(["icon", "vector"]) });
    expect(parseQuery("coffee cup transparent png")).toMatchObject({ query: "coffee cup", transparent: true, formats: ["png", "svg"] });
    expect(parseQuery("free stock photos of waves")).toMatchObject({ query: "waves", styles: ["photo"] });
    expect(parseQuery("square avatar")).toMatchObject({ orientations: ["square"] });
    expect(parseQuery("ocean")).toEqual({ query: "ocean", hints: ["nature.ocean"] });
  });

  it("leaves numbers that are not image facts alone, and 'portrait' means people", () => {
    expect(parseQuery("apollo 11").query).toBe("apollo 11");
    expect(parseQuery("1960s cars").minResolution).toBeUndefined();
    expect(parseQuery("portrait of a woman").orientations).toBeUndefined();
  });

  it("reads pixel sizes from titles", () => {
    expect(frameSizeFromText("Wallpaper 3840x2160")).toEqual({ width: 3840, height: 2160 });
    expect(frameSizeFromText("Scan 6000 × 4000 px")).toEqual({ width: 6000, height: 4000 });
    expect(frameSizeFromText("Room 101")).toBeUndefined();
    expect(formatSize(1920, 1080)).toBe("1920 × 1080");
  });

  it("knows orientation and size tiers by the short side", () => {
    expect(orientationOf(1080, 1920)).toBe("portrait");
    expect(orientationOf(1080, 1060)).toBe("square");
    expect(resolutionTier(1080, 1920)).toBe("fhd");
    expect(resolutionTier(1920, 1050)).toBe("fhd");
    expect(resolutionTier(3840, 2160)).toBe("uhd");
    expect(resolutionLabel(640, 360)).toBe("Small");
  });
});

describe("licences", () => {
  it.each([
    ["http://creativecommons.org/publicdomain/zero/1.0/", "CC0-1.0", "yes"],
    ["CC0", "CC0-1.0", "yes"],
    ["https://creativecommons.org/licenses/by/4.0/", "CC-BY-4.0", "yes-with-credit"],
    ["Attribution NonCommercial", "CC-BY-NC-4.0", "no"],
    ["CC BY-SA 3.0", "CC-BY-SA-3.0", "restricted"],
    ["https://creativecommons.org/licenses/by-nd/4.0/", "CC-BY-ND-4.0", "no"],
    ["Public domain", "CC-PDM-1.0", "yes"],
    ["http://creativecommons.org/licenses/publicdomain/", "CC-PDM-1.0", "yes"],
    ["Personal Use Only", "LicenseRef-Personal-Use-Only", "no"],
    ["All rights reserved", "LicenseRef-All-Rights-Reserved", "no"],
  ])("%s -> %s (%s)", (input, id, verdict) => {
    const l = parseLicense(input)!;
    expect(l.id).toBe(id);
    expect(l.verdict).toBe(verdict);
  });

  it("never treats an uploader's claim as cleared", () => {
    expect(license("CC0-1.0", "uploader").verdict).toBe("check-terms");
    expect(creativeCommons({}, "4.0", "uploader").verdict).toBe("check-terms");
  });

  it("knows NASA's terms: credit, no endorsement, editorial for people and insignia", () => {
    const nasa = license("LicenseRef-NASA-Media");
    expect(nasa).toMatchObject({ verdict: "yes-with-credit", attributionRequired: true, editorial: true });
    expect(asEditorial(license("CC0-1.0"), "Shows people.")).toMatchObject({ verdict: "yes", editorial: true, note: "Shows people." });
  });

  it("knows icon-set licences: MIT and Apache need the notice kept, OFL doesn't", () => {
    expect(parseLicense("MIT")).toMatchObject({ id: "MIT", verdict: "yes-with-credit" });
    expect(parseLicense("Apache 2.0")).toMatchObject({ id: "Apache-2.0", verdict: "yes-with-credit" });
    expect(parseLicense("OFL-1.1")).toMatchObject({ id: "OFL-1.1", verdict: "yes" });
  });

  it("free stock licences allow use in your work but not re-uploading", () => {
    const l = royaltyFree("Pexels License");
    expect(l).toMatchObject({ verdict: "yes", redistribution: false, assertedBy: "site" });
    expect(royaltyFree("X", { attributionRequired: true }).verdict).toBe("yes-with-credit");
  });

  it("writes a credit line only when attribution is required", () => {
    const c = { title: "Waves", author: "Jane", url: "https://x/1", provider: "wikimediacommons", license: creativeCommons({}) };
    expect(attributionLine(c, "Wikimedia Commons")).toBe(
      "“Waves” by Jane (Wikimedia Commons), https://x/1, licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)",
    );
    expect(attributionLine({ ...c, license: license("CC0-1.0") })).toBeUndefined();
  });
});

describe("makeImage", () => {
  it("fills category, styles, orientation and credits", () => {
    const c = makeImage({
      provider: "x",
      nativeId: "1",
      title: "Storm clouds over the sea, black and white 1080x1920",
      tags: ["Sky"],
      url: "https://x",
      previewUrl: "https://cdn.x/p.jpg",
      license: creativeCommons({}),
      sourceName: "X",
      downloadable: true,
    });
    expect(c).toMatchObject({ id: "x:1", category: "nature.sky", styles: ["black-white"], width: 1080, height: 1920, orientation: "portrait", tags: ["sky"] });
    expect(c.categoryEvidence?.by).toBe("rules");
    expect(c.attribution).toContain("(X)");
  });
  it("marks vectors and transparent images, and trusts the source's kind over title words", () => {
    const icon = makeImage({ provider: "x", nativeId: "2", title: "Camera", url: "https://x", vector: true, transparent: true, styles: ["icon"], downloadable: true });
    expect(icon.styles).toEqual(["icon", "vector", "transparent"]);
    expect(icon.transparent).toBe(true);
    const photo = makeImage({ provider: "x", nativeId: "3", title: "Painting a fence, photo by Ann", url: "https://x", styles: ["photo"], downloadable: true });
    expect(photo.styles).toEqual(["photo"]);
  });
  it("keeps the source's own category", () => {
    const c = makeImage({ provider: "x", nativeId: "1", title: "Thing", category: "space.missions", url: "https://x", downloadable: true });
    expect(c.categoryEvidence).toEqual({ by: "source", confidence: 1 });
  });
});

describe("matchScore", () => {
  it("prefers title over tags and handles plurals", () => {
    expect(matchScore({ title: "Ocean Waves" }, "ocean wave")).toBe(1);
    expect(matchScore({ title: "Picture", tags: ["ocean"] }, "ocean")).toBeCloseTo(0.7);
    expect(matchScore({ title: "City" }, "ocean")).toBe(0);
  });
});

describe("parseImageId", () => {
  it("splits on the first colon only", () => {
    expect(parseImageId("iconify:mdi:rocket")).toEqual({ provider: "iconify", nativeId: "mdi:rocket" });
    expect(parseImageId("bad")).toBeNull();
  });
});
