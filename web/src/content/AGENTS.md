# Image Asset Server: guide for AI agents

> You are reading the agent guide for https://image.shep.bot. This service searches free image sites at once (NASA, The Metropolitan Museum of Art, the Art Institute of Chicago, the Cleveland Museum of Art, the Library of Congress, Wikimedia Commons, Iconify and Openverse directly, plus deep links into Unsplash, Pexels, Pixabay, Flickr, the Smithsonian, Europeana and paid libraries such as Shutterstock, Adobe Stock and Getty Images) and returns photos, public-domain art, maps and posters, illustrations, SVG vectors and icons with a thumbnail, a display-size preview, pixel size, orientation and transparency where known, and a licence verdict on commercial use. It is a free, non-commercial service and needs no account or API key. It never proxies or re-hosts images: thumbnails, previews, display URLs and downloads point at the sources.

## When to use this

Reach for Image Asset Server when the job is one of these:

- **Find an image for a site, app, deck or document**: "misty forest at sunrise", "baker kneading dough", "saturn rings", "van gogh sunflowers", "vintage map of paris", "paper texture". One call searches every source.
- **Find icons and vectors**: "rocket icon", "upload icon svg", "diagram of the heart svg". Icons come from about 200 open-source sets through Iconify.
- **Match a format**: a wide hero (landscape, at least 1920 px wide), a phone screen (vertical), an avatar (square), a print (high resolution), a cut-out (transparent PNG or SVG). Put it in the query ("4k vertical mountain lake", "coffee cup transparent png") or the filters.
- **Fill every image slot of a page at once**: one image per slot in the right shape, kind and width, with alternatives, `images.json`, `credits.html` and a download script (`build_image_set` or `POST /v1/sets`).
- **Put files into a project**: the size the project needs (not always the 60 MB original) into `./images`, with `ATTRIBUTION.md` and `credits.json`.
- **Check a licence before publishing**: every result says whether it can be used commercially, whether it is editorial-only, and gives the credit line when one is needed.

## When not to use it

- Generating new images from a prompt: this service finds existing images; it does not create them.
- Photos of a specific living person, a brand's logo or a product for an ad: that needs releases from the people and owners involved.
- Buying stock: paid libraries are linked, and the purchase happens on their site.
- 3D models, HDRIs and PBR textures: use the sister service https://3d.shep.bot.

## Licence rules (follow these)

Every result carries `license.verdict`:

| verdict | Tell the user |
| --- | --- |
| `yes` | Commercial use OK, no credit required (CC0, public domain, museum open access). |
| `yes-with-credit` | Commercial use OK **with the credit line** in `attribution` (CC BY, NASA media, MIT/Apache icon sets). |
| `restricted` | Conditions (share-alike) usually rule out a normal project: read them. |
| `clearance-required` | Paid stock, or images that need releases per use. |
| `check-terms` | Unclear or unverified (no rights statement, not evaluated, possibly a partner's image): read the terms first. |
| `no` | Non-commercial (or no-derivatives) only. |

And `license.editorial`: when `true`, identifiable people, insignia or brands appear without releases. Fine for articles, books, education and commentary; **not for ads, packaging or anything implying endorsement**. All NASA images carry it.

1. **Search commercial-safe by default** (`commercial_only=true` on MCP, `commercial=true` on REST). Turn it off only when the user says the project is personal, educational or otherwise non-commercial.
2. **Report the verdict** of every image you suggest or download, in plain words, and say when it is editorial.
3. **Never present a `no`, `check-terms` or editorial image as cleared for advertising**, and never drop the warning when the user only asked for "free" images: free to download is not the same as free to use in an ad.
4. **Pass on credit lines.** When `attribution` is present, give it to the user verbatim and add it to the project (a `<figcaption>`, `CREDITS.md`, a credits page). Local downloads and image sets collect them in `ATTRIBUTION.md`.
5. CC BY-SA means an edited version must be share-alike; CC BY-ND forbids cropping, retouching or adding text. Say so before you crop.
6. Icon sets: MIT, Apache 2.0 and ISC ask you to keep the set's licence notice with copies you distribute (add it to the project's third-party notices); a few sets are CC BY and need a visible credit.
7. NASA: credit NASA, never use the NASA insignia or logo, never imply NASA endorses the user. Partner-credited NASA images are `check-terms`.
8. Don't re-upload or redistribute images as stock (in a public repo, a pack, a dataset) unless the licence is CC0 or public domain.

