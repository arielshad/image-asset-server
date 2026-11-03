---
title: "Let an AI agent find and license images for your project"
seoTitle: "AI agents: find and license images via MCP"
description: "Connect Claude Code, Cursor or another MCP client to Image Asset Server so your agent finds free images, checks the licence and writes the credits."
answer: "Add the MCP server (claude mcp add --transport http images https://image.shep.bot/mcp) and ask for what you need: 'a hero image of a mountain lake and three feature icons for the landing page'. The agent calls search_images or build_image_set, which only return commercial-safe images by default, downloads the files and writes the credit lines into ATTRIBUTION.md."
section: AI agents
kind: howto
steps:
  - name: "Connect the server"
    text: "Run claude mcp add --transport http images https://image.shep.bot/mcp, or add the same URL in Cursor, VS Code or any MCP client. For local file writes, run npx -y image-asset-server mcp instead."
  - name: "Describe the images"
    text: "Say what each image shows, its shape and its use: 'a wide hero image of a misty forest', 'a vertical poster of a Hokusai wave', 'SVG icons for upload, share and settings'."
  - name: "Let it pick and check"
    text: "The agent searches every source, keeps commercial-safe licences, and for a whole page calls build_image_set, which picks one image per slot with alternatives."
  - name: "Review the credits"
    text: "Check ATTRIBUTION.md or credits.html, and any image flagged editorial, before you publish."
faq:
  - q: "Will the agent use images I can't use commercially?"
    a: "Not by default: search_images and build_image_set return only 'yes' and 'yes-with-credit' verdicts unless the agent sets commercial_only=false because you said the project is non-commercial."
  - q: "Does the hosted server download files for the agent?"
    a: "No. It returns direct links to the files on the sources; the agent downloads them with curl. The local MCP server (npx) can save files itself with download_image."
  - q: "Which tools does the server offer?"
    a: "search_images, get_image, build_image_set and list_sources, plus download_image when it runs locally."
searches:
  - { label: "Commercial-safe hero images", href: "/search?q=forest+mist&orientation=landscape&commercial=true" }
  - { label: "Icons", href: "/search?q=settings+icon" }
collections: [free-svg-icons, free-4k-nature-photos]
related: [free-images-commercial-use, credit-cc-by-images, transparent-png-and-svg-icons]
cites:
  - { name: "Model Context Protocol", url: "https://modelcontextprotocol.io/" }
  - { name: "Claude Code: MCP", url: "https://docs.claude.com/en/docs/claude-code/mcp" }
published: 2026-11-03
updated: 2026-11-03
order: 6
---

## What the agent sees

Every result carries its pixel size, orientation, kind (photo, painting, vector, icon…), a thumbnail URL, the licence with its verdict, an editorial flag and a ready-to-paste credit line. The server's instructions tell the agent never to present a non-commercial, unverified or editorial image as cleared for advertising.

## A whole page in one call

`build_image_set` takes a list of slots:

```text
hero: misty forest at sunrise, landscape (1920px)
3 icons: upload, share, settings
background: paper texture
portrait of a potter at the wheel
```

It returns one pick per slot with alternatives, the file to use (the smallest at least as wide as the slot), suggested alt text, and exports: `images.json`, `credits.html` with `<figure>` captions, `download.sh` and `ATTRIBUTION.md`. Try it in the browser on the [image set builder](/build).

## Without MCP

The same features are a REST API: `GET /v1/search?q=…`, `GET /v1/images/{id}/download?width=1920` (a redirect to the file) and `POST /v1/sets`. See the [API guide](/docs/api).
