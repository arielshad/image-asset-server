---
layout: ../../layouts/DocsLayout.astro
title: Image Asset Server CLI
crumb: CLI
description: Use the image-asset-server command line tool to search free image sites from a terminal, download the size you need, build image sets or run the MCP server.
---

# Image Asset Server CLI

The `image-asset-server` command searches every source from a terminal, downloads images with their credits, picks a whole set of images from a list of slots, runs the MCP server over stdio for desktop agents, and starts the HTTP server. It is the same code that runs https://image.shep.bot, and needs no API keys.

```bash
npx image-asset-server search "4k vertical mountain lake"
```

## Commands

```text
image-asset-server search <query> [--category art.painting] [--style photo] [--orientation portrait]
                     [--min-resolution 1080] [--transparent] [--format svg,png] [--commercial] [--free]
                     [--providers nasa,met,wikimediacommons] [--limit N]
image-asset-server download <id> [--width 1920] [--format jpg] [--dir ./images]
image-asset-server set <slots.txt | "slot 1; slot 2; ..."> [--width 1600] [--orientation landscape]
                     [--style photo] [--download] [--dir ./images/sets/<name>] [--name landing]
image-asset-server mcp     # MCP server over stdio, with download_image writing to ./images
image-asset-server serve   # HTTP API + website + MCP at /mcp on port 8787
```

## Search

Queries understand size, orientation, format and transparency, so `"4k vertical mountain lake"` filters like `--min-resolution 2160 --orientation portrait`, and `"rocket icon svg"` keeps only vector icons. `--commercial` keeps only images whose licence allows commercial use (verdict `yes` or `yes-with-credit`).

`search` prints the filters it read from your query, then ranked results (score, licence verdict and image id; then the title with its category, pixel size, orientation and year; then its page on the source), followed by one status line per source. A `*` after the verdict marks editorial images (people, insignia or brands without releases):

```text
$ npx image-asset-server search "crab nebula" --limit 2
0.92  yes-with-credit* nasa:PIA03606
      Crab Nebula Mosaic (space · 3864×3864 · 4K+ 2160+ · square · 2005)
      https://images.nasa.gov/details/PIA03606
…

  * editorial: people, insignia or brands without releases; not for ads.

Sources:
  nasa               ok       2
  met                ok       0
  unsplash           link     0  https://unsplash.com/s/photos/crab-nebula
```

## Download

```bash
npx image-asset-server download "nasa:PIA03606" --width 1920
```

Saves the smallest file at least `--width` pixels wide (a 1920 px copy rather than a huge original) into `./images/<category>/`, and adds the image to `ATTRIBUTION.md` and `credits.json` in that folder. It prints the licence and the credit line.

## Image set

```bash
cat > slots.txt <<'TXT'
Hero: misty forest at sunrise (1920px)
3 icons: upload, share, settings
Background: paper texture
Botanical illustration of a fern
TXT
npx image-asset-server set slots.txt --width 1600 --name landing --download
```

Picks one image per slot (commercial-safe unless you pass `--non-commercial`), prints the plan with a note for each slot that will be cropped, upscaled or is editorial, and writes `images.json`, `credits.html`, `download.sh`, `ATTRIBUTION.md` and `credits.json` into `./images/sets/<name>/`. With `--download` the picks are saved into its `images/` folder and the exports use those local files; without it they point at the sources (run `sh download.sh` later).

## Run it with Docker (no install)

```bash
docker run --rm ghcr.io/arielshad/image-asset-server node dist/cli.js search "van gogh" --commercial
```

As a local MCP server that writes downloads into your project:

```bash
docker run -i --rm --user "$(id -u):$(id -g)" -v "$PWD/images:/app/images" \
  ghcr.io/arielshad/image-asset-server node dist/cli.js mcp
```

## Run it from source

```bash
git clone https://github.com/arielshad/image-asset-server
cd image-asset-server && npm ci && npm run build:server
node dist/cli.js search "vintage map of paris" --commercial
```

## Environment

| Variable | Purpose |
| --- | --- |
| `IMAGE_SERVER_PROVIDERS` | Comma list to search only some sources (e.g. `nasa,met,artic`). |
| `IMAGE_DOWNLOAD_DIR` | Where `download`, `set` and `mcp` downloads go (default `./images`). |
| `IMAGE_SERVER_USER_AGENT` | User-Agent sent to sources. Wikimedia requires contact details in it. |
| `NODE_USE_ENV_PROXY` | Set to `1` so Node honours `HTTPS_PROXY`. |

See [Self-hosting](/docs/self-hosting) for every server setting.
