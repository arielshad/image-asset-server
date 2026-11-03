# Image Asset Server

**Free image search for the whole open web.** image-asset-server searches NASA, the Met, the Art
Institute of Chicago, the Cleveland Museum of Art, the Library of Congress, Wikimedia Commons,
Iconify and Openverse at once (no API keys) and links you to 25 more image sites: photos, museum
art, illustrations, maps, posters, SVG vectors and icons. Every image tells you whether you can use
it commercially. Look at images in the browser, download the size you need, or let your AI assistant
pick the images for a page, deck or post.

> *"Find a landscape hero image of a city at dusk, a portrait of a baker and three icons: rocket,
> shield, chart."*
>
> Your assistant calls `build_image_set`, gets one image per slot with alternatives and their
> licences, and writes `images.json`, `credits.html` (`<figure>` snippets with credit captions), a
> `download.sh` and the credits into your project.

- **One query, many sources.** Results are merged, de-duplicated (a museum's own record beats a
  Commons or Openverse copy of it) and ranked, with a status line for every site.
- **Image-aware search.** "4k vertical mountain lake" becomes size and orientation filters; "rocket
  icon svg" asks for vectors; "coffee cup transparent png" asks for cut-outs. Every result has a
  category (`nature.ocean`, `art.painting`, `archive.map`, `icons`…), a kind (photo, painting,
  drawing, illustration, vector, icon), its pixel size, and whether it is transparent.
- **Licence first.** Every result carries a **verdict for commercial use**: `yes`,
  `yes-with-credit`, `restricted`, `check-terms` or `no`, an **editorial** flag (NASA insignia,
  recognisable people), and a ready-to-paste credit line. Downloads come with `ATTRIBUTION.md` and
  `credits.json`.
- **No image passes through the server.** Thumbnails and previews load in your browser straight from
  the source, and downloads are redirects to the source file. The server only searches, describes
  and plans.
- **Honest about what's blocked.** Sites that need an API key or forbid automated access come back as
  links to their own search, so you still know where else to look.

