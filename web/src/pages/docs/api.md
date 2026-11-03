---
layout: ../../layouts/DocsLayout.astro
title: REST API guide
crumb: REST API guide
description: Search free images across many sites with one REST call, read licence verdicts and credit lines, download the size you need and plan image sets.
---

# Image Asset Server REST API guide

A small JSON API over HTTPS. No key is needed on `https://image.shep.bot`. Every endpoint is described in the [OpenAPI 3.1 spec](/openapi.json), which you can explore and try in the [interactive reference](/docs/api/reference).

**Base URL:** `https://image.shep.bot`

## The flow

1. `GET /v1/search`: find candidates across every source.
2. `GET /v1/images/{id}`: read the licence verdict, credit line, pixel size, every file and the `display` URL of one result.
3. `GET /v1/images/{id}/download?width=1920`: a `302` to the file on the source.

Plus `GET /v1/images/{id}/credits` for ATTRIBUTION.md, and `POST /v1/sets` to pick every image a page, deck or post needs in one call.

No image passes through this server: thumbnails, previews, `display` URLs and downloads all point at the source's own servers.

## Search

```bash
curl "https://image.shep.bot/v1/search?q=mountain+lake&orientation=landscape&min_resolution=1080&commercial=true&limit=10"
```

| Parameter | Description |
| --- | --- |
| `q` | Free text, written like a designer would: `mountain lake at sunrise`, `van gogh sunflowers`, `rocket icon`. Size (`4k`, `high resolution`, `1080p`), orientation (`vertical`, `16:9`, `square`), format (`svg`, `png`, `jpg`), transparency (`transparent`, `no background`) and kind (`photo`, `watercolor`, `icon`, `black and white`) words become filters. May be empty when `category` is set (browse). |
| `category` | Comma-separated dot-path categories. A parent matches its children: `art` matches `art.painting` and `art.drawing`. See the `Category` schema for the full list (nature.ocean, nature.plants, animals, city.skyline, architecture, people.work, food, objects, space.planets, science, art.painting, archive.map, background, icons…). |
| `style` | Comma-separated kind and look: `photo`, `illustration`, `painting`, `drawing`, `vector`, `icon`, `transparent`, `black-white`. `vector` and `icon` filter strictly; the others are ranked first and filtered only with `strict=true`, because sources rarely tag them. |
| `orientation` | `landscape`, `portrait` or `square` (comma-separated for several). |
| `min_resolution` | Minimum short side in pixels: `720`, `1080`, `1440`, `2160` (or `hd`, `fhd`, `large`, `4k`). A 2160×3840 phone wallpaper counts as 2160. Vectors always pass. |
| `transparent` | `true`: only images with a transparent background (icons, SVGs, PNG cut-outs). |
| `format` | Comma-separated: `jpg`, `png`, `svg`, `webp`, `tif`. |
| `commercial` | `true`: only images whose licence allows commercial use (verdict `yes` or `yes-with-credit`). Editorial-only images can still appear: check `license.editorial`. |
| `free` | `true`: exclude paid images. |
| `downloadable` | `true`: only images with direct file links. |
| `strict` | `true`: drop images whose orientation, size or transparency is unknown when you filter on it (by default they are kept, ranked lower). |
| `providers` | Comma-separated source ids from `/v1/providers`, e.g. `nasa,met,wikimediacommons`. |
| `limit` | Max results, 1–100 (default 24). |
| `offset` | Per-source offset for the next page (e.g. `24`). |

The response (shortened):

```json
{
  "query": "crab nebula",
  "filters": { "minResolution": 1080, "commercialOnly": true },
  "results": [
    {
      "id": "nasa:PIA03606",
      "provider": "nasa",
      "title": "Crab Nebula Mosaic",
      "url": "https://images.nasa.gov/details/PIA03606",
      "category": "space",
      "styles": ["photo"],
      "orientation": "square",
      "width": 3864, "height": 3864, "year": 2005,
      "thumbnailUrl": "https://images-assets.nasa.gov/image/PIA03606/PIA03606~small.jpg",
      "previewUrl": "https://images-assets.nasa.gov/image/PIA03606/PIA03606~medium.jpg",
      "license": {
        "id": "LicenseRef-NASA-Media", "name": "NASA media (public domain in the US)",
        "attributionRequired": true, "editorial": true, "assertedBy": "source",
        "verdict": "yes-with-credit",
        "note": "Generally not copyrighted in the US; credit NASA. Do not imply NASA endorses you…"
      },
      "attribution": "“Crab Nebula Mosaic” by NASA/JPL (NASA Image and Video Library), https://images.nasa.gov/details/PIA03606, …",
      "downloadable": true
    }
  ],
  "providers": [
    { "provider": "nasa", "name": "NASA Image and Video Library", "status": "ok", "count": 6, "tookMs": 412 },
    { "provider": "unsplash", "name": "Unsplash", "status": "link", "count": 0, "searchUrl": "https://unsplash.com/s/photos/crab-nebula" }
  ]
}
```

