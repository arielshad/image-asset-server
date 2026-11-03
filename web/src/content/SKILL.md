---
name: images
description: Find and download free images (photos, public-domain museum art, maps and posters, illustrations, SVG vectors and open-source icons) from NASA, the Met, the Art Institute of Chicago, the Cleveland Museum of Art, the Library of Congress, Wikimedia Commons, Iconify and Openverse, with links into Unsplash, Pexels and paid libraries, via https://image.shep.bot, with a licence verdict, editorial flag and credit line on every image. Use when the user needs images for a website, app, slide deck, document or post, icons, textures, or a whole set of images for a page.
---

# Free images via image.shep.bot

Search many image sites in one call, check each image's licence verdict, and download the size the project needs. No API key needed. Images never pass through the service: every URL points at the source.

## Workflow

1. Search (commercial-safe by default; add the format to cut noise):

   ```bash
   curl -s "https://image.shep.bot/v1/search?q=QUERY&orientation=landscape&min_resolution=1080&commercial=true&downloadable=true&limit=8"
   ```

   Query words like "4k", "high resolution", "vertical", "svg", "png", "transparent", "icon" or "watercolor" become filters. Categories are dot paths (`nature.ocean`, `nature.plants`, `animals`, `city.skyline`, `architecture`, `people.work`, `food`, `objects`, `space.planets`, `space.earth`, `science`, `art.painting`, `art.drawing`, `archive.map`, `archive.poster`, `background`, `icons`…); a parent like `art` matches its children. Styles: `photo`, `illustration`, `painting`, `drawing`, `vector`, `icon`, `transparent`, `black-white`.
   Each result has `id`, `title`, `provider`, `url`, `category`, `styles`, `orientation`, `width`, `height`, `vector`, `transparent`, `year`, `thumbnailUrl`, `previewUrl`, `license.verdict`, `license.editorial`, `attribution`, `downloadable`.

2. Check the image (files, display URL, credit line):

   ```bash
   curl -s "https://image.shep.bot/v1/images/ID"
   ```

3. Download the size the project needs (a 302 to the file on the source):

   ```bash
   mkdir -p images
   curl -L -o images/NAME.jpg "https://image.shep.bot/v1/images/ID/download?width=1920"
   curl -s "https://image.shep.bot/v1/images/ID/credits" >> images/ATTRIBUTION.md
   ```

4. Every image a page needs, in one call:

   ```bash
   curl -s -X POST "https://image.shep.bot/v1/sets" -H "content-type: application/json" \
     -d '{"slots":["hero: misty forest at sunrise (1920px)","3 icons: upload, share, settings","paper texture background"],"width":1600}'
   ```

   Save `exports["download.sh"]` and run `sh download.sh`, paste `exports["credits.html"]` (`<figure>` with credit captions) into the page, and keep `exports["ATTRIBUTION.md"]`.

## Licence rules

- Keep `commercial=true` unless the user says the project is non-commercial. Free to download is not free to use in an ad.
- Always report each image's verdict: `yes` (commercial OK), `yes-with-credit` (OK with the `attribution` line), `restricted` / `clearance-required` / `check-terms` (read the terms first), `no` (non-commercial only).
- `license.editorial: true` (all NASA images, some archive photos) = people, insignia or brands without releases: articles, books and education only, never ads or endorsements.
- Never present a `no`, `check-terms` or editorial image as cleared for advertising. CC BY-SA (`restricted`) makes edited versions share-alike; CC BY-ND (`no`) forbids cropping or editing.
- When `attribution` is present, give it to the user verbatim and add it to the project's credits (a caption, `CREDITS.md`, a credits page).
- Icon sets under MIT, Apache 2.0 or ISC: keep the set's licence notice in the project's third-party notices.
- NASA: credit NASA, no NASA logo, no implied endorsement.

## Notes

- URL-encode the id (`iconify:mdi:rocket` → `iconify%3Amdi%3Arocket`); ids can contain colons, spaces and slashes.
- `409` from download = no direct files; give the user the image `url`.
- Icons are SVGs: no `width` needed; they recolour with CSS (`currentColor`).
- Link `https://image.shep.bot/search?image=ID` so the user can see it full size.
- MCP alternative: `claude mcp add --transport http images https://image.shep.bot/mcp` (tools `search_images`, `get_image`, `build_image_set`, `list_sources`).

## When the user asks about licences

Quote the short answer at the top of the matching guide: commercial use (https://image.shep.bot/guides/free-images-commercial-use.md), crediting CC BY (https://image.shep.bot/guides/credit-cc-by-images.md), museum open access (https://image.shep.bot/guides/museum-open-access-art.md), NASA rules (https://image.shep.bot/guides/nasa-image-rules.md), icons and transparent files (https://image.shep.bot/guides/transparent-png-and-svg-icons.md). All guides: https://image.shep.bot/guides.md · Glossary: https://image.shep.bot/glossary.md

Full guide: https://image.shep.bot/AGENTS.md · Licences: https://image.shep.bot/docs/licences.md · OpenAPI: https://image.shep.bot/openapi.json
