import { describe, expect, it } from "vitest";
import { creditEntry, creditsJson, creditsMarkdown, mergeCredits } from "../src/core/credits.js";
import { asEditorial, creativeCommons, license, royaltyFree } from "../src/core/licence.js";
import type { ImageAsset } from "../src/core/types.js";

function image(id: string, title: string, extra: Partial<ImageAsset> = {}): ImageAsset {
  return {
    id: `wikimediacommons:${id}`,
    provider: "wikimediacommons",
    nativeId: id,
    title,
    url: `https://commons.wikimedia.org/wiki/File:${id}`,
    author: "jdoe",
    authorUrl: "https://commons.wikimedia.org/wiki/User:jdoe",
    tags: [],
    category: "nature.ocean",
    downloadable: true,
    license: license("CC0-1.0"),
    ...extra,
  };
}

const NOW = new Date("2026-10-23T10:00:00.000Z");
const names = { wikimediacommons: "Wikimedia Commons", pexels: "Pexels", nasa: "NASA" };
const cc0 = image("1", "Ocean Waves");
const by = image("2", "Surf *close-up*", { license: creativeCommons({}) });
const nc = image("3", "NC Harbour", { license: creativeCommons({ nc: true }), author: undefined, authorUrl: undefined });
const rf = image("4", "Pexels Beach", { provider: "pexels", id: "pexels:4", url: "https://www.pexels.com/video/4/", license: royaltyFree("Pexels License", { url: "https://www.pexels.com/license/" }) });
const none = image("5", "Mystery Film", { license: undefined });
const astronaut = image("6", "Spacewalk", { provider: "nasa", id: "nasa:6", url: "https://images.nasa.gov/details/6", license: asEditorial(license("LicenseRef-NASA-Media"), "") });

describe("creditsJson", () => {
  it("one machine-readable entry per image with licence, verdict and credit line", () => {
    const j = creditsJson([cc0, by, by], { sourceNames: names, now: NOW });
    expect(j.generator).toBe("image-asset-server");
    expect(j.generatedAt).toBe("2026-10-23T10:00:00.000Z");
    expect(j.images).toHaveLength(2); // deduped by id
    expect(j.commercialSafe).toBe(true);
    expect(j.creditsNeeded).toBe(true);
    expect(j.images[0]).toEqual({
      id: "wikimediacommons:1",
      provider: "wikimediacommons",
      source: "Wikimedia Commons",
      title: "Ocean Waves",
      author: "jdoe",
      authorUrl: "https://commons.wikimedia.org/wiki/User:jdoe",
      url: "https://commons.wikimedia.org/wiki/File:1",
      license: {
        id: "CC0-1.0",
        name: "CC0 1.0",
        url: "https://creativecommons.org/publicdomain/zero/1.0/",
        verdict: "yes",
        verdictLabel: "Commercial use OK",
        attributionRequired: false,
        commercialUse: true,
      },
      downloadedAt: "2026-10-23T10:00:00.000Z",
    });
    expect(j.images[1]!.attribution).toBe(
      "“Surf *close-up*” by jdoe (Wikimedia Commons), https://commons.wikimedia.org/wiki/File:2, licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)",
    );
    expect(j.images[1]!.license).toMatchObject({ id: "CC-BY-4.0", verdict: "yes-with-credit", attributionRequired: true });
    expect(j.editorialOnly).toBe(false);
  });

  it("uses the image's own attribution line, per-id timestamps and files", () => {
    const own = { ...by, attribution: "Surf by jdoe — CC BY" };
    const e = creditEntry(own, { downloadedAt: { [own.id]: "2026-01-01T00:00:00Z" }, files: { [own.id]: [{ path: "nature/ocean/surf.webm", sha256: "ab" }] } });
    expect(e.attribution).toBe("Surf by jdoe — CC BY");
    expect(e.downloadedAt).toBe("2026-01-01T00:00:00Z");
    expect(e.files).toEqual([{ path: "nature/ocean/surf.webm", sha256: "ab" }]);
    expect(creditEntry(cc0, { downloadedAt: {} }).downloadedAt).toBeUndefined();
  });

  it("marks unsafe sets and images without a licence", () => {
    const j = creditsJson([cc0, nc, none], { now: NOW });
    expect(j.commercialSafe).toBe(false);
    expect(j.creditsNeeded).toBe(true); // NC still asks for credit
    expect(j.images[2]!.license).toEqual({ id: "LicenseRef-Unknown", name: "No licence stated", verdict: "check-terms", verdictLabel: "Unclear: check the terms", attributionRequired: false });
  });

  it("mergeCredits is idempotent by id and combines files", () => {
    const a = creditsJson([cc0], { now: NOW, files: { [cc0.id]: [{ path: "waves.webm" }] } });
    const b = creditsJson([cc0, by], { now: new Date("2026-10-24T00:00:00Z"), files: { [cc0.id]: [{ path: "waves.webm" }, { path: "seq/waves.webm" }] } });
    const m = mergeCredits(a, b);
    expect(m.images.map((x) => x.id)).toEqual(["wikimediacommons:1", "wikimediacommons:2"]);
    expect(m.images[0]!.files).toEqual([{ path: "waves.webm" }, { path: "seq/waves.webm" }]);
    expect(m.generatedAt).toBe("2026-10-24T00:00:00.000Z");
    expect(mergeCredits(m, b)).toEqual(m);
    expect(mergeCredits(undefined, a).images).toHaveLength(1);
  });
});