`thumbnailUrl` and `previewUrl` are meant for `<img>` tags in a browser: they load straight from the source. Icons are SVGs (`vector: true`, `transparent: true`).

## Licence verdicts

Every `license` has a `verdict` that answers one question: can this go into something you publish commercially (an ad, a product page, a client website, a printed book)?

| `verdict` | Meaning |
| --- | --- |
| `yes` | Commercial use OK, no credit required (CC0, public domain, museum open access). |
| `yes-with-credit` | Commercial use OK with a credit line: use `attribution` (CC BY, NASA media, MIT/Apache icon sets). |
| `restricted` | Conditions that usually rule out a normal project (share-alike). |
| `clearance-required` | Paid stock, or images that need releases per use. |
| `check-terms` | Unclear: no rights statement, not evaluated, or possibly a third party's image. |
| `no` | Non-commercial or no-derivatives only. |

`license.editorial: true` means people, insignia or brands appear without releases: fine for articles, books and education, not for advertising. `license.assertedBy` says who stated the licence: `source` (the site records it per item), `site` (one licence for the whole site) or `uploader` (an unverified claim; such licences are never better than `check-terms`). More in [Image licences explained](/docs/licences).

## Image details

```bash
curl "https://image.shep.bot/v1/images/nasa%3APIA03606"
```

Ids contain `:` and sometimes spaces or slashes (Iconify ids look like `iconify:mdi:rocket`): URL-encode them. Returns the image plus:

- `files[]`: every file the source offers, each with `url`, `filename`, `format` (`jpg`, `png`, `svg`, `tif`…), `role` (`original`, `rendition`, `thumbnail`), `width`, `height` and `sizeBytes` when known.
- `display`: `{ url, type, width, height }`, the file a browser should show in a detail view (a displayable format close to 1280 px wide). It loads from the source.
- `shareUrl`: a link that opens the image on the website (`/search?image=<id>`), which unfurls with its own preview card.

## Choose files

```bash
curl "https://image.shep.bot/v1/images/<id>/files?width=1920&format=jpg"
```

The file a download would pick: with `width`, the smallest file at least that wide (a 1920 px copy rather than a 60 MB TIFF), else the biggest below it; an SVG original always fits. `format` prefers a format, `role` a kind of file. Returns `totalBytes`, the licence and the credit line. `all=true` returns every file.

## Download

```bash
curl -L -o hero.jpg "https://image.shep.bot/v1/images/<id>/download?width=1920"
```

Always a `302` redirect to the chosen file on the source (so use `-L`), with `X-License` and `X-Attribution` headers. The same `width`, `format` and `role` parameters as `/files` choose the file. Images without direct files answer `409` with the image's `url`.

## Credits

```bash
curl "https://image.shep.bot/v1/images/<id>/credits"               # ATTRIBUTION.md
curl "https://image.shep.bot/v1/images/<id>/credits?format=json"   # credits.json
curl -o credits.zip "https://image.shep.bot/v1/images/<id>/credits?format=zip"
```

The zip holds `ATTRIBUTION.md` and `credits.json` only, never the image.

## Plan an image set

```bash
curl -X POST "https://image.shep.bot/v1/sets" -H "content-type: application/json" \
  -d '{"slots":["hero: mountain lake at sunrise (1920px)","3 icons: rocket, shield, chart","botanical illustration of a rose"],"width":1600,"name":"landing"}'
```

