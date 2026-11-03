---
name: video
description: Find, watch and download free stock video (b-roll, backgrounds, nature, cities, aerials, space, science, timelapses, archive films and newsreels) from NASA, Wikimedia Commons, the Internet Archive and links into Pexels, Pixabay and paid libraries via https://image.shep.bot, with a licence verdict, editorial flag and credit line on every image. Use when the user needs footage or b-roll for a video, site or app, vertical images for Reels/TikTok/Shorts, or wants a shot list turned into a b-roll sequence (OTIO, ffmpeg, Remotion).
---

# Stock video via image.shep.bot

Search many video sites in one call, check each image's licence verdict, and download the right rendition into the project. No API key needed. Video is never streamed through the service: every URL points at the source.

## Workflow

1. Search (commercial-safe by default; add the format to cut noise):

   ```bash
   curl -s "https://image.shep.bot/v1/search?q=QUERY&orientation=portrait&min_resolution=1080&commercial=true&downloadable=true&limit=8"
   ```

   Query words like "4k", "vertical", "10s", "60fps" or "timelapse" become filters. Categories are dot paths (`nature.ocean`, `nature.sky`, `aerial`, `city.skyline`, `city.street`, `space.launch`, `space.earth`, `science`, `background.abstract`, `overlay.light`, `greenscreen`, `archive.newsreel`, `archive.film`…); a parent like `nature` matches its children. Styles: `timelapse`, `slow-motion`, `loop`, `animation`, `visualization`, `black-white`.
   Each result has `id`, `title`, `provider`, `url`, `category`, `orientation`, `width`, `height`, `fps`, `durationSec`, `year`, `posterUrl`, `previewUrl`, `license.verdict`, `license.editorial`, `attribution`, `downloadable`.

2. Check the image (renditions, watch URL, credit line):

   ```bash
   curl -s "https://image.shep.bot/v1/images/ID"
   ```

3. Download the rendition the edit needs (a 302 to the file on the source):

   ```bash
   mkdir -p footage
   curl -L -o footage/NAME.mp4 "https://image.shep.bot/v1/images/ID/download?height=1080"
   curl -s "https://image.shep.bot/v1/images/ID/credits" >> footage/ATTRIBUTION.md
   ```

4. A whole b-roll sequence from a shot list:

   ```bash
   curl -s -X POST "https://image.shep.bot/v1/sequences" -H "content-type: application/json" \
     -d '{"shots":["city skyline at night (4s)","coffee pour close-up (3s)","clouds timelapse"],"orientation":"portrait","totalDuration":15}'
   ```

   Save `exports["concat.sh"]` and run `sh concat.sh` to render with ffmpeg, or `exports["timeline.otio"]` for DaVinci Resolve / Kdenlive, and keep `exports["ATTRIBUTION.md"]`.

## Licence rules

- Keep `commercial=true` unless the user says the project is non-commercial. Free to download is not free to use in an ad.
- Always report each image's verdict: `yes` (commercial OK), `yes-with-credit` (OK with the `attribution` line), `restricted` / `clearance-required` / `check-terms` (read the terms first), `no` (non-commercial only).
- `license.editorial: true` (all NASA footage, archive footage) = people, insignia or brands without releases: news, documentary and education only, never ads or endorsements.
- Never present a `no`, `check-terms` or editorial image as cleared for advertising. `license.assertedBy: "uploader"` means the licence is unverified.
- When `attribution` is present, give it to the user verbatim and add it to the project's credits (`CREDITS.md`, the description or end credits).
- NASA: credit NASA, no NASA logo, no implied endorsement.

## Notes

- URL-encode the id (`nasa:ABC_123` → `nasa%3AABC_123`); ids can contain spaces and slashes.
- `409` from download = no direct files; give the user the image `url`.
- Wikimedia Commons files are WebM/Ogg, not MP4.
- Link `https://image.shep.bot/search?image=ID` so the user can watch it.
- MCP alternative: `claude mcp add --transport http video https://image.shep.bot/mcp` (tools `search_videos`, `get_video`, `build_sequence`, `list_sources`).

## When the user asks about licences

Quote the short answer at the top of the matching guide: commercial use (https://image.shep.bot/guides/free-stock-footage-commercial-use.md), crediting CC BY (https://image.shep.bot/guides/credit-cc-by-video.md), NASA rules (https://image.shep.bot/guides/nasa-footage-rules.md), editorial vs commercial (https://image.shep.bot/guides/editorial-vs-commercial-footage.md), archive films (https://image.shep.bot/guides/prelinger-public-domain-films.md). All guides: https://image.shep.bot/guides.md · Glossary: https://image.shep.bot/glossary.md

Full guide: https://image.shep.bot/AGENTS.md · Licences: https://image.shep.bot/docs/licences.md · OpenAPI: https://image.shep.bot/openapi.json
