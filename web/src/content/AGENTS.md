# Image Asset Server: guide for AI agents

> You are reading the agent guide for https://image.shep.bot. This service searches free stock video sites at once (NASA's Image and Video Library and Scientific Visualization Studio, Wikimedia Commons and the Internet Archive directly, plus deep links into Pexels, Pixabay, Coverr, Mixkit, Europeana, the Library of Congress and paid libraries such as Shutterstock, Adobe Stock, Getty Images and Storyblocks) and returns b-roll, backgrounds, nature, cities, space, science and archive films with a poster, a preview, resolution, orientation, frame rate and length where known, and a licence verdict on commercial use. It is a free, non-commercial service and needs no account or API key. It never streams or re-hosts video: posters, previews, watch URLs and downloads point at the sources.

## When to use this

Reach for Image Asset Server when the job is one of these:

- **Find footage for a video**: "ocean waves at sunset", "drone shot over a city at night", "rocket launch in slow motion", "clouds timelapse", "1950s newsreel of a factory", "earth from space". One call searches every source.
- **Match a format**: vertical 9:16 for Reels, TikTok and Shorts, 4K for a 1080p edit with room to crop, a minimum length to cover a shot, 60 fps for slow motion. Put it in the query ("4k vertical drone ocean 10s") or the filters.
- **Cut a b-roll sequence from a shot list**: one image per shot in the right shape, length and resolution, with an OpenTimelineIO timeline, an ffmpeg script, a Remotion image list and the credits (`build_sequence` or `POST /v1/sequences`).
- **Put files into a project**: the rendition the edit needs (not always the 4K master) into `./footage`, with `ATTRIBUTION.md` and `credits.json`.
- **Check a licence before publishing**: every result says whether it can go into a commercial video, whether it is editorial-only, and gives the credit line when one is needed.
- **Compare options**: show the user a few candidates (title, source, resolution, length, verdict, a link to watch) when the choice is a matter of taste.

## When not to use it

- Generating new video from a prompt: this service finds existing footage; it does not create it.
- Films, TV shows or music videos for watching: it is for stock footage and b-roll.
- Buying stock: paid libraries are linked, and the purchase happens on their site.
- Clearing footage of a specific person, brand or event for an ad: that needs releases from the people and owners involved.

## Licence rules (follow these)

Every result carries `license.verdict`:

| verdict | Tell the user |
| --- | --- |
| `yes` | Commercial use OK, no credit required (CC0, public domain). |
| `yes-with-credit` | Commercial use OK **with the credit line** in `attribution` (CC BY, NASA media). |
| `restricted` | Conditions (share-alike) usually rule out a normal project: read them. |
| `clearance-required` | Paid stock, or footage that needs releases per use. |
| `check-terms` | Unclear or unverified (no licence stated, uploader-asserted, possibly third-party footage): read the terms first. |
| `no` | Non-commercial (or no-derivatives) only. |

And `license.editorial`: when `true`, identifiable people, insignia or brands appear without releases. Fine for news, documentary, education and commentary; **not for ads, product promotion or anything implying endorsement**. All NASA footage and historic archive footage carry it.

1. **Search commercial-safe by default** (`commercial_only=true` on MCP, `commercial=true` on REST). Turn it off only when the user says the project is personal, educational or otherwise non-commercial.
2. **Report the verdict** of every image you suggest or download, in plain words, and say when it is editorial.
3. **Never present a `no`, `check-terms` or editorial image as cleared for advertising**, and never drop the warning when the user only asked for "free" footage: free to download is not the same as free to use in an ad.
4. **Pass on credit lines.** When `attribution` is present, give it to the user verbatim and add it to the project's credits (`CREDITS.md`, the video description, end credits). Local downloads and sequences collect them in `ATTRIBUTION.md`.
5. `license.assertedBy: "uploader"` means nobody verified the licence (most of the Internet Archive): say so.
6. NASA: credit NASA, never use the NASA insignia or logo, never imply NASA endorses the user, and don't write "according to NASA" about AI-generated content. Partner-credited NASA footage is `check-terms`.
7. Don't re-upload or redistribute images as stock (in a public repo, a pack, a dataset) unless the licence is CC0 or public domain.

