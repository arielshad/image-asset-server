---
layout: ../layouts/PageLayout.astro
title: About Image Asset Server
description: What Image Asset Server is, who runs it, how it finds free images across many sites, and how it treats licences and the sites it searches.
schemaType: AboutPage
---

# About Image Asset Server

**Image Asset Server** (https://image.shep.bot) is a free search engine and API for openly licensed images. One query searches NASA, The Metropolitan Museum of Art, the Art Institute of Chicago, the Cleveland Museum of Art, the Library of Congress, Wikimedia Commons, Iconify and Openverse directly, and links into Unsplash, Pexels, Pixabay, Flickr, the Smithsonian, the paid stock libraries and other sites that can't be searched automatically. It returns photos, public-domain art, maps and posters, illustrations, SVG vectors and icons as one grid: a thumbnail at the image's own shape, its pixel size, and a plain verdict on whether you can use it commercially.

It exists because finding a usable image usually means opening a dozen tabs, searching one site at a time, and then reading licences that were written for something else. Image Asset Server does that comparison once and puts the answer next to the image.

## Who it is for

- **Designers, writers and teachers** who need a hero photo, a public-domain painting, an old map or a set of icons now, in the right shape and size, with a licence they can publish under.
- **AI agents** (Claude Code, Cursor, GitHub Copilot, Windsurf, Codex and others) that build sites, apps, slides and documents and need to find, vet and fetch images on their own. The service is an [MCP server](/docs/mcp) and has an [agent guide](/AGENTS.md).
- **Developers** who call the [REST API](/docs/api) or the [CLI](/docs/cli) from scripts, static-site builds and content pipelines.

## Who runs it

Image Asset Server is open source under the Apache-2.0 licence and developed in the open at [github.com/arielshad/image-asset-server](https://github.com/arielshad/image-asset-server). The public instance runs on Shep's infrastructure ([shep.bot](https://shep.bot)) as a free, non-commercial service: no accounts, no ads, no paid tier. Anyone can [self-host](/docs/self-hosting) their own copy.

## How it treats sources and licences

- **No image passes through this server.** Images belong to their creators and stay where they are. Thumbnails, previews and the detail view load straight from the source's servers, downloads are redirects to the source's files, and the server only adds what it writes itself: search results, licence verdicts and credit files.
- **Licences come first.** Every result shows its licence, who stated it, a verdict on commercial use and an editorial flag when people, insignia or brands appear without releases, decided by one set of rules for every source ([how verdicts work](/docs/licences)). When a licence is unclear or only asserted by an uploader, the result says so instead of guessing.
- **Polite access.** The server identifies itself with a descriptive User-Agent, caches responses, deduplicates identical requests and gives every source its own timeout. Sites whose terms don't allow automated search or aggregation (Unsplash, Pexels, Pixabay and others) are never scraped; they only get a deep link to their own search.

See [Sources & licences](/docs/sources) for the full list, [Privacy](/privacy) for what the service records, and [Contact](/contact) to reach the maintainers.