Live at **<https://image.shep.bot>** (free, non-commercial). Sister sites:
[3d.shep.bot](https://3d.shep.bot) (3D models, HDRIs, textures), [sound.shep.bot](https://sound.shep.bot)
(samples and music) and [video.shep.bot](https://video.shep.bot) (stock footage). Planning notes:
[docs/PLAN.md](docs/PLAN.md).

---

## Contents

- [Sources](#sources)
- [Licence verdicts](#licence-verdicts)
- [Quick start](#quick-start)
- [MCP: use it from an AI assistant](#mcp-use-it-from-an-ai-assistant)
- [HTTP API](#http-api)
- [CLI](#cli)
- [Downloads and image sets](#downloads-and-image-sets)
- [Configuration](#configuration)
- [Deploying](#deploying)
- [Project layout](#project-layout)
- [Development](#development)
- [Etiquette](#etiquette)

---

## Sources

**Searched (8), no API keys needed**

| Source | Best for | Downloads | Licence |
|---|---|---|---|
| [NASA Image and Video Library](https://images.nasa.gov) | Planets, galaxies, Earth from orbit, launches, astronauts (about 170k photos) | originals plus 640–1920 px copies | NASA media guidelines: free with credit, **editorial**; third-party credits (ESA, STScI…) are `check-terms` |
| [The Metropolitan Museum of Art](https://www.metmuseum.org/art/collection) | 370k+ public-domain artworks across 5,000 years: paintings, prints, photographs, arms and armour | the full scan | Open Access, CC0 |
| [Art Institute of Chicago](https://www.artic.edu/collection) | About 59k public-domain works: Impressionists, prints, photographs | IIIF, up to the full scan | CC0 |
| [Cleveland Museum of Art](https://www.clevelandart.org/art/collection/search) | About 42k CC0 works with print-size JPEGs and master TIFFs | web, print and TIFF | CC0 |
| [Library of Congress](https://www.loc.gov/photos/) | About 1.1M historic photos, prints, posters and maps | JPEG and TIFF masters | per item: "no known restrictions" is `yes`, anything else `check-terms` |
| [Wikimedia Commons](https://commons.wikimedia.org) | Over 100M photos, drawings, maps, diagrams and SVGs | resized copies up to 3840 px and the original | per file: CC0 / PD / CC BY / CC BY-SA |
| [Iconify](https://icon-sets.iconify.design) | About 470k open-source SVG icons in 276 sets (Material, Tabler, Lucide…) | SVG | per icon set: MIT, Apache 2.0, OFL, CC BY… |
| [Openverse](https://openverse.org) | About 900M CC and public-domain images (Flickr, iNaturalist, museums), listed after the originals | the source file | per image; Flickr licences are uploader-asserted, so `check-terms` |

**Linked (25, deep link to the site's own search):** Unsplash, Pexels, Pixabay, Flickr, Rawpixel,
StockSnap, Burst, Vecteezy, Freepik, Smithsonian Open Access, Europeana, Rijksmuseum, National
Gallery of Art, NYPL Digital Collections, Internet Archive, Openclipart, SVG Repo, Flaticon, The Noun
Project, unDraw, Shutterstock, Adobe Stock, Getty Images, iStock, Alamy. They need an API key we
don't have yet (Unsplash, Pexels, Pixabay, Smithsonian, Europeana), have no search API, or their terms
forbid automated access.

`GET /v1/providers` (or `list_sources` over MCP) lists every source with its access method and
licence. [integrations/registry.json](integrations/registry.json) records every site that was
considered, including the rejected ones and why.

## Licence verdicts

| Verdict | Means | Examples |
|---|---|---|
| `yes` | Usable commercially, no conditions | CC0, public domain, museum open access, OFL icon sets |
| `yes-with-credit` | Usable if you credit the author or keep the notice | CC BY, NASA media, MIT and Apache icon sets |
| `restricted` | Conditions that usually rule out normal use | CC BY-SA (adaptations must be CC BY-SA too), GPL icon sets |
| `check-terms` | Unknown or unverified | no licence stated, uploader-asserted (Flickr), third-party pictures on NASA, LoC items not evaluated |
| `no` | Non-commercial only, or no changes allowed | CC BY-NC, CC BY-ND (no cropping or editing), personal use only |

**Editorial** is a separate flag: the image is fine for articles, documentaries and teaching, but
using it in an ad may imply endorsement (NASA insignia, recognisable people, brands). Credits files
list editorial images in their own section.

Verdicts are a summary, not legal advice. AI agents search commercial-safe images by default.

## Quick start

Needs Node.js 22 or newer.

```bash
git clone https://github.com/arielshad/image-asset-server.git
cd image-asset-server
npm install && npm --prefix web install
npm run build

npm start                                   # web UI + HTTP API + MCP on http://localhost:8787
node dist/cli.js mcp                        # MCP over stdio
node dist/cli.js search "van gogh sunflowers" --commercial
```

With Docker:

```bash
docker run -p 8787:8787 ghcr.io/arielshad/image-asset-server
```

## MCP: use it from an AI assistant

```bash
# Hosted
claude mcp add --transport http images https://image.shep.bot/mcp

# Local (can write files into your project)
claude mcp add images -e IMAGE_DOWNLOAD_DIR="$PWD/images" -- node /path/to/image-asset-server/dist/cli.js mcp
```

| Tool | What it does |
|---|---|
| `search_images` | Search every source; size, orientation, format and transparency words become filters; commercial-safe by default |
| `get_image` | Licence, editorial flag, credit line, every file with its size, and a display URL that shows in a browser |
| `build_image_set` | A list of slots in, one image per slot with alternatives out, plus `images.json`, `credits.html`, `download.sh` and credits |
| `download_image` | Local only: files the image by category at the width you ask for and updates ATTRIBUTION.md / credits.json |
| `list_sources` | Every source and what it is good for |

## HTTP API

```bash
curl "https://image.shep.bot/v1/search?q=mountain+lake&orientation=portrait&min_resolution=2160&commercial=true"
curl "https://image.shep.bot/v1/search?q=rocket&style=icon&format=svg"
curl "https://image.shep.bot/v1/images/met:436524"                                   # details + `display` file
curl -L -o hero.jpg "https://image.shep.bot/v1/images/<id>/download?width=1920"     # 302 to the source
curl -o credits.zip "https://image.shep.bot/v1/images/<id>/credits?format=zip"       # ATTRIBUTION.md + credits.json
curl -X POST https://image.shep.bot/v1/sets -H 'content-type: application/json' \
  -d '{"slots":["hero: city skyline at dusk","portrait of a baker at work","3 icons: rocket, shield, chart"],"width":1600}'
```

Search parameters: `q`, `category` (comma list; a parent like `nature` matches its children),
`style` (`photo`, `illustration`, `painting`, `drawing`, `vector`, `icon`, `transparent`,
`black-white`), `orientation` (`landscape`, `portrait`, `square`), `min_resolution` (short side:
`720`, `1080`, `1440`, `2160`, `4k`), `transparent`, `format` (`jpg`, `png`, `svg`…), `commercial`,
`free`, `downloadable`, `strict`, `providers`, `limit`, `offset`.

Other routes: `/v1/images/:id/files` (`width`, `format`, `role`, `all`), `/v1/providers`,
`/v1/catalog`, `/v1/stats`, `/openapi.json`. Full reference:
[/docs/api/reference](https://image.shep.bot/docs/api/reference).

Downloads never stream through the server: `/download` answers with a 302 to the source file and
puts the licence and credit line in `x-license` and `x-attribution` headers. An image that can only
be fetched with a login or special headers answers 409 with its source page.

## CLI

```bash
image-asset-server search "4k vertical mountain lake"
image-asset-server search "saturn" --providers nasa --min-resolution 1080
image-asset-server search "rocket icon svg"
image-asset-server download met:436524 --width 2400 --dir ./images
image-asset-server set "hero: city skyline at dusk; baker at work; 3 icons: rocket, shield, chart" --width 1600 --download
image-asset-server serve
image-asset-server mcp
```

## Downloads and image sets

- The file picker takes the smallest file at least as wide as you ask for (a 1920 px copy rather
  than a 60 MB TIFF), prefers JPEG and PNG between files of the same size, always takes an SVG
  original for vectors, and never picks a file that needs a login. Without a width it takes the
  original.
- Local downloads go to `IMAGE_DOWNLOAD_DIR` (default `./images`), filed by category
  (`images/nature/ocean/…(1920w).jpg`). Every download merges its credits into `ATTRIBUTION.md` and
  `credits.json` in that folder.
- `build_image_set` searches once per slot, keeps each image to one slot, and falls back to other
  orientations or smaller files (with a note) when a slot finds nothing that fits. Slot lists
  understand labels (`hero:`), widths (`(2400px)`) and lists (`3 icons: rocket, shield, chart`). Its
  exports:
  - `images.json`: per slot the file URL, size, alt text, licence and credit;
  - `credits.html`: one `<figure>` per image with its credit in the caption;
  - `download.sh`: `curl` every pick into `./images`;
  - `ATTRIBUTION.md` and `credits.json`.
  With `--download` (CLI) or `download=true` (local MCP), the images are saved next to them and the
  exports point at the local files.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `PORT`, `HOST` | `8787`, `0.0.0.0` | HTTP listener |
| `IMAGE_SERVER_PUBLIC_URL` | request origin | Public base URL for links |
| `IMAGE_SERVER_USER_AGENT` | built in | User-Agent for source requests; include contact details (Wikimedia throttles anonymous clients) |
| `IMAGE_DOWNLOAD_DIR` | `./images` | Where local downloads go |
| `IMAGE_SERVER_API_KEY` | none | Require a key on `/v1` and `/mcp` (header only) |
| `IMAGE_SERVER_PROVIDERS` | all | Comma list to enable a subset |
| `IMAGE_SERVER_HTTP_MCP` | `true` | `false` turns off MCP at `/mcp` |
| `IMAGE_SERVER_HTTP_DOWNLOADS` | `false` | Expose `download_image` on the HTTP MCP endpoint (writes to the server's disk) |
| `IMAGE_SERVER_RATE_LIMIT`, `IMAGE_SERVER_RATE_LIMIT_WINDOW` | `120`, `60` | Requests per client per window (seconds) on `/v1` and `/mcp` |
| `IMAGE_SERVER_MAX_DOWNLOAD_BYTES` | 1 GiB | Cap per local download |
| `IMAGE_SERVER_CACHE_TTL_MS`, `IMAGE_SERVER_HTTP_TIMEOUT_MS`, `IMAGE_SERVER_PROVIDER_TIMEOUT_MS` | built in | Source cache and timeouts |
| `OPENVERSE_CLIENT_ID`, `OPENVERSE_CLIENT_SECRET` | none | A registered Openverse app: lifts the anonymous limit (20/min, 200/day) |
| `METRICS_PORT`, `PROMETHEUS_URL` | off | Prometheus metrics and `/stats` |
| `MAXMIND_ACCOUNT_ID`, `MAXMIND_LICENSE_KEY`, `IMAGE_SERVER_ASN_DB` | none | Label MCP callers by network in metrics |
| `IMAGE_SERVER_SESSION_SECRET` | random | Signs MCP session IDs |
| `UMAMI_WEBSITE_ID`, `UMAMI_HOST` | none | Web page views to your Umami |
| `IMAGE_SERVER_TELEMETRY` | off | Opt-in anonymous install telemetry (needs `IMAGE_SERVER_TELEMETRY_WEBSITE_ID`); `DO_NOT_TRACK=1` always wins |

`node dist/cli.js help` lists everything.

## Deploying

The production setup mirrors 3d-asset-server, sound-server and video-assets-server:

1. CI (`.github/workflows/ci.yml`) tests, builds `ghcr.io/arielshad/image-asset-server:{latest,sha-…}`
   on every push to `main`, and commits the new tag to `deploy/kustomization.yaml`.
2. ArgoCD syncs `deploy/` (kustomize) into the `image-asset-server` namespace. The app is registered
   in shep-ai/shep-infra (`bootstrap/apps/88-image-asset-server.yaml`).
3. `deploy/ingress.yaml` serves `image.shep.bot` behind the edge Caddy (on-demand TLS for
   `*.shep.bot`).
4. Prometheus scrapes the metrics port (`deploy/servicemonitor.yaml`); the Grafana dashboard
   "Image Asset Server" and the Umami website for image.shep.bot live in shep-infra. Logs reach Loki
   through the cluster's Alloy with no per-app setup.
5. No secrets are needed: every searched source is keyless. An optional `image-asset-server-env`
   Secret can add `IMAGE_SERVER_API_KEY`, `IMAGE_SERVER_SESSION_SECRET`, an Openverse app or the
   MaxMind keys (see the comment in `deploy/deployment.yaml`).

No PVC: the pod keeps only an in-memory cache, so rollouts are rolling updates.
Releases to npm (`npx image-asset-server`) run from version tags (`.github/workflows/release.yml`).

The daily source-discovery and weekly collection-drafting workflows need a `CLAUDE_CODE_OAUTH_TOKEN`
(or `ANTHROPIC_API_KEY`) repository secret; without it they fail and nothing else is affected.

## Project layout

```
src/core/       model (types, vocab), classify, query parsing, licences, search service,
                downloads, image sets, credits, census, collections, analytics
src/providers/  one file per source; link.ts / linked.ts for deep-link-only sites
src/api/        Hono app: REST API, MCP over HTTP, website serving, OpenAPI, share cards
src/mcp/        MCP tools
web/            Astro website (search, image set builder, docs, collections)
scripts/        daily census, collection snapshots, quality gates
prompts/        instructions for the scheduled source-discovery and collection agents
deploy/         Kubernetes manifests (kustomize)
test/           offline tests with fixtures; test/live/ runs against the real sites (LIVE=1)
```

## Development

```bash
npm test                 # offline tests
npm run typecheck        # server + website
LIVE=1 npm run test:live # hits the real sites
npm run dev              # watch mode
```

New source? Read [docs/PROVIDERS_GUIDE.md](docs/PROVIDERS_GUIDE.md).

## Etiquette

At most a few requests per search, a descriptive User-Agent, caches, robots.txt and terms respected
(a site that forbids automated access is link-only), a pause after a rate-limit answer, and no
mirroring or re-hosting of anyone's images. Report problems at
<https://github.com/arielshad/image-asset-server/issues>.

Code: Apache-2.0. Images belong to their authors and institutions under their own licences.
