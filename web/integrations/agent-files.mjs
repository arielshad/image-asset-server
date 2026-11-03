// Emits the machine-readable side of the site after `astro build`:
//   /AGENTS.md              agent guide (also served for `/` when Accept: text/markdown)
//   /skill/SKILL.md         Claude Code skill
//   /docs.md, /docs/*.md    markdown twins of every docs page
//   /llms.txt               llmstxt.org index (docs, guides, glossary, collections)
//   /llms-full.txt          the agent guide, docs, guides, glossary, FAQ and
//                           collection pages (without image tables) in one file
//   /stats.md               the catalog census as Markdown
//   /scalar/standalone.js   self-hosted Scalar API reference bundle
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8");

/** A YAML scalar as written in frontmatter: "quoted" or plain. */
const unquote = (v) => (typeof v === "string" && /^".*"$/.test(v) ? JSON.parse(v) : v);

function stripFrontmatter(md) {
  const normalized = md.replace(/\r\n/g, "\n");
  const m = normalized.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return { meta: {}, body: normalized };
  const meta = Object.fromEntries(
    m[1].split("\n").map((l) => l.match(/^(\w+):\s*(.*)$/)).filter(Boolean).map((x) => [x[1], x[2]]),
  );
  return { meta, body: normalized.slice(m[0].length) };
}

function* mdPages(dir) {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, name.name);
    if (name.isDirectory()) yield* mdPages(full);
    else if (name.name.endsWith(".md")) yield full;
  }
}

const vocab = () => JSON.parse(read("src/data/vocab.json"));
const label = (id) => vocab().categories.find((c) => c.id === id)?.label ?? id;
const verdictLabel = (v) => vocab().verdictLabels[v] ?? v;
const readJson = (p) => (existsSync(join(root, p)) ? JSON.parse(read(p)) : undefined);

function sourcesMarkdown(providers) {
  const access = { api: "API", static: "catalogue", scrape: "site search", link: "deep link" };
  const rows = providers.map(
    (p) =>
      `| [${p.name}](${p.homepage}) | \`${p.id}\` | ${p.description} | ${(p.categories ?? []).map(label).join(", ")} | ${access[p.access] ?? p.access} | ${p.pricing} | ${p.license ?? "per image"}${p.licenseVerdict ? ` (${verdictLabel(p.licenseVerdict)})` : ""} | ${p.supportsDownload ? "yes" : "no"} |`,
  );
  return [
    "# Sources & licences",
    "",
    `Image Asset Server searches or links ${providers.length} video sites. Use the \`id\` with \`providers=\` to restrict a search. "deep link" sources are not searched automatically (they need a key, sell their footage, or their terms forbid aggregation): the response carries a \`searchUrl\` that runs the same search on the site. No video passes through the server: posters, previews and downloads come from the sources.`,
    "",
    "| Source | id | Best for | Categories | Search | Pricing | Licence | Direct download |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
    "Sources marked \"per image\" set licences per item; check each result's `license.verdict`. Royalty-free licences allow use in your music but not redistribution of the images. Licences explained: /docs/licences.md",
    "",
  ].join("\n");
}

const num = (n, atLeast) => `${n.toLocaleString("en")}${atLeast ? "+" : ""}`;

/** One-line headline numbers from the catalog census (for llms.txt). */
function catalogLine(c) {
  const t = c.totals;
  const cats = Object.entries(c.byCategory ?? {}).sort((a, b) => b[1].count - a[1].count).map(([k, v]) => `${num(v.count, v.atLeast)} ${label(k).toLowerCase()}`);
  return `**Catalog (counted ${c.countedAt.slice(0, 10)}).** ${num(t.listings.count, t.listings.atLeast)} video listings from ${t.sourcesCounted} counted sources, ${num(t.free.count, t.free.atLeast)} free${t.cc0.count ? ` and ${num(t.cc0.count, t.cc0.atLeast)} CC0` : ""}${cats.length ? `; by category: ${cats.join(", ")}` : ""}.`;
}

