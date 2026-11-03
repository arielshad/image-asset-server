---
layout: ../../layouts/DocsLayout.astro
title: Quick start
crumb: Docs
description: Get started with Image Asset Server in two minutes. Search free images in the browser, connect Claude Code or Cursor over MCP, or call the REST API.
---

# Image Asset Server quick start

**Image Asset Server** searches many free image sites at once and tells you, for every image, whether you can use it commercially. NASA, The Metropolitan Museum of Art, the Art Institute of Chicago, the Cleveland Museum of Art, the Library of Congress, Wikimedia Commons, Iconify and Openverse are searched directly; Unsplash, Pexels, Pixabay, Flickr, the Smithsonian, Europeana and the paid libraries (Shutterstock, Adobe Stock, Getty Images…) get a deep link with the same search. Results cover photos, public-domain art, maps and posters, illustrations, SVG vectors and icons, with pixel size, orientation and transparency where known, a thumbnail, a display-size preview and a licence verdict.

The public server at **https://image.shep.bot** is a free, non-commercial service and needs no account or API key.

## Pick how you want to use it

| You want to… | Use | Start here |
| --- | --- | --- |
| Browse and download images yourself | The web search | [/search](/search) |
| Pick every image a page, deck or post needs in one go | The image set builder | [/build](/build) |
| Let Claude Code, Cursor, Copilot or another agent find images | The MCP server at `https://image.shep.bot/mcp` | [Coding agents & MCP](/docs/mcp) |
| Call it from a script, a static-site build or a backend | The REST API | [REST API guide](/docs/api) |
| Search and download from a terminal | The CLI (`npx image-asset-server`) | [CLI](/docs/cli) |
| Explore every endpoint and try requests | The interactive reference | [API reference](/docs/api/reference) |

## Connect your agent (30 seconds)

For **Claude Code**, run this once:

```bash
claude mcp add --transport http images https://image.shep.bot/mcp
```

Then ask for what you need:

```text
Find a wide photo of a misty forest for our landing page hero that I can use
commercially, plus three SVG icons for upload, share and settings.
Tell me their licences and the credit lines I need.
```

Cursor, VS Code, Windsurf, Codex CLI, Gemini CLI and the Claude apps take the same URL. See [Coding agents & MCP](/docs/mcp) for each one.

## Or call the API

```bash
# Landscape mountain photos, at least 1080 px on the short side, cleared for commercial use
curl "https://image.shep.bot/v1/search?q=mountain+lake&orientation=landscape&min_resolution=1080&commercial=true&limit=5"

# Details, every file size, the credit line and a display URL for one result
curl "https://image.shep.bot/v1/images/nasa%3APIA03606"

# Download a 1920 px copy (a redirect to the file on NASA's servers)
curl -L -o crab-nebula.jpg "https://image.shep.bot/v1/images/nasa%3APIA03606/download?width=1920"
```

## What a search returns

Every search returns three things:

- **`results`**: images merged from all sources and ranked by how well they match. Each has an `id` like `met:436524`, a `category` (`nature.ocean`, `art.painting`, `archive.map`, `icons`…), `styles` (`photo`, `painting`, `vector`, `icon`, `transparent`…), `orientation`, `width`, `height`, `vector`, `transparent` and `year` when known, a `thumbnailUrl` and a `previewUrl` that load in a browser straight from the source, a `license` with a `verdict` and an `editorial` flag, an `attribution` line when credit is required, and `downloadable`.
- **`filters`**: what the server understood. Words like "4k", "high resolution", "vertical", "png", "svg" or "transparent" in the query become filters.
- **`providers`**: one status line per source (`ok`, `error`, `timeout`, `skipped` or `link`). Sites that can't be searched automatically come back as `link` with a `searchUrl` that runs the same search on their site.

A slow or broken source never fails the search.

## No image passes through the server

Image Asset Server never proxies or re-hosts images. It searches the sources, reads their metadata, decides a licence verdict and writes credit files. Every pixel comes straight from the source's servers:

- **Thumbnails and previews** in the search grid load from the source (`images-assets.nasa.gov`, `images.metmuseum.org`, `www.artic.edu/iiif`, `upload.wikimedia.org`, `api.iconify.design`…).
- **The detail view** shows the source's file (the `display` URL from `GET /v1/images/{id}`).
- **Downloads** (`/v1/images/{id}/download`) answer `302` with the file's URL on the source.
- **Image sets** (`POST /v1/sets`) return JSON, HTML and a download script whose file URLs point at the sources.

So the server stays small and cheap, the sources see real visitors, and nothing is redistributed.

## Licences, in one line each

- **Commercial use OK** (`yes`): use it, no credit needed.
- **Commercial use OK with credit** (`yes-with-credit`): use it and credit the source with the `attribution` line.
- **Restricted**, **Needs a paid licence or releases**, **Unclear** (`restricted`, `clearance-required`, `check-terms`): read the terms first.
- **Non-commercial only** (`no`): study and personal projects, not ads or client work.
- **Editorial** (`license.editorial: true`): people, insignia or brands without releases. Articles and education yes, advertising no.

`commercial=true` keeps only the first two verdicts. The full explanation is in [Image licences explained](/docs/licences).

## For AI agents reading this

Machine-readable entry points:

- [/AGENTS.md](/AGENTS.md): how to use this service as an agent, including the licence rules
- [/llms.txt](/llms.txt) and [/llms-full.txt](/llms-full.txt): site index and full docs as plain text
- [/openapi.json](/openapi.json): OpenAPI 3.1 description of the REST API
