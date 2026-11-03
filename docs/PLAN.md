# image-asset-server: plan to production

> **Status (2026-11-03):** v1 built and deployed the same way as the siblings. This file records what
> was decided and why, so the next sibling (or the next person) can follow it.

**Goal:** search many free image sites at once and download the image you pick: photos, museum art,
illustrations, maps, posters, SVG vectors and icons, with a licence verdict on each. Used by
designers, developers, writers, teachers, marketers and AI agents that build pages, decks and posts.
It works the way [3d-asset-server](https://github.com/arielshad/3d-asset-server) (3d.shep.bot),
sound-server (sound.shep.bot) and [video-assets-server](https://github.com/arielshad/video-assets-server)
(video.shep.bot) do: an HTTP API, an MCP server, a CLI and a web UI, with the same production setup.

## 1. How it was built (the recipe)

1. **Copy the newest sibling, don't start from scratch.** 3d → sound → video → image. video-assets-server
   was the newest and already keyless, secret-free and PVC-free, so it was copied (without `.git`, its
   plan, research, fixtures, collections and domain data), renamed (`video-assets-server` →
   `image-asset-server`, `VIDEO_SERVER_*` → `IMAGE_SERVER_*`, `video_server_*` metrics →
   `image_server_*`) and then adapted.
2. **New data model.** A clip became an `ImageAsset`: pixel size, orientation, `vector`,
   `transparent`, `year`, `thumbnailUrl` (grid) and `previewUrl` (detail view); files have roles
   `original | rendition | thumbnail`. Length, frame rate, audio and posters are gone.
3. **New vocabulary** (`src/core/vocab.ts`): image categories (nature, animals, city, architecture,
   people, food, objects, tech, transport, space, science, art.*, archive.*, background, icons) and
   kinds as styles (photo, illustration, painting, drawing, vector, icon, transparent, black-white).
   Queries parse size words ("4k", "high resolution"), orientation ("vertical", "16:9"), formats
   ("svg", "png") and transparency ("transparent", "no background"); "portrait" means people, not
   orientation.
4. **New agent feature:** `build_sequence` became `build_image_set`: slots in ("hero: city skyline",
   "3 icons: rocket, shield, chart"), one pick per slot with alternatives out, plus `images.json`,
   `credits.html`, `download.sh` and the credits.
5. **Sources checked live from a cloud IP** before writing each provider (see §2).
6. **Deploy:** this repo's `deploy/` (copied, renamed, new Umami id), then shep-infra:
   `bootstrap/apps/88-image-asset-server.yaml` (89–99 are taken), `projects/apps.yaml`, the Umami
   PostSync job **and its line in `websites-configmap.yaml` in the same PR** (without it the job never
   runs: that is how sound.shep.bot once got "Website not found"), the Grafana dashboard (a copy of
   the video one) and the README row.
7. **Order:** merge this repo first; CI builds the image and pins its tag in
   `deploy/kustomization.yaml`; then merge shep-infra; ArgoCD deploys within minutes. DNS (the
   `*.shep.bot` wildcard) and TLS (on demand) need no manual step.

## 2. Sources

Searched with no API key: NASA Image and Video Library, the Met (v1.1 search; v1 was retired on
2026-10-01), Art Institute of Chicago (needs an `AIC-User-Agent` header), Cleveland Museum of Art,
Library of Congress (`fa=access-restricted:false`), Wikimedia Commons, Iconify and Openverse
(anonymous: 20/min, 200/day; the provider pauses after a 429 until the quota resets).

Link-only (25): see `src/providers/linked.ts` for the reason per site. Unsplash, Pexels and Pixabay
need keys and forbid "competing services" in their API terms; Smithsonian, Europeana and Rijksmuseum
need keys; the rest have no API or forbid bots.

Rejected: Google Images, Pinterest, DeviantArt, Behance, Dribbble, Lorem Picsum, Wallhaven, Pikwizard
(`integrations/registry.json` has the reasons).

## 3. Decisions

- **No image bytes through the pod.** Thumbnails and previews load from the sources; `/download` is a
  302; the credits zip holds only `ATTRIBUTION.md` and `credits.json`. No PVC, rolling updates.
- **Commercial-safe by default for agents.** Museum open access is `yes`; NASA is `yes-with-credit` and
  editorial; Flickr licences (through Openverse) are uploader-asserted and capped at `check-terms`;
  icon sets map MIT/Apache to `yes-with-credit` (keep the notice), OFL/CC0 to `yes`, GPL to
  `restricted`.
- **De-duplication order:** originals before aggregators (NASA, museums, LoC, Commons, Iconify, then
  Openverse), so a Commons file found through Openverse keeps its Commons record.
- **Vectors pass any size filter**; `vector` and `icon` styles always filter, the other styles only rank
  unless `strict` is set (sources rarely state them).

## 4. Outside git (manual, once)

- **GitHub repo secret** `CLAUDE_CODE_OAUTH_TOKEN` (or `ANTHROPIC_API_KEY`) for the daily
  source-discovery and weekly collection-drafting workflows. Without it they fail; the site is not
  affected. (video-assets-server is missing it too.)
- **Optional:** an Openverse app (`OPENVERSE_CLIENT_ID` / `OPENVERSE_CLIENT_SECRET` in an
  `image-asset-server-env` Secret) for a higher rate limit; API keys for Unsplash, Pexels, Pixabay or
  Smithsonian would turn those link-only sources into searched ones.
- **npm:** the first `npx image-asset-server` release needs `NPM_TOKEN`; switch to trusted publishing
  after that.