function statsMarkdown(integrations, catalog, site) {
  const recent = integrations.slice(0, 6).map((i) => `- [${i.name}](${i.homepage}) (\`${i.id}\`), added ${i.addedAt}`);
  const head = [
    "# Stock video in numbers",
    "",
    catalog
      ? `Counted ${catalog.countedAt.slice(0, 10)} (daily). Machine-readable: \`GET ${site}/v1/catalog\` (same as ${site}/catalog.json; daily history at ${site}/catalog-history.json). "+" marks lower bounds.`
      : `The daily catalog count has not run yet; it will appear here and at \`GET ${site}/v1/catalog\`.`,
    "",
  ];
  const census = [];
  if (catalog) {
    const t = catalog.totals;
    const rows = catalog.sources.map(
      (s) =>
        `| [${s.name}](${s.homepage}) | ${num(s.total, s.atLeast)} | ${s.free !== undefined ? num(s.free) : s.pricing === "free" ? num(s.total) : "–"} | ${Object.entries(s.byCategory ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${label(k)} ${num(n)}`).join(", ") || "–"} | ${s.addedLast30Days ?? "–"} |`,
    );
    const highlights = catalog.sources.flatMap((s) => (s.highlights ?? []).map((h) => `- ${h.label} on ${s.name}: [${h.title}](${h.url})${h.value !== undefined ? ` (${num(h.value)})` : ""}`));
    census.push(
      "## Totals",
      "",
      `- Video listings: ${num(t.listings.count, t.listings.atLeast)} from ${t.sourcesCounted} counted sources (a listing is one video item on its source)`,
      `- Free: ${num(t.free.count, t.free.atLeast)}`,
      ...(t.cc0.count ? [`- CC0 / public domain: ${num(t.cc0.count, t.cc0.atLeast)}`] : []),
      `- Free with direct download links from the source: ${num(t.directDownload.count, t.directDownload.atLeast)}`,
      `- Released in the last 30 days (sources that date their listings): ${num(t.addedLast30Days)}`,
      "",
      "## By category",
      "",
      ...Object.entries(catalog.byCategory ?? {}).sort((a, b) => b[1].count - a[1].count).map(([k, v]) => `- ${label(k)}: ${num(v.count, v.atLeast)}`),
      "",
      "## By source",
      "",
      "| Source | Listings | Free | Mostly | New (30 days) |",
      "| --- | --- | --- | --- | --- |",
      ...rows,
      "",
      ...(highlights.length ? ["## Notable", "", ...highlights, ""] : []),
    );
  }
  return [
    ...head,
    ...census,
    "## Live usage",
    "",
    `Searches, image views, downloads, MCP tool calls and per-source health change every minute: read them from \`GET ${site}/v1/stats\` (schema \`Stats\` in ${site}/openapi.json). Counts are anonymous totals: no search terms, IP addresses or user agents.`,
    "",
    ...(recent.length ? ["## Recently added sources", "", ...recent, ""] : []),
    `All sources: ${site}/docs/sources.md`,
    "",
  ].join("\n");
}

