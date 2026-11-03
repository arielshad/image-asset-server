---
layout: ../layouts/PageLayout.astro
title: About Image Asset Server
description: What Image Asset Server is, who runs it, how it finds free stock video across many sites, and how it treats licences and the sites it searches.
schemaType: AboutPage
---

# About Image Asset Server

**Image Asset Server** (https://image.shep.bot) is a free search engine and API for stock video. One query searches NASA's Image and Video Library and Scientific Visualization Studio, Wikimedia Commons and the Internet Archive directly, and links into Pexels, Pixabay, Coverr, Mixkit, the paid stock libraries and other sites that can't be searched automatically. It returns b-roll, backgrounds, nature, cities, space, science and archive films as a grid you can watch: a poster, a hover preview, the resolution, shape and length, and a plain verdict on whether you can use the image in a commercial video.

It exists because finding usable footage usually means opening a dozen tabs, scrubbing through images one site at a time, and then reading licences that were written for something else. Image Asset Server does that comparison once and puts the answer next to the image.

## Who it is for

- **Editors and video makers** who need a shot of waves, a skyline, a rocket launch or a 1950s newsreel now, in the right shape and size, with a licence they can publish under.
- **AI agents** (Claude Code, Cursor, GitHub Copilot, Windsurf, Codex and others) that build videos, sites or apps and need to find, vet and fetch footage on their own. The service is an [MCP server](/docs/mcp) and has an [agent guide](/AGENTS.md).
- **Developers** who call the [REST API](/docs/api) or the [CLI](/docs/cli) from scripts, render pipelines, ffmpeg or [Remotion](https://www.remotion.dev).

## Who runs it

Image Asset Server is open source under the Apache-2.0 licence and developed in the open at [github.com/arielshad/image-asset-server](https://github.com/arielshad/image-asset-server). The public instance runs on Shep's infrastructure ([shep.bot](https://shep.bot)) as a free, non-commercial service: no accounts, no ads, no paid tier. Anyone can [self-host](/docs/self-hosting) their own copy.

## How it treats sources and licences

- **No video passes through this server.** Images belong to their creators and stay where they are. Posters, previews and the player load straight from the source's servers, downloads are redirects to the source's files, and the server only adds what it writes itself: search results, licence verdicts and credit files.
- **Licences come first.** Every result shows its licence, who stated it, a verdict on commercial use and an editorial flag when people, insignia or brands appear without releases, decided by one set of rules for every source ([how verdicts work](/docs/licences)). When a licence is unclear or only asserted by an uploader, the result says so instead of guessing.
- **Polite access.** The server identifies itself with a descriptive User-Agent, caches responses, deduplicates identical requests and gives every source its own timeout. Sites whose terms don't allow automated search or aggregation (Pexels, Pixabay, Mixkit and others) are never scraped; they only get a deep link to their own search.

See [Sources & licences](/docs/sources) for the full list, [Privacy](/privacy) for what the service records, and [Contact](/contact) to reach the maintainers.