`slots` is a list, or text with one slot per line ("(1200px)" at the end sets a slot's width; "3 icons: rocket, shield, chart" makes one slot per item). Optional: `width` (default 1600), `orientation`, `styles` (e.g. `["photo"]`), `commercialOnly` (default `true`), `providers`, `alternatives` (0–5, default 3), `name`. Up to 24 slots.

The response is `{ plan, exports }`. `plan.slots[]` has, per slot, `index`, `description`, `width`, `image`, `file` (the file the exports use: the smallest at least as wide as the slot), `alt` (suggested alt text), `alternatives` and a `note` when the pick is smaller, a different shape or editorial. `plan.commercialSafe` is true when every pick is `yes` or `yes-with-credit`. `exports` holds the text of `images.json`, `credits.html`, `download.sh`, `ATTRIBUTION.md` and `credits.json`. The [image set builder](/build) is a page on top of this endpoint.

## List sources

```bash
curl "https://image.shep.bot/v1/providers"
```

## Usage statistics and source health

```bash
curl "https://image.shep.bot/v1/stats"
```

Aggregate usage (searches by surface, image views, downloads, MCP tool calls, top clients and categories) for the last 24 hours and 7 days, plus each source's success rate and p50/p95 latency. The same data is on the [statistics](/stats) page. `GET /v1/catalog` returns the daily count of what each source holds.

## Examples

### JavaScript / TypeScript

```ts
const base = "https://image.shep.bot";
const res = await fetch(`${base}/v1/search?` + new URLSearchParams({ q: "misty forest", orientation: "landscape", min_resolution: "1080", commercial: "true" }));
const { results } = await res.json();
const pick = results.find((c) => c.downloadable && !c.license?.editorial);
console.log(pick.title, pick.license.verdict, pick.attribution ?? "no credit needed");

// Show it in the page, straight from the source, with its credit as the caption
const details = await (await fetch(`${base}/v1/images/${encodeURIComponent(pick.id)}`)).json();
const figure = document.createElement("figure");
figure.append(Object.assign(document.createElement("img"), { src: details.display.url, alt: pick.title }));
figure.append(Object.assign(document.createElement("figcaption"), { textContent: pick.attribution ?? pick.title }));
document.body.append(figure);
```

### Python

```python
import requests

base = "https://image.shep.bot"
r = requests.get(f"{base}/v1/search", params={"q": "saturn", "min_resolution": "1080", "commercial": "true"})
image = next(c for c in r.json()["results"] if c["downloadable"])

# The download endpoint redirects to the file on the source; requests follows it.
with requests.get(f"{base}/v1/images/{requests.utils.quote(image['id'], safe='')}/download", params={"width": 1920}, stream=True) as dl:
    dl.raise_for_status()
    with open("saturn.jpg", "wb") as f:
        for chunk in dl.iter_content(1 << 20):
            f.write(chunk)
print(image.get("attribution", "no credit needed"))
```

### A static-site build

```bash
# Fetch a 1600 px hero at build time; keep the credit next to it
curl -L -o public/hero.jpg "https://image.shep.bot/v1/images/<id>/download?width=1600"
curl -o public/CREDITS.md "https://image.shep.bot/v1/images/<id>/credits"
```

## Errors

Errors are JSON: `{ "error": "message" }`.

| Status | Meaning |
| --- | --- |
| `400` | Bad parameter (e.g. an unknown category or an unreadable `min_resolution`) or unknown source id. |
| `401` | API key required (self-hosted servers with `IMAGE_SERVER_API_KEY` only). |
| `404` | Unknown image, or no file matches the width/format/role. |
| `409` | The source has no direct downloads for this image; use the returned `url`. |
| `429` | Rate limit exceeded; wait `Retry-After` seconds. |
| `502` | The source site failed. |

## Authentication (self-hosted)

The public server is open. If you run your own with `IMAGE_SERVER_API_KEY`, send the key as `Authorization: Bearer <key>` or `x-api-key: <key>`. Keys are accepted in headers only, never as a URL parameter, so they stay out of logs, browser history and `Referer` headers.

## Rate limits and versioning

The public server allows 120 requests per minute per client. Every response carries `RateLimit-Policy` and `RateLimit` headers (plus `RateLimit-Limit`, `RateLimit-Remaining` and `RateLimit-Reset`); going over returns `429` with `Retry-After`. The API is versioned in the path (`/v1`), only grows additively within a version, and announces deprecations with `Deprecation` and `Sunset` headers at least 90 days ahead. Details: [Versioning, deprecation & rate limits](/docs/api/versioning).

## Fair use

Cache results on your side for repeated queries, keep requests to a human pace, and respect each image's licence and each source's terms. Don't use the API to mirror a source's catalogue. The server already caches source responses for a few minutes and deduplicates identical in-flight requests. Image Asset Server is a free, non-commercial service and does not re-host or resell images.