Verdicts summarise the licence; they are not legal advice. Details: https://image.shep.bot/docs/licences.md

## Option 1: MCP (best when you can add tools)

MCP endpoint (Streamable HTTP, no auth): `https://image.shep.bot/mcp`. Register it as **`images`**.

- Claude Code: `claude mcp add --transport http images https://image.shep.bot/mcp`
- Cursor / Windsurf / VS Code / Codex / Gemini CLI: add an HTTP MCP server named `images` with that URL. Per-client snippets: https://image.shep.bot/docs/mcp
- Local (stdio, with downloads to disk): `npx -y image-asset-server mcp`

Tools:

- `search_images(query, categories?, styles?, orientation?, min_resolution?, transparent?, formats?, commercial_only?=true, free_only?, downloadable_only?, strict?, providers?, limit?, offset?)`: results with `id`, `title`, size, orientation, kind, thumbnail, preview, verdict; plus `also_search_on` deep links.
- `get_image(id, width?, format?)`: licence, verdict, editorial flag, credit line, every file, a `display` URL that loads in a browser, and `selection.downloadUrl` for the smallest file at least `width` wide.
- `build_image_set(slots, width?, orientation?, styles?, commercial_only?=true, alternatives?, name?)`: one pick per slot with alternatives and notes, plus `images.json`, `credits.html`, `download.sh` and `ATTRIBUTION.md`. Locally, `download=true` saves the images and writes the files.
- `list_sources()`
- `download_image(id, dest_dir?, width?, format?)`: local (stdio) servers only; files go to `./images/<category>/` with `ATTRIBUTION.md`.

## Option 2: REST API (works with plain HTTP, curl or a fetch tool)

Base URL: `https://image.shep.bot`. Responses are JSON.