Verdicts summarise the licence; they are not legal advice. Details: https://image.shep.bot/docs/licences.md

## Option 1: MCP (best when you can add tools)

MCP endpoint (Streamable HTTP, no auth): `https://image.shep.bot/mcp`. Register it as **`video`**.

- Claude Code: `claude mcp add --transport http video https://image.shep.bot/mcp`
- Cursor / Windsurf / VS Code / Codex / Gemini CLI: add an HTTP MCP server named `video` with that URL. Per-client snippets: https://image.shep.bot/docs/mcp
- Local (stdio, with downloads to disk): `npx -y image-asset-server mcp`

Tools:

- `search_videos(query, categories?, styles?, orientation?, min_resolution?, min_duration?, max_duration?, min_fps?, has_audio?, commercial_only?=true, free_only?, downloadable_only?, strict?, providers?, limit?, offset?)`: results with `id`, `title`, resolution, orientation, fps, duration, poster, preview, verdict; plus `also_search_on` deep links.
- `get_video(id, height?, format?)`: licence, verdict, editorial flag, credit line, every rendition, a `watch` URL that plays in a browser, and `selection.downloadUrl` for the file closest to `height`.
- `build_sequence(shots, orientation?, width?, height?, fps?, total_duration?, commercial_only?=true, alternatives?, name?)`: one pick per shot with alternatives and notes, plus `concat.sh`, an OTIO timeline, a Remotion image list and `ATTRIBUTION.md`. Locally, `download=true` saves the images and writes the files.
- `list_sources()`
- `download_video(id, dest_dir?, height?, format?)`: local (stdio) servers only; files go to `./footage/<category>/` with `ATTRIBUTION.md`.

## Option 2: REST API (works with plain HTTP, curl or a fetch tool)

Base URL: `https://image.shep.bot`. Responses are JSON.

