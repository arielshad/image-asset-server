# Writing a provider

A provider adapts one image website to the shared model in `src/core/types.ts`.

## Contract

```ts
import type { Provider } from "../core/types.js";
import { makeImage, paginate, filterLocal, wantsCategory, qs, cleanText, absoluteUrl, formatFromFilename } from "../core/util.js";
import { asEditorial, creativeCommons, customLicense, license, parseLicense, royaltyFree } from "../core/licence.js";

export const myprovider: Provider = {
  id: "myprovider",            // lowercase, no spaces; used in image ids `myprovider:<nativeId>`
  name: "My Provider",
  homepage: "https://…",
  description: "One line: what the site is best for.",
  categories: ["nature", "city"], // top-level categories it carries (src/core/vocab.ts)
  access: "api" | "static" | "scrape" | "link",
  pricing: "free" | "freemium" | "paid",
  license: royaltyFree("Mixkit licence", { url }), // when uniform across the site
  supportsDownload: true,      // only if getImage returns direct, unauthenticated file URLs
  nativeFilters: ["orientation", "resolution"], // filters the source applies itself
  apiKeyEnv: "MYPROVIDER_API_KEY", // optional
  isEnabled() {...},           // optional, e.g. requires a key
  buildSearchUrl(q) {...},     // deep link to the same search on the website
  async search(q, ctx) {...},  // -> { images, total?, searchUrl? }
  async getImage(nativeId, ctx) {...}, // -> ImageDetails (image + files[]) | null
  async census(ctx) {...},     // optional: count the catalogue (daily job)
};
```

## Rules

- **No image passes through the server.** Providers return URLs; the browser shows `thumbnailUrl`,
  `previewUrl` (or the `display` file the API picks) straight from the source, and `/download`
  redirects there. Only
  pick sources whose files can be loaded from another origin (no hotlink protection), or make them
  link-only.
- **All HTTP goes through `ctx.fetch`** (`json`, `text`, `raw`). It sets a User-Agent, timeout and an
  in-memory cache. Pass `signal: ctx.signal`. APIs that report errors with HTTP 200 (Wikimedia's
  "too busy") need `cacheIf` so an error body is never cached.
- **Respect the query.** `q.query` is free text with size, orientation, format and transparency words
  already removed. `q.categories`, `q.styles`, `q.orientations`, `q.minResolution` (short side in
  pixels), `q.transparent`, `q.formats`, `q.commercialOnly`, `q.freeOnly` are filters: map
  the ones the source supports to its own parameters and list them in `nativeFilters`. The aggregator
  applies every filter again locally, so a source that can't filter still works. `q.hints` are
  categories suggested by the query words: use them to pick a native category, never to drop results.
  Return `{ images: [] }` quickly when `wantsCategory(q, ...)` says the source has nothing relevant.
  Respect `q.limit` and `q.offset`.
- **Build images with `makeImage(...)`.** It adds the id, lowercases tags, classifies category and styles
  from title/tags/`sourceCategories` when you don't set them, reads a pixel size from the title
  ("3840x2160"), works out orientation from width × height, adds `vector` / `transparent` to the
  styles, and writes the credit line. Set `category` yourself only when the source states it reliably
  (museums: see `museumCategory` in `src/providers/museum.ts`), and `styles` when the source knows the
  kind (photo, painting, drawing, icon). Fill `width`, `height`, `vector`, `transparent`, `year`,
  `thumbnailUrl` (≈200–400 px) and `previewUrl` (≈800–1600 px) whenever the search response has
  them; unknown is better than a guess.
- **Licence on every image.** Use `parseLicense(urlOrName)`, `creativeCommons(...)`, `license(id)`,
  `royaltyFree(...)` or `customLicense(...)`. Use `assertedBy: "uploader"` when an anonymous uploader
  states it (Flickr through Openverse); it caps the verdict at `check-terms`. Wrap with
  `asEditorial(l, why)` when the image shows insignia, brands or recognisable people. Never invent
  a licence: when the source states none, use `license("LicenseRef-Unknown")`.
- `nativeId` must be something `getImage` can resolve on its own (slug / API id / path), URL-safe-ish.
- `downloadable: true` only if `getImage` returns direct file URLs fetchable with a plain GET. Files that
  need headers (a Referer) can be downloaded locally but not redirected to, so `/download` answers 409
  for them.
- `ImageFile.role`: `original` (the master as published), `rendition` (a resized copy: Wikimedia
  thumbnails, IIIF sizes, NASA's `~large`), `thumbnail`. Give every file its `width`, `height` and
  `format` when known: the file picker chooses by width. Mark files that need a login or token with `requiresAuth: true`.
- Never throw for "no results"; throw for network/parse failures (the aggregator records the error per
  provider and continues with the others).
- Parse HTML with `cheerio` (`import * as cheerio from "cheerio"`). Prefer stable hooks (JSON-LD,
  `__NEXT_DATA__`, WordPress REST `/wp-json/wp/v2/...`, sitemaps, data attributes) over CSS classes.
- **Be polite and lawful.** At most a couple of requests per search. Detail fetches inside `search` are
  allowed only when the search response has no media at all, capped and cached (the Met's search
  returns only ids, so its provider fetches each object, six at a time, cached for a day). After a
  429, stop asking until the quota resets (see `guarded` in `src/providers/openverse.ts`). Honour robots.txt and terms of service: a site whose terms forbid scraping or
  aggregation is a link-only provider (`linkProvider` in `src/providers/link.ts`), even if scraping would
  work. Never mirror or re-host images.

## Tests

Each provider gets `test/providers/<id>.test.ts` that runs **offline** against fixtures saved under
`test/fixtures/<id>/` (trim fixtures to a few KB–~100KB; never save image files). Use `fixtureCtx` /
`fixtureHttp` from `test/helpers.ts` to map URLs to fixture files, and assert the request count so a
provider never fans out. Cover: search mapping (category, frame size, orientation, duration, licence
verdict and editorial flag, poster/preview, downloadable), filters passed natively, `getImage` files and
roles, `buildSearchUrl`, and the empty/no-results path. Add a live smoke test to
`test/live/<id>.live.test.ts` (only runs with `LIVE=1`).

Register the provider in `src/providers/index.ts` and `integrations/registry.json`.