export default function agentFiles() {
  let site = "https://image.shep.bot";
  return {
    name: "agent-files",
    hooks: {
      "astro:config:done": ({ config }) => {
        if (config.site) site = config.site.replace(/\/$/, "");
      },
      "astro:build:done": ({ dir, logger }) => {
        const out = fileURLToPath(dir);
        const write = (rel, text) => {
          const file = join(out, rel);
          mkdirSync(dirname(file), { recursive: true });
          writeFileSync(file, text);
        };
        // Root-relative links become absolute so the files work wherever they are read.
        const absolutize = (md) => md.replace(/\]\(\//g, `](${site}/`);

        const agents = read("src/content/AGENTS.md");
        write("AGENTS.md", agents);
        write("skill/SKILL.md", read("src/content/SKILL.md"));

        const pagesDir = join(root, "src/pages");
        const docs = [];
        for (const file of mdPages(pagesDir)) {
          const route = "/" + relative(pagesDir, file).replace(/\\/g, "/").replace(/(\/index)?\.md$/, "");
          const { meta, body } = stripFrontmatter(readFileSync(file, "utf8"));
          const md = `${absolutize(body.trim())}\n\n---\nSource: ${site}${route}\n`;
          write(`${route}.md`, md);
          docs.push({ route, title: meta.title ?? route, description: meta.description ?? "", md });
        }
        const providers = JSON.parse(read("src/data/providers.json"));
        const sources = sourcesMarkdown(providers);
        write("docs/sources.md", `${sources}\n---\nSource: ${site}/docs/sources\n`);
        docs.push({ route: "/docs/sources", title: "Sources & licences", description: `The ${providers.length} sites searched, with licences.`, md: sources });

        // Machine-readable catalog census (scripts/census.mjs), also served at /v1/catalog.
        const catalog = readJson("src/data/catalog.json");
        if (catalog) {
          write("catalog.json", read("src/data/catalog.json"));
          write("catalog-history.json", existsSync(join(root, "src/data/catalog-history.json")) ? read("src/data/catalog-history.json") : "[]\n");
        } else logger.warn("no src/data/catalog.json yet: /stats and llms.txt leave out the census");

        const integrations = readJson("src/data/integrations.json")?.integrations ?? [];
        const stats = statsMarkdown(integrations, catalog, site);
        write("stats.md", `${stats}\n---\nSource: ${site}/stats\n`);
        docs.push({ route: "/stats", title: "Stock video in numbers", description: "How many videos every source holds (counted daily, by category), plus live usage.", md: stats });

        // Twins generated by endpoints (src/pages/**/*.md.ts) are already in the output.
        const readOut = (rel) => (existsSync(join(out, rel)) ? readFileSync(join(out, rel), "utf8") : undefined);
        const faq = readOut("docs/faq.md");
        if (faq) docs.push({ route: "/docs/faq", title: "Frequently asked questions", description: "Short answers about what Image Asset Server searches, licence verdicts, credits, downloads, rate limits, AI agents and self-hosting.", md: faq });
        else logger.warn("no docs/faq.md twin in the build");

        // Guides (/guides/<slug>.md, built by src/pages/guides/[slug].md.ts).
        const guidesDir = join(root, "src/content/guides");
        const guides = (existsSync(guidesDir) ? readdirSync(guidesDir) : [])
          .filter((f) => f.endsWith(".md"))
          .map((f) => ({ slug: f.slice(0, -3), ...stripFrontmatter(readFileSync(join(guidesDir, f), "utf8")).meta }))
          .map((g) => ({ ...g, title: unquote(g.title ?? g.slug), description: unquote(g.description ?? ""), order: Number(g.order ?? 99), section: unquote(g.section ?? "") }))
          .sort((a, b) => a.order - b.order);
        const glossary = readOut("glossary.md");

        // Curated collections (/footage/<slug>.md, built by src/pages/footage/[slug].md.ts).
        const hubs = JSON.parse(read("src/data/collection-hubs.json"));
        const collectionsDir = join(root, "src/content/collections");
        const collections = (existsSync(collectionsDir) ? readdirSync(collectionsDir) : [])
          .filter((f) => f.endsWith(".md"))
          .map((f) => ({ slug: f.slice(0, -3), ...stripFrontmatter(readFileSync(join(collectionsDir, f), "utf8")).meta }))
          .map((c) => ({ ...c, title: unquote(c.title ?? c.slug), description: unquote(c.description ?? "") }))
          .sort((a, b) => hubs.findIndex((h) => h.id === a.hub) - hubs.findIndex((h) => h.id === b.hub) || a.title.localeCompare(b.title));

        const order = ["/docs", "/docs/mcp", "/docs/api", "/docs/licences", "/docs/faq", "/docs/api/versioning", "/docs/sources", "/docs/cli", "/docs/self-hosting", "/about", "/stats", "/contact", "/privacy"];
        const rank = (r) => (order.indexOf(r) === -1 ? order.length : order.indexOf(r));
        docs.sort((a, b) => rank(a.route) - rank(b.route));
        const docPages = docs.filter((d) => d.route.startsWith("/docs"));
        const sitePages = docs.filter((d) => !d.route.startsWith("/docs"));
        const listItem = (d) => `- [${d.title}](${site}${d.route}.md): ${d.description}`;

        // llmstxt.org format: H1, blockquote summary, free-form Markdown with no
        // headings (the when-to-use guidance), then H2 sections of link lists.
        write(
          "llms.txt",
          [
            "# Image Asset Server",
            "",
            `> Free search engine, REST API, CLI and MCP server for stock video. One query searches ${providers.length} video sites (NASA's Image and Video Library and Scientific Visualization Studio, Wikimedia Commons and the Internet Archive directly, plus deep links into Pexels, Pixabay, Coverr, Mixkit, Europeana, the Library of Congress and paid libraries such as Shutterstock, Adobe Stock and Getty Images) for b-roll, backgrounds, nature, cities, aerials, space, science, timelapses and archive films, with a poster, a playable preview, resolution, orientation, frame rate, length and a licence verdict on commercial use for every image. No account or API key needed; a free, non-commercial service that never streams or re-hosts video (posters, previews and downloads come straight from the sources).`,
            "",
            "**When to use Image Asset Server.** Use it when a user or task needs existing footage:",
            "",
            "- finding b-roll for a video (\"ocean waves at sunset\", \"drone city skyline night\", \"rocket launch slow motion\", \"1950s newsreel\");",
            "- matching a format: vertical 9:16 for Reels/TikTok/Shorts, 4K, a minimum length, 60 fps;",
            "- turning a shot list into a b-roll sequence with an OpenTimelineIO timeline, an ffmpeg script, a Remotion image list and the credits;",
            "- downloading the right rendition (MP4/WebM, 720p to 4K) with ATTRIBUTION.md into a project;",
            "- checking whether a image may be used in a commercial video, whether it is editorial-only, and which credit line it needs.",
            "",
            ...(catalog ? [catalogLine(catalog), ""] : []),
            "Do not use it to generate new video, to download films or TV shows, or to buy stock (paid results link to their store). Licence rules for agents: search commercial-safe by default, report every image's `license.verdict` and `license.editorial`, never present `no`, `check-terms` or editorial images as cleared for advertising, and pass on the `attribution` line when there is one.",
            "",
            `**How to call it.** MCP (preferred): add \`${site}/mcp\` (Streamable HTTP, no auth) under the name \`video\`, e.g. \`claude mcp add --transport http video ${site}/mcp\`, then call \`search_videos\` → \`get_video\` → download its \`selection.downloadUrl\`, or \`build_sequence\` for a whole edit (\`download_video\` on local installs: \`npx -y image-asset-server mcp\`). REST: \`GET ${site}/v1/search?q=...&orientation=portrait&min_resolution=1080&commercial=true\` → \`GET /v1/images/{id}\` → \`GET /v1/images/{id}/download?height=1080\` (302 to the source); \`POST /v1/sequences\`. Limits: 120 requests/minute per client (RateLimit headers, 429 + Retry-After). Full agent guide: ${site}/AGENTS.md`,
            "",
            "## Docs",
            "",
            `- [Agent guide](${site}/AGENTS.md): when to use the service, licence rules, and how an AI agent should search, choose and download footage`,
            ...docPages.map(listItem),
            "",
            "## Guides",
            "",
            `- [All guides](${site}/guides.md): answer-first guides on stock video licences, credits, NASA and archive footage, vertical video and b-roll sequences`,
            ...guides.map((g) => `- [${g.title}](${site}/guides/${g.slug}.md): ${g.description}`),
            `- [Glossary](${site}/glossary.md): B-roll, stock footage, 4K, frame rate, codec, container, rendition, LUT, CC0, CC BY, BY-SA, NC, ND, editorial use, model release, OTIO, ffmpeg, Remotion, MCP and more`,
            "",
            "## API",
            "",
            `- [OpenAPI 3.1](${site}/openapi.json): machine-readable REST API description (rate-limit headers, 429 responses, schemas)`,
            `- [API reference](${site}/docs/api/reference.md): every endpoint, parameter, response and schema`,
            `- [API playground](${site}/docs/api/playground): send live requests from the browser (interactive Scalar client)`,
            `- [MCP endpoint](${site}/mcp): Streamable HTTP; tools search_videos, get_video, build_sequence, list_sources (download_video on local installs)`,
            `- [Search endpoint](${site}/v1/search?q=ocean+waves&orientation=portrait&commercial=true): example search`,
            "",
            "## Collections",
            "",
            `- [All footage collections](${site}/footage.md): curated, daily-refreshed lists of free stock video by topic, with licence verdicts and image ids`,
            ...hubs.map((h) => `- [${h.title}](${site}/footage/${h.id}.md): ${h.description}`),
            ...collections.map((c) => `- [${c.title}](${site}/footage/${c.slug}.md): ${c.description}`),
            "",
            "## About",
            "",
            ...sitePages.map(listItem),
            "",
            "## Optional",
            "",
            `- [Claude Code skill](${site}/skill/SKILL.md): drop into ~/.claude/skills/video/SKILL.md`,
            `- [Everything in one file](${site}/llms-full.txt)`,
            `- [Web search](${site}/search.md): search parameters and categories as URLs`,
            `- [Sequence builder](${site}/sequence.md): a shot list to a b-roll edit with one API call`,
            `- [Sitemap](${site}/sitemap-index.xml)`,
            "",
          ].join("\n"),
        );
        // llms-full.txt: everything an agent might quote, in one file. Collection
        // twins lose their image tables (ids change daily; fetch the .md for them).
        const condensed = (md) => md.replace(/\n## Images\n[\s\S]*?(?=\n## )/, "\n");
        const collectionTwins = [readOut("footage.md"), ...hubs.map((h) => readOut(`footage/${h.id}.md`)), ...collections.map((c) => readOut(`footage/${c.slug}.md`))]
          .filter(Boolean)
          .map(condensed);
        const guideTwins = [readOut("guides.md"), ...guides.map((g) => readOut(`guides/${g.slug}.md`)), glossary].filter(Boolean);
        if (guideTwins.length < guides.length + 1) logger.warn("some guide twins are missing from the build");
        write(
          "llms-full.txt",
          [agents.trim(), ...docPages.map((d) => d.md.trim()), ...guideTwins.map((m) => m.trim()), ...collectionTwins.map((m) => m.trim()), ...sitePages.map((d) => d.md.trim())].join("\n\n---\n\n") + "\n",
        );

        // Scalar always declares fonts from fonts.scalar.com; drop them so the
        // page stays same-origin (it uses the site's Geist fonts instead).
        // ES-module build: a ~0.7 MB entry plus chunks fetched only when needed
        // (vs. 4.3 MB for the all-in-one bundle). Source maps are skipped.
        const scalarDir = join(root, "node_modules/@scalar/api-reference/dist/browser");
        const entry = readFileSync(join(scalarDir, "standalone.esm.js"), "utf8");
        const stripped = entry.replace(/@font-face \{(?:\\n|[^}])*?fonts\.scalar\.com[^}]*\}/g, "");
        if (stripped.includes("fonts.scalar.com")) logger.warn("scalar bundle still references fonts.scalar.com");
        write("scalar/standalone.esm.js", stripped);
        for (const chunk of readdirSync(join(scalarDir, "chunks")).filter((f) => f.endsWith(".js"))) {
          write(`scalar/chunks/${chunk}`, readFileSync(join(scalarDir, "chunks", chunk)));
        }
        logger.info(`wrote AGENTS.md, llms.txt, llms-full.txt (${guides.length} guides, ${collections.length} collections), skill and ${docs.length} markdown twins`);
      },
    },
  };
}
