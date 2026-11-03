/**
 * Markdown twins of the collection, hub and source pages (/collections/<slug>.md,
 * /collections.md, /sources/<id>.md), for agents and LLM crawlers. Same facts as
 * the HTML, plus the image ids an agent can pass to GET /v1/images/{id}.
 */
import { COLLECTIONS_PATH, apiHref, collectionPath, countLabel, hubPath, latest, providerName, searchHref, sourcePath, sourceSearchHref, type Collection, type Hub, type SnapshotImage, type SourcePage } from "./collections";
import { categoryName, fmt } from "./catalog";
import { SITE } from "./site";
import { VERDICT_LABELS, categoryLabel, orientationLabel, sizeText, styleLabel, type Verdict } from "./vocab";

/** "Paintings, Painting, 3000 × 2400, vertical, 1887" */
export function imageFacts(a: SnapshotImage): string {
  return [
    categoryLabel(a.category),
    ...(a.styles ?? []).map(styleLabel),
    a.vector ? "vector (SVG)" : sizeText(a.width, a.height),
    a.orientation && a.orientation !== "landscape" ? orientationLabel(a.orientation).toLowerCase() : "",
    a.transparent ? "transparent" : "",
    a.year ? String(a.year) : "",
  ]
    .filter(Boolean)
    .join(", ");
}