describe("creditsMarkdown", () => {
  it("groups by licence, lists TASL and the credit lines to publish", () => {
    const md = creditsMarkdown([by, cc0, rf], names, { now: NOW });
    expect(md.startsWith("# Attribution\n")).toBe(true);
    expect(md).not.toContain("Warning");
    expect(md).toContain("## Credits to publish");
    expect(md).toContain("- “Surf *close-up*” by jdoe (Wikimedia Commons), https://commons.wikimedia.org/wiki/File:2, licensed under CC BY 4.0");
    // most permissive first: CC0 / royalty-free (yes) before CC BY (yes-with-credit)
    const cc0At = md.indexOf("## [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)");
    const byAt = md.indexOf("## [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)");
    expect(cc0At).toBeGreaterThan(0);
    expect(byAt).toBeGreaterThan(cc0At);
    expect(md).toContain("Commercial use OK with credit. Attribution required.");
    expect(md).toContain("- **Ocean Waves** by [jdoe](https://commons.wikimedia.org/wiki/User:jdoe), Wikimedia Commons: https://commons.wikimedia.org/wiki/File:1");
    expect(md).toContain("- **Surf \\*close-up\\*** by");
    expect(md).toContain("Pexels: https://www.pexels.com/video/4/");
    expect(md).toContain("id: `wikimediacommons:1`, downloaded 2026-10-23");
    expect(md).toContain("not legal advice");
  });

  it("puts a warning header first when anything is not commercial-safe", () => {
    const md = creditsMarkdown([cc0, nc, none], names);
    const warn = md.indexOf("> **Warning:** 2 of 3 images are not cleared for commercial use:");
    expect(warn).toBeGreaterThan(0);
    expect(warn).toBeLessThan(md.indexOf("## "));
    expect(md).toContain("> - NC Harbour (wikimediacommons:3): Non-commercial only");
    expect(md).toContain("> - Mystery Film (wikimediacommons:5): Unclear: check the terms");
    expect(md).toContain("by unknown author");
    expect(md).toContain("## No licence stated");
  });

  it("flags editorial images (people, insignia) as not for ads", () => {
    const j = creditsJson([cc0, astronaut], { now: NOW });
    expect(j.commercialSafe).toBe(true);
    expect(j.editorialOnly).toBe(true);
    const md = creditsMarkdown([cc0, astronaut], names);
    expect(md).toContain("> **Editorial use:** 1 image shows people, insignia or brands without releases");
    expect(md).toContain("> - Spacewalk (nasa:6)");
  });

  it("renders from a credits.json and handles an empty list", () => {
    const j = creditsJson([cc0], { sourceNames: names, now: NOW });
    expect(creditsMarkdown(j)).toBe(creditsMarkdown([cc0], names, { now: NOW }));
    expect(creditsMarkdown([])).toContain("No images yet.");
  });
});
