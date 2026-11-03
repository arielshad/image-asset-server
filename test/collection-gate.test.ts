import { describe, expect, it } from "vitest";
// @ts-expect-error plain .mjs script without type declarations
import { MAX_NEW_TOPICS, checkChanges, checkSnapshots } from "../scripts/collection-gate.mjs";
// @ts-expect-error plain .mjs script without type declarations
import { coreTerms, ideasFrom, isCovered, sanitizeQuery } from "../scripts/collection-ideas.mjs";

type Topic = { slug: string; data: Record<string, unknown>; body: string };

const body = Array.from({ length: 120 }, (_, i) => `word${i}`).join(" ");
const topic = (slug: string, over: Record<string, unknown> = {}): Topic => ({
  slug,
  body,
  data: {
    title: "Free storm cloud photos",
    description: "Free storm cloud photos for headers, slides and weather stories: thunderheads, shelf clouds and lightning in high resolution, each with its licence verdict.",
    hub: "nature",
    search: { q: slug.replace(/-/g, " "), categories: ["nature.sky"], styles: ["photo"], free: true },
    related: ["existing-a", "existing-b"],
    faq: [
      { q: "Can I use these images on a commercial website?", a: "Check the verdict on each card: CC0 images need nothing, CC BY images need a credit, and NC images are for non-commercial use only." },
      { q: "How large are these storm cloud photos?", a: "Most are at least 1920 pixels wide, and many are full camera originals. Each card shows the pixel size when the source states it." },
    ],
    addedAt: "2026-10-07",
    addedBy: "agent",
    ...over,
  },
});
const existing = [topic("existing-a", { addedBy: "human" }), topic("existing-b", { addedBy: "human" })];
const base = { existing, hubs: ["nature", "space"], providers: ["wikimediacommons"] };
const file = (slug: string, status = "A") => ({ status, path: `web/src/content/collections/${slug}.md` });
const check = checkChanges as (i: { files: { status: string; path: string }[]; existing: Topic[]; added: Topic[]; hubs: string[]; providers: string[] }) => { errors: string[]; added: string[] };

describe("collection gate", () => {
  it("accepts new agent topics that meet the rules", () => {
    expect(check({ ...base, files: [file("storm-cloud-photos")], added: [topic("storm-cloud-photos")] })).toEqual({ errors: [], added: ["storm-cloud-photos"] });
  });

  it("refuses other files, edits to existing topics and deletions", () => {
    const { errors } = check({
      ...base,
      files: [file("storm-cloud-photos"), file("existing-a", "M"), file("existing-b", "D"), { status: "A", path: "src/core/service.ts" }],
      added: [topic("storm-cloud-photos")],
    });
    expect(errors).toHaveLength(3);
  });

  it(`refuses more than ${MAX_NEW_TOPICS} topics per run`, () => {
    const slugs = Array.from({ length: MAX_NEW_TOPICS + 1 }, (_, i) => `topic-${i}`);
    expect(check({ ...base, files: slugs.map((s) => file(s)), added: slugs.map((s) => topic(s)) }).errors.join()).toMatch(/at most/);
  });

  it("refuses duplicates, human authorship and links to new pages", () => {
    const { errors } = check({
      ...base,
      files: [file("storm-cloud-photos"), file("storm-cloud-photos-2")],
      added: [topic("storm-cloud-photos", { addedBy: "human" }), topic("storm-cloud-photos-2", { search: { q: "Storm  Cloud  Photos", categories: ["nature.sky"], styles: ["photo"], free: true }, related: ["existing-a", "storm-cloud-photos"] })],
    });
    expect(errors).toEqual(
      expect.arrayContaining([
        'storm-cloud-photos: addedBy must be "agent"',
        'storm-cloud-photos-2: related "storm-cloud-photos" must be an existing collection',
        'storm-cloud-photos-2: same search as "storm-cloud-photos"',
      ]),
    );
  });

  it("applies the editorial rules", () => {
    const { errors } = check({ ...base, files: [file("thin")], added: [{ ...topic("thin"), body: "Too short." }] });
    expect(errors.join()).toMatch(/body: 2 words/);
  });

  it("only accepts the server's categories, styles, orientations and resolutions", () => {
    const { errors } = check({
      ...base,
      files: [file("bad-vocab")],
      added: [topic("bad-vocab", { search: { q: "bad vocab", categories: ["nature.ocean", "textures"], styles: ["painting", "vlog"], orientations: ["diagonal"], minResolution: 900, forms: ["loop"] } })],
    });
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^bad-vocab: search\.categories: a list of categories/),
        expect.stringMatching(/^bad-vocab: search\.styles: a list of photo, illustration/),
        expect.stringMatching(/^bad-vocab: search\.orientations: a list of landscape, portrait, square/),
        "bad-vocab: search.minResolution: one of 720, 1080, 1440, 2160",
        "bad-vocab: search: unknown field(s) forms",
      ]),
    );
    expect(check({ ...base, files: [file("vertical-sky")], added: [topic("vertical-sky", { search: { q: "sky", categories: ["nature.sky"], orientations: ["portrait"], minResolution: 1080, commercial: true } })] }).errors).toEqual([]);
  });

  it("withdraws topics whose search finds too little", () => {
    const images = (n: number, sources: number) => Array.from({ length: n }, (_, i) => ({ provider: `p${i % sources}` }));
    const snaps: Record<string, unknown> = { good: { images: images(20, 3) }, few: { images: images(5, 2) }, one: { images: images(30, 1) } };
    const r = checkSnapshots(["good", "few", "one", "missing"], (s: string) => snaps[s]);
    expect(r.kept).toEqual(["good"]);
    expect(r.dropped).toEqual([
      { slug: "few", reason: "5 images (minimum 12)" },
      { slug: "one", reason: "1 source (minimum 2)" },
      { slug: "missing", reason: "no snapshot" },
    ]);
  });
});

describe("collection ideas", () => {
  it("keeps only plain topic-like queries", () => {
    expect(sanitizeQuery("  Crashing   Waves ")).toBe("crashing waves");
    expect(sanitizeQuery("1950's new-york")).toBe("1950's new-york");
    for (const bad of ["a", "john@example.com", "https://x.io/a", "www example com", "12345", "one two three four five six seven", "<script>"]) expect(sanitizeQuery(bad), bad).toBeUndefined();
  });

  it("matches queries to collections without the filler words", () => {
    expect(coreTerms("Free Waterfall Stock Photos")).toBe("waterfall");
    expect(coreTerms("hi res city skyline pictures")).toBe("city skyline");
    expect(coreTerms("water colour flowers clip art")).toBe("clipart flower watercolor");
    expect(coreTerms("royalty-free icons for commercial use")).toBe("icon");
    const topics = [{ q: "waterfall", aliases: ["cascade photos"] }];
    expect(isCovered("free waterfall images", topics)).toBe(true);
    expect(isCovered("cascade", topics)).toBe(true);
    expect(isCovered("free stock photos", topics)).toBe(true); // only filler: the hubs answer it
    expect(isCovered("northern lights", topics)).toBe(false);
  });

  it("ranks frequent, uncovered queries and drops rare ones", () => {
    const rows = [
      { query: "northern lights", count: 9 },
      { query: "Northern Lights ", count: 2 },
      { query: "waterfall photos", count: 50 },
      { query: "rare thing", count: 2 },
      { query: "me@mail.com", count: 40 },
    ];
    const ideas = ideasFrom(rows, [{ query: "northern lights", count: 4 }], [{ q: "waterfall" }], 3);
    expect(ideas).toEqual([{ query: "northern lights", searches: 11, zeroResults: 4 }]);
  });
});