const abs = (path: string) => `${SITE.url}${path}`;
const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
const day = (d?: Date) => d?.toISOString().slice(0, 10);
/** Root-relative Markdown links become absolute so the file works wherever it is read. */
const absolutize = (md: string) => md.replace(/\]\(\//g, `](${SITE.url}/`);
const footer = (path: string) => `\n---\nSource: ${abs(path)}\n`;

export function collectionMarkdown(c: Collection, related: Collection[]): string {
  const d = c.topic.data;
  const rows = c.images.map((a) => {
    const facts = imageFacts(a);
    const verdict = a.license ? `${VERDICT_LABELS[a.license.verdict as Verdict] ?? a.license.verdict}${a.license.editorial ? " (editorial)" : ""}` : "check the source";
    return `| [${cell(a.title)}](${a.url}) | \`${a.id}\` | ${cell(facts)} | ${providerName(a.provider)} | ${a.license?.name ?? "see source"} | ${verdict} | ${a.downloadable ? "yes" : "no"} |`;
  });
  return [
    `# ${d.title}`,
    "",
    `> ${d.description}`,
    "",
    c.images.length
      ? `${countLabel(c.images)} from ${c.sources.length} sources (${c.sources.map((s) => `${s.name} ${s.count}`).join(", ")})${c.updatedAt ? `, updated ${day(c.updatedAt)}` : ""}. Picked from a live search and refreshed daily.`
      : "This collection is being refreshed: run the search below for live results.",
    "",
    `- Same search in the browser: ${abs(searchHref(d.search))}`,
    `- Same search over the API: \`curl "${apiHref(d.search)}"\``,
    "- Details, files and the credit line: `GET " + SITE.url + "/v1/images/{id}` with an id from the table below.",
    "- Licence verdicts: \"Commercial use OK\" (with or without credit) is cleared for commercial videos; anything else must be checked or is non-commercial. \"(editorial)\" means people, insignia or brands appear without releases: not for ads. See " + abs("/docs/licences.md"),
    "- Video is never re-hosted: posters, previews and downloads come straight from the source sites.",
    "",
    absolutize(c.topic.body?.trim() ?? ""),
    "",
    ...(rows.length
      ? ["## Images", "", "| ImageAsset | id | What | Source | Licence | Commercial use | Direct download |", "| --- | --- | --- | --- | --- | --- | --- |", ...rows, ""]
      : []),
    "## Questions",
    "",
    ...d.faq.flatMap((f) => [`**${f.q}**`, "", f.a, ""]),
    "## Related collections",
    "",
    ...related.map((r) => `- [${r.topic.data.title}](${abs(r.path)}.md): ${r.topic.data.description}`),
    footer(c.path),
  ].join("\n");
}

export function hubMarkdown(hub: Hub, cs: Collection[], hubs: Hub[], guides: { title: string; path: string; description: string }[] = []): string {
  const updated = latest(cs);
  return [
    `# ${hub.title}`,
    "",
    `> ${hub.description}`,
    "",
    hub.intro,
    "",
    ...(updated ? [`Updated ${day(updated)}.`, ""] : []),
    "## Collections",
    "",
    ...(cs.length ? cs.map((c) => `- [${c.topic.data.title}](${abs(c.path)}.md): ${countLabel(c.images)} from ${c.sources.length} sources. ${c.topic.data.description}`) : ["No collections yet."]),
    "",
    ...(hub.sections ?? []).flatMap((sec) => [`## ${sec.heading}`, "", sec.body, ""]),
    ...(hub.faq?.length ? ["## Questions", "", ...hub.faq.flatMap((f) => [`**${f.q}**`, "", f.a, ""])] : []),
    ...(guides.length ? ["## Guides", "", ...guides.map((g) => `- [${g.title}](${abs(g.path)}.md): ${g.description}`), ""] : []),
    "## Other kinds",
    "",
    ...hubs.filter((h) => h.id !== hub.id).map((h) => `- [${h.title}](${abs(hubPath(h))}.md)`),
    footer(hubPath(hub)),
  ].join("\n");
}

export function indexMarkdown(all: Collection[], hubs: Hub[]): string {
  const updated = latest(all);
  return [
    "# Free stock footage collections",
    "",
    `> Curated collections of free stock video (nature, cities, space, science, archive films, backgrounds and vertical images) from many video sites, with a licence verdict on every image, refreshed daily${updated ? ` (last change ${day(updated)})` : ""}. Each collection is a saved search; agents can run the same search with \`GET ${SITE.url}/v1/search\`.`,
    "",
    ...hubs.flatMap((hub) => {
      const cs = all.filter((c) => c.hub.id === hub.id);
      return cs.length ? [`## ${hub.title}`, "", `[All ${hub.name.toLowerCase()}](${abs(hubPath(hub))}.md)`, "", ...cs.map((c) => `- [${c.topic.data.title}](${abs(collectionPath(c.slug))}.md): ${c.topic.data.description}`), ""] : [];
    }),
    footer(COLLECTIONS_PATH),
  ].join("\n");
}

export function sourceMarkdown(s: SourcePage): string {
  const p = s.provider;
  const t = s.census;
  const facts = [
    `- Website: ${p.homepage}`,
    `- Best for: ${p.description}`,
    `- Categories: ${p.categories.map(categoryLabel).join(", ") || "various"}`,
    `- Pricing: ${p.pricing}`,
    `- Licence: ${p.license ?? "set per image"}${p.licenseVerdict ? ` (${VERDICT_LABELS[p.licenseVerdict as Verdict] ?? p.licenseVerdict})` : ""}`,
    `- How it is searched: ${p.access === "link" ? "deep link only (results open the same search on the site)" : p.access}`,
    `- Direct download through Image Asset Server: ${p.supportsDownload ? "yes" : "no (results link to the image page)"}`,
    ...(p.access !== "link" ? [`- Restrict a search to it: \`${SITE.url}/v1/search?q=...&providers=${p.id}\``] : []),
    ...(t
      ? [
          `- Video listings counted ${t.countedAt.slice(0, 10)}: ${fmt(t.total, t.atLeast)}${t.free !== undefined ? `, ${fmt(t.free)} free` : ""}`,
          ...(Object.keys(t.byCategory).length
            ? [`- By category: ${Object.entries(t.byCategory).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${categoryName(k)} ${fmt(n)}`).join(", ")}`]
            : []),
        ]
      : []),
  ];
  const n = s.notes;
  return [
    `# ${p.name}`,
    "",
    `> ${p.name} as searched by Image Asset Server: ${p.description}`,
    "",
    ...facts,
    "",
    ...(n
      ? [
          "## What it is",
          "",
          n.about,
          "",
          "## Best for",
          "",
          n.bestFor,
          "",
          "## Licence",
          "",
          n.licence,
          "",
          "## How Image Asset Server searches it",
          "",
          n.searching,
          "",
          "## Example searches",
          "",
          ...n.examples.map((e) => `- [${e.label}](${abs(sourceSearchHref(p.id, e))})`),
          "",
          ...(n.guides?.length ? ["Guides: " + n.guides.map((g) => abs(`/guides/${g}.md`)).join(", "), ""] : []),
        ]
      : []),
    ...(s.collections.length
      ? ["## In these collections", "", ...s.collections.map(({ collection: c, count }) => `- [${c.topic.data.title}](${abs(c.path)}.md): ${count} of ${c.images.length}`), ""]
      : []),
    ...(s.images.length ? ["## Examples", "", ...s.images.map((a) => `- [${a.title}](${a.url}) (\`${a.id}\`, ${a.license?.name ?? "licence on the source page"})`), ""] : []),
    `All sources: ${SITE.url}/docs/sources.md`,
    footer(sourcePath(p.id)),
  ].join("\n");
}
