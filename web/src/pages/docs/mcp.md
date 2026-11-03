---
layout: ../../layouts/DocsLayout.astro
title: MCP server for AI agents
crumb: Coding agents & MCP
description: Connect Claude Code, Cursor, VS Code, Windsurf, Codex or Gemini CLI to the Image Asset Server MCP server so your agent finds, vets and fetches free images.
---

# Image Asset Server MCP server for AI agents

Image Asset Server is a [Model Context Protocol](https://modelcontextprotocol.io) server. Connect it once and your agent can search every image source, check licences, pick the right size and fill every image slot of a page while it works on your site, app, slides or document.

**MCP endpoint:** `https://image.shep.bot/mcp` (Streamable HTTP, no authentication). Register it under the name **`images`**.

## Claude Code

```bash
claude mcp add --transport http images https://image.shep.bot/mcp
```

Add `--scope user` to make it available in every project, or `--scope project` to share it with your team through `.mcp.json`. Check it with `claude mcp list`, or `/mcp` inside a session.

## Cursor

Add this to `.cursor/mcp.json` in your project, or to `~/.cursor/mcp.json` for every project (the [home page](/#agents) has a one-click "Add to Cursor" button):

```json
{
  "mcpServers": {
    "images": { "url": "https://image.shep.bot/mcp" }
  }
}
```

## VS Code (GitHub Copilot)

Add to `.vscode/mcp.json`, then use Copilot Chat in **Agent** mode:

```json
{
  "servers": {
    "images": { "type": "http", "url": "https://image.shep.bot/mcp" }
  }
}
```

Or from a terminal: `code --add-mcp '{"name":"images","type":"http","url":"https://image.shep.bot/mcp"}'`

## Claude desktop app and claude.ai

Open **Settings → Connectors → Add custom connector**, name it *Image Asset Server* and paste `https://image.shep.bot/mcp`.

## Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "images": { "serverUrl": "https://image.shep.bot/mcp" }
  }
}
```

## OpenAI Codex CLI

Add to `~/.codex/config.toml`:

```toml
[mcp_servers.images]
url = "https://image.shep.bot/mcp"
```

## Gemini CLI

```bash
gemini mcp add --transport http images https://image.shep.bot/mcp
```

## Any other client

Clients that only support stdio servers can bridge to the HTTP endpoint with [`mcp-remote`](https://www.npmjs.com/package/mcp-remote):

```json
{
  "mcpServers": {
    "images": { "command": "npx", "args": ["-y", "mcp-remote", "https://image.shep.bot/mcp"] }
  }
}
```

## Tools your agent gets

| Tool | What it does |
| --- | --- |
| `search_images` | Search every source. Arguments: `query` (designer words work: "mountain lake at sunrise", "van gogh sunflowers", "rocket icon svg", "coffee cup transparent png", "4k vertical forest"), `categories` (e.g. `nature.ocean`, `animals`, `art.painting`, `art.drawing`, `space.planets`, `archive.map`, `background`, `icons`), `styles` (`photo`, `illustration`, `painting`, `drawing`, `vector`, `icon`, `transparent`, `black-white`), `orientation`, `min_resolution` (720, 1080, 1440, 2160), `transparent`, `formats`, `commercial_only` (default **true**), `free_only`, `downloadable_only`, `strict`, `providers`, `limit`, `offset`. Also returns `also_search_on`: deep links into the image sites that can't be searched automatically. |
| `get_image` | Details for one `id`: licence, verdict, editorial flag and credit line, every file (size, format), a `display` URL that loads in a browser straight from the source, and `selection.downloadUrl` for the smallest file at least `width` pixels wide (and `format`). |
| `build_image_set` | Turns a list of slots (a list, or text with one slot per line; "(1200px)" sets a width; "3 icons: rocket, shield, chart" makes three slots) into one image per slot matching its orientation, kind and width, commercial-safe by default, with alternatives, plus `images.json`, `credits.html` (`<figure>` snippets with credit captions), `download.sh` and `ATTRIBUTION.md`. |
| `list_sources` | Every source with what it is best for, categories, pricing, licence and whether it is searched or linked. |
| `download_image` | **Local servers only**: writes the chosen file into `./images/<category>/` and keeps `ATTRIBUTION.md` and `credits.json` up to date. |

The hosted server never writes to its own disk, so agents with a shell download through the links it returns (the download URL redirects to the file on the source):

```bash
mkdir -p images
curl -L -o images/hero.jpg "https://image.shep.bot/v1/images/<id>/download?width=1920"
```

## Licence rules the agent follows

Image licences have traps, so the server tells every agent the same rules, and you can expect them to be followed:

- Searches are **commercial-safe by default** (`commercial_only=true`). The agent turns that off only when you say the project is personal, educational or non-commercial.
- It **reports the verdict** of every image it suggests, and never presents a `no` (non-commercial), `check-terms` (unclear) or **editorial** image as cleared for advertising.
- `license.editorial: true` means people, insignia or brands appear without releases: fine for articles, books and education, not for ads or anything that implies endorsement. All NASA images carry it.
- When an image needs credit (`yes-with-credit`), it gives you the exact `attribution` line; local downloads and image sets collect them in `ATTRIBUTION.md`.
- CC BY-SA images are `restricted` (an edited version must be share-alike), and CC BY-ND forbids cropping or editing.

Details: [Image licences explained](/docs/licences).

## Prompts that work well

```text
Find a wide, high-resolution photo of a misty forest for our landing page hero. Commercial-safe only, no editorial images. Show me its licence and credit line first.
```

```text
Pick the images for this slide deck: a title slide background of the night sky, Saturn for slide 3, a vintage map of Europe for slide 5, and icons for growth, team and security. Give me credits.html.
```

```text
I'm writing an article about Japanese art. Find public-domain Hokusai and Hiroshige prints, and tell me which museum each one is from.
```

Tips for agents and the people prompting them:

- Describe the picture, not the file: "close-up of coffee beans", "aerial photo of a winding river", "line icon of a shopping cart".
- Put the format in the words or the filters: "vertical", "4k", "svg", "transparent png".
- Results with `downloadable: false` must be fetched from their `url` on the source site.

## Local mode: downloads straight to disk

For `download_image` and image-set downloads into your project, run the server locally over stdio:

```bash
claude mcp add images-local -- npx -y image-asset-server mcp
```

Or with Docker, mounting your images folder:

```bash
claude mcp add images-local -- docker run -i --rm \
  --user "$(id -u):$(id -g)" -v "$PWD/images:/app/images" \
  ghcr.io/arielshad/image-asset-server node dist/cli.js mcp
```

Files land in `./images/<category>/` (set `IMAGE_DOWNLOAD_DIR` to change it), with `ATTRIBUTION.md` and `credits.json` next to them. `build_image_set` with `download=true` saves the picks into `./images/sets/<name>/images/` and writes the exports next to them, pointing at the local files. No source needs an API key.

## Agents without MCP

Any agent that can fetch URLs can use the REST API directly. Point it at [/AGENTS.md](/AGENTS.md); it has the whole workflow and the licence rules in a few lines. In Claude Code you can also install the ready-made skill:

```bash
mkdir -p ~/.claude/skills/images
curl -fsSL https://image.shep.bot/skill/SKILL.md -o ~/.claude/skills/images/SKILL.md
```