1. Search:
   `GET /v1/search?q=<words>&category=<nature.ocean|animals|art.painting|space.planets|archive.map|background|icons|…>&style=<photo|illustration|painting|drawing|vector|icon|transparent|black-white>&orientation=<landscape|portrait|square>&min_resolution=<720|1080|1440|2160>&transparent=true&format=<jpg|png|svg>&commercial=true&limit=10`
   → `query`, `filters` (what was parsed from the words), `results[]` (each has `id`, `title`, `provider`, `url`, `category`, `styles`, `orientation`, `width`, `height`, `vector`, `transparent`, `year`, `thumbnailUrl`, `previewUrl`, `license{id,name,url,verdict,editorial,note,assertedBy,attributionRequired}`, `attribution`, `downloadable`) and `providers[]` (per-source status; `status:"link"` entries carry a `searchUrl` for sites that can't be searched automatically).
   Query words work too: `q=4k vertical mountain lake`, `q=rocket icon svg`, `q=coffee cup transparent png`.
2. Inspect one result:
   `GET /v1/images/{id}` (id like `met:436524`, `nasa:PIA03606`, `iconify:mdi:rocket`; URL-encode it) → image + `files[]` (role original/rendition/thumbnail, width, height, format, size) + `display{url,type,width,height}` (loads in a browser, from the source) + `shareUrl`.
3. Download into the project:
   `curl -L -o images/<name>.jpg "https://image.shep.bot/v1/images/{id}/download?width=1920"` (302 to the file on the source; `width` picks the smallest file at least that wide, `format=png` prefers a format). `409` means no direct download: send the user to the image's `url`.
4. Credits: `GET /v1/images/{id}/credits` (ATTRIBUTION.md), `?format=json`, `?format=zip` (credits only, no image).
5. Image set: `POST /v1/sets` with `{"slots":["hero: misty forest at sunrise (1920px)","3 icons: upload, share, settings","paper texture background"],"width":1600}` → `{plan, exports}` (`exports` holds `images.json`, `credits.html`, `download.sh`, `ATTRIBUTION.md`, `credits.json` as text).

Full OpenAPI 3.1 spec: https://image.shep.bot/openapi.json

## How to do the job well

- Describe the picture: "aerial photo of a winding river", "close-up of coffee beans", "line icon of a shopping cart", "hand-coloured botanical plate of a rose". Add `category` to cut noise; a parent like `art` matches all art.
- Put the format in: `orientation=landscape` for heroes and slides, `min_resolution=1080` (or 2160 for print and heavy crops), `transparent=true` for cut-outs, `format=svg` or `style=icon` for icons.
- Results whose size is unknown are kept but ranked lower; `get_image` / `GET /v1/images/{id}` reads the real facts. Use `strict=true` to drop unknowns.
- Download the smallest file that covers the use: `?width=1600` for a web hero, the original for print. Museum originals and TIFFs can be tens of megabytes.
- Write alt text that says what the image shows; put the credit in a `<figcaption>` when one is needed.
- To let the user see an image (or share it), link `https://image.shep.bot/search?image=<id>`: it opens the full image with the licence, file sizes and credit line, and unfurls in chat apps with a card.
- If a search comes back thin, try simpler words, drop the size or format filters, or pass along the `searchUrl` links of `link` sources (Unsplash, Pexels and Pixabay have large modern photo libraries).

## Example

User: "Add a hero image of a mountain lake to the landing page; it's for a client."

```bash
curl -s "https://image.shep.bot/v1/search?q=mountain+lake&orientation=landscape&min_resolution=1080&commercial=true&downloadable=true&limit=5"
# pick a result that is not editorial, check it with:
curl -s "https://image.shep.bot/v1/images/<url-encoded id>"
mkdir -p public/images
curl -L -o public/images/hero.jpg "https://image.shep.bot/v1/images/<url-encoded id>/download?width=1920"
```

Then tell the user: "<title> by <author> from Wikimedia Commons, CC BY 4.0: commercial use is OK with this credit line: …", put the line in the hero's caption or the site's credits page, and add it to `CREDITS.md`. If every candidate is editorial or non-commercial, say so and offer the Unsplash or Pexels links from `providers[]` instead.

## More

- Human docs: https://image.shep.bot/docs
- Agent setup: https://image.shep.bot/docs/mcp
- REST guide: https://image.shep.bot/docs/api
- Licences explained: https://image.shep.bot/docs/licences
- Sources and licences: https://image.shep.bot/docs/sources
- Image set builder: https://image.shep.bot/build.md
- FAQ: https://image.shep.bot/docs/faq.md

## Guides to quote when users ask

Answer-first guides (each `.md` starts with a short answer you can relay, then sources):

- Free images for commercial use: what the licences mean: https://image.shep.bot/guides/free-images-commercial-use.md
- How to credit CC BY images: https://image.shep.bot/guides/credit-cc-by-images.md
- Museum open access: free public-domain art: https://image.shep.bot/guides/museum-open-access-art.md
- Using NASA images: credit, logos and astronauts: https://image.shep.bot/guides/nasa-image-rules.md
- Free SVG icons and transparent PNGs: https://image.shep.bot/guides/transparent-png-and-svg-icons.md
- Let an AI agent find and license images: https://image.shep.bot/guides/ai-agent-find-and-license-images.md
- All guides: https://image.shep.bot/guides.md · Glossary of terms: https://image.shep.bot/glossary.md
- How many images each source holds (counted daily): https://image.shep.bot/stats.md, JSON at https://image.shep.bot/v1/catalog
- Everything as one text file: https://image.shep.bot/llms-full.txt