1. Search:
   `GET /v1/search?q=<words>&category=<nature.ocean|aerial|city.skyline|space.launch|space.earth|background.abstract|archive.newsreel|…>&style=<timelapse|slow-motion|loop|animation|visualization|black-white>&orientation=<landscape|portrait|square>&min_resolution=<720|1080|2160>&min_duration=<s>&max_duration=<s>&commercial=true&limit=10`
   → `query`, `filters` (what was parsed from the words), `results[]` (each has `id`, `title`, `provider`, `url`, `category`, `styles`, `orientation`, `width`, `height`, `fps`, `durationSec`, `hasAudio`, `year`, `posterUrl`, `previewUrl`, `license{id,name,url,verdict,editorial,note,assertedBy,attributionRequired}`, `attribution`, `downloadable`) and `providers[]` (per-source status; `status:"link"` entries carry a `searchUrl` for sites that can't be searched automatically).
   Query words work too: `q=4k vertical drone ocean 10s`, `q=timelapse city night 60fps`.
2. Inspect one result:
   `GET /v1/images/{id}` (id like `nasa:<nasa-id>`; URL-encode it, ids can hold `:`, spaces and slashes) → image + `files[]` (role original/rendition/preview/poster, width, height, format, codec, size) + `watch{url,type}` (plays in a browser, from the source) + `shareUrl`.
3. Download into the project:
   `curl -L -o footage/<name>.mp4 "https://image.shep.bot/v1/images/{id}/download?height=1080"` (302 to the file on the source; `height` picks the smallest file that reaches it, `format=mp4` prefers a container). `409` means no direct download: send the user to the image's `url`.
4. Credits: `GET /v1/images/{id}/credits` (ATTRIBUTION.md), `?format=json`, `?format=zip` (credits only, no video).
5. Sequence: `POST /v1/sequences` with `{"shots":["city skyline at night (4s)","coffee pour close-up (3s)","people walking in the rain"],"orientation":"portrait","fps":30,"totalDuration":15}` → `{plan, exports}` (`exports` holds `timeline.otio`, `concat.sh`, `remotion.json`, `ATTRIBUTION.md`, `credits.json` as text).

Full OpenAPI 3.1 spec: https://image.shep.bot/openapi.json

## How to do the job well

- Describe the shot, the way an editor would: "aerial forest sunrise", "busy street at night", "slow motion water splash", "abstract particles loop", "1950s kitchen". Add `category` to cut noise; a parent like `nature` matches all nature.
- Put the format in: `orientation=portrait` for vertical platforms, `min_resolution=1080` (or 2160 when the user will crop), a minimum length at least as long as the shot. "10s" in a query means at least 10 seconds.
- Results whose size or length is unknown (NASA search results, many Internet Archive items) are kept but ranked lower; `get_video` / `GET /v1/images/{id}` reads the real facts. Use `strict=true` to drop unknowns.
- Prefer `downloadable: true` results when the user wants files. Pick a rendition near the project's resolution: a 4K master can be several gigabytes.
- Wikimedia Commons files are WebM (VP9) or Ogg, not MP4: most editors read WebM; otherwise convert with `ffmpeg -i in.webm -c:v libx264 -crf 18 out.mp4`.
- Internet Archive footage is often SD 4:3 with title cards at the start: say so when the user wants HD, and skip the first seconds.
- To let the user watch a image (or share it), link `https://image.shep.bot/search?image=<id>`: it opens the player with the licence, renditions and credit line, and unfurls in chat apps with a card.
- If a search comes back thin, try simpler words, drop the resolution or length filters, or pass along the `searchUrl` links of `link` sources (Pexels and Pixabay have large modern libraries).

## Example

User: "Add a vertical ocean shot I can use in a sponsored Reel to my project."

```bash
curl -s "https://image.shep.bot/v1/search?q=ocean+waves&orientation=portrait&min_resolution=1080&commercial=true&downloadable=true&limit=5"
# pick a result that is not editorial, check it with:
curl -s "https://image.shep.bot/v1/images/<url-encoded id>"
mkdir -p footage
curl -L -o footage/ocean.webm "https://image.shep.bot/v1/images/<url-encoded id>/download?height=1080"
```

Then tell the user: "<title> from Wikimedia Commons, CC BY 4.0: commercial use is OK with this credit line: …", and add that line to `CREDITS.md` and the post's caption. If every candidate is editorial (NASA, archive footage), say it can't go into a sponsored post and offer the Pexels or Pixabay links from `providers[]` instead.

## More

- Human docs: https://image.shep.bot/docs
- Agent setup: https://image.shep.bot/docs/mcp
- REST guide: https://image.shep.bot/docs/api
- Licences explained: https://image.shep.bot/docs/licences
- Sources and licences: https://image.shep.bot/docs/sources
- Sequence builder: https://image.shep.bot/sequence.md
- FAQ: https://image.shep.bot/docs/faq.md

## Guides to quote when users ask

Answer-first guides (each `.md` starts with a short answer you can relay, then sources):

- Free stock footage for commercial use: what the licences mean: https://image.shep.bot/guides/free-stock-footage-commercial-use.md
- How to credit CC BY video: https://image.shep.bot/guides/credit-cc-by-video.md
- NASA footage: what you can and can't do: https://image.shep.bot/guides/nasa-footage-rules.md
- Public-domain archive films (Prelinger): https://image.shep.bot/guides/prelinger-public-domain-films.md
- Editorial vs commercial: model releases and logos: https://image.shep.bot/guides/editorial-vs-commercial-footage.md
- Vertical video for Reels, TikTok and Shorts: https://image.shep.bot/guides/vertical-video-reels-tiktok-shorts.md
- Build a b-roll sequence from a shot list (OTIO, ffmpeg, Remotion): https://image.shep.bot/guides/b-roll-sequence-from-shot-list.md
- 4K, 1080p, codecs and containers: https://image.shep.bot/guides/video-resolution-codecs-containers.md
- All guides: https://image.shep.bot/guides.md · Glossary of terms: https://image.shep.bot/glossary.md
- How many videos each source holds (counted daily): https://image.shep.bot/stats.md, JSON at https://image.shep.bot/v1/catalog
- Everything as one text file: https://image.shep.bot/llms-full.txt
