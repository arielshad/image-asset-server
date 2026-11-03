import { describe, expect, it } from "vitest";
import { altText, creditsHtml, downloadScript, imageSetExports, parseSlotList, planImageSet, slotFilename } from "../src/core/imageset.js";
import { ImageService } from "../src/core/service.js";
import { bytesHttp, fakeProvider } from "./fakes.js";

const service = () => new ImageService({ providers: [fakeProvider], http: bytesHttp(), defaultTimeoutMs: 500 });

describe("slot lists", () => {
  it("reads one slot per line, with list markers, labels and widths", () => {
    expect(parseSlotList("1. Hero: city skyline at dusk (2400px)\n- baker at work\n\n• paper texture background 800w")).toEqual([
      { description: "Hero city skyline at dusk", width: 2400 },
      { description: "baker at work" },
      { description: "paper texture background", width: 800 },
    ]);
    expect(parseSlotList("ocean; city")).toEqual([{ description: "ocean" }, { description: "city" }]);
  });

  it("expands 'N icons: a, b and c' into one slot per item", () => {
    expect(parseSlotList("3 icons: rocket, shield and chart")).toEqual([{ description: "rocket icon" }, { description: "shield icon" }, { description: "chart icon" }]);
  });

  it("turns titles into alt text", () => {
    expect(altText("Golden_Gate_Bridge_at_sunset.jpg")).toBe("Golden Gate Bridge at sunset");
  });
});

describe("planImageSet", () => {
  it("picks one image per slot, never twice, with the smallest file that fills the slot", async () => {
    const plan = await planImageSet(service(), { slots: [{ description: "ocean waves", width: 1600 }, { description: "ocean" }], commercialOnly: false });
    expect(plan.commercialSafe).toBe(true);
    expect(plan.slots[0]).toMatchObject({ image: { id: "fake:ocean" }, file: { url: "https://cdn.fake.example/ocean-1920.jpg", width: 1920 }, alt: "Ocean Waves at Sunset" });
    // The same image is not reused for the second slot.
    expect(plan.slots[1]!.image?.id).not.toBe("fake:ocean");
  });

  it("falls back to images that need cropping or upscaling, and says so", async () => {
    const plan = await planImageSet(service(), { slots: [{ description: "city traffic", width: 2400 }], orientation: "landscape", commercialOnly: false });
    expect(plan.slots[0]!.image?.id).toBe("fake:city");
    expect(plan.slots[0]!.note).toMatch(/1080px wide, below the 2400px slot/);
    expect(plan.slots[0]!.note).toMatch(/portrait; it will be cropped to landscape/);
    expect(plan.commercialSafe).toBe(false);
  });

  it("is commercial-safe by default and picks vectors for icon slots", async () => {
    const plan = await planImageSet(service(), { slots: [{ description: "city traffic" }, { description: "star icon" }] });
    expect(plan.slots[0]!.image).toBeUndefined();
    expect(plan.slots[0]!.note).toMatch(/No downloadable image matched/);
    expect(plan.slots[1]).toMatchObject({ image: { id: "fake:star" }, file: { format: "svg" } });
    expect(plan.slots[1]!.note).toBeUndefined();
  });

  it("needs at least one slot", async () => {
    await expect(planImageSet(service(), { slots: [] })).rejects.toThrow(/at least one slot/);
  });
});

describe("exports", () => {
  it("writes images.json, credits.html, download.sh and the credits", async () => {
    const plan = await planImageSet(service(), { slots: [{ description: "ocean waves" }, { description: "star icon" }], commercialOnly: false });
    const out = imageSetExports(plan, { name: "landing", sourceNames: { fake: "Fake" }, now: new Date("2026-11-03T00:00:00Z") });
    const manifest = JSON.parse(out["images.json"]);
    expect(manifest).toMatchObject({ name: "landing", commercialSafe: true });
    expect(manifest.images.map((i: { file: string }) => i.file)).toEqual(["01-ocean-waves.jpg", "02-star-icon.svg"]);
    expect(manifest.images[1]).toMatchObject({ license: "MIT License", verdict: "yes-with-credit" });
    expect(out["credits.html"]).toContain('<img src="https://cdn.fake.example/ocean-1920.jpg" alt="Ocean Waves at Sunset" width="1920" height="1080" loading="lazy">');
    expect(out["download.sh"]).toContain("curl -fsSL -A");
    expect(out["download.sh"]).toContain("'images/02-star-icon.svg' 'https://cdn.fake.example/star.svg'");
    expect(out["ATTRIBUTION.md"]).toContain("Star icon");
    expect(JSON.parse(out["credits.json"]).images).toHaveLength(2);
  });

  it("uses local paths when the picks were downloaded, and escapes HTML", () => {
    const slot = {
      index: 1,
      description: "a <b> thing",
      width: 800,
      image: { id: "fake:x", provider: "fake", nativeId: "x", title: 'Quote "and" <tag>', url: "https://x", tags: [], category: "other" as const, downloadable: true },
      file: { url: "https://cdn/x.png", filename: "x.png", format: "png", width: 800, height: 600 },
      alternatives: [],
    };
    expect(slotFilename(slot)).toBe("01-a-b-thing.png");
    const html = creditsHtml([slot], () => "images/01-a-b-thing.png");
    expect(html).toContain('src="images/01-a-b-thing.png"');
    expect(html).toContain("Quote &quot;and&quot; &lt;tag&gt;");
    expect(downloadScript([slot], "x")).toContain("'https://cdn/x.png'");
  });
});
