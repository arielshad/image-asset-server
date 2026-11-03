import { COMMERCIAL_VERDICTS } from "../core/types.js";
import { VERDICT_LABELS } from "../core/licence.js";
import { CATEGORIES, ORIENTATIONS, TOP_CATEGORIES, IMAGE_STYLES } from "../core/vocab.js";
import { allProviders } from "../providers/index.js";

const DEFAULT_PUBLIC_URL = "https://image.shep.bot";

const NATIVE_FILTERS = ["categories", "styles", "orientation", "resolution", "transparent", "formats", "commercialOnly", "freeOnly"] as const;
const FILE_ROLES = ["original", "rendition", "thumbnail"] as const;

/** OpenAPI 3.1 description of the HTTP API (served at /openapi.json, rendered at /docs/api/reference). */
export function openApiSpec(baseUrl?: string) {
  const server = (baseUrl ?? DEFAULT_PUBLIC_URL).replace(/\/$/, "");
  const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
  const json = (schema: object, example?: unknown) => ({
    "application/json": { schema, ...(example !== undefined ? { example } : {}) },
  });
  const errorResponse = (description: string, example?: unknown) => ({ description, content: json(ref("Error"), example) });
  const verdicts = COMMERCIAL_VERDICTS.map((v) => `\`${v}\` (${VERDICT_LABELS[v].toLowerCase()})`).join(", ");

  const idParam = {
    name: "id",
    in: "path",
    required: true,
    description: "Image id `<provider>:<nativeId>` (URL-encode it: ids can contain spaces, slashes and colons).",
    schema: { type: "string" },
    example: "nasa:PIA03606",
  };
  const fileQuery = [
    { name: "width", in: "query", description: "Wanted width in pixels (e.g. 1600 for a web hero): the smallest file at least that wide, else the biggest below. An SVG original always fits.", schema: { type: "integer", minimum: 16, maximum: 20000 } },
    { name: "format", in: "query", description: "Preferred format: jpg, png, svg, webp, tif.", schema: { type: "string" } },
    { name: "role", in: "query", description: `Only files with this role: ${FILE_ROLES.join(", ")}.`, schema: { type: "string", enum: FILE_ROLES } },
  ];
  const bool = (name: string, description: string) => ({ name, in: "query", description, schema: { type: "boolean" } });

  const exampleLicense = {
    id: "LicenseRef-NASA-Media",
    name: "NASA media (public domain in the US)",
    url: "https://www.nasa.gov/nasa-brand-center/images-and-media/",
    commercialUse: true,
    attributionRequired: true,
    redistribution: true,
    editorial: true,
    assertedBy: "source",
    verdict: "yes-with-credit",
  };
  const base = "https://images-assets.nasa.gov/image/PIA03606/PIA03606";
  const exampleImage = {
    id: "nasa:PIA03606",
    provider: "nasa",
    nativeId: "PIA03606",
    title: "Crab Nebula Mosaic",
    url: "https://images.nasa.gov/details/PIA03606",
    author: "NASA/JPL",
    tags: ["crab nebula", "hubble space telescope"],
    category: "space",
    categoryEvidence: { by: "rules", confidence: 0.77 },
    styles: ["photo"],
    orientation: "landscape",
    width: 3864,
    height: 3864,
    year: 2005,
    thumbnailUrl: `${base}~small.jpg`,
    previewUrl: `${base}~medium.jpg`,
    formats: ["jpg"],
    license: exampleLicense,
    attribution: "“Crab Nebula Mosaic” by NASA/JPL (NASA Image and Video Library), https://images.nasa.gov/details/PIA03606, licensed under NASA media (public domain in the US) (https://www.nasa.gov/nasa-brand-center/images-and-media/)",
    price: { free: true },
    downloadable: true,
    score: 0.81,
  };
  const exampleFiles = [
    { url: `${base}~orig.jpg`, filename: "PIA03606~orig.jpg", format: "jpg", role: "original", width: 3864, height: 3864, sizeBytes: 1886000 },
    { url: `${base}~large.jpg`, filename: "PIA03606~large.jpg", format: "jpg", role: "rendition", width: 1920, height: 1920 },
    { url: `${base}~medium.jpg`, filename: "PIA03606~medium.jpg", format: "jpg", role: "rendition", width: 1280, height: 1280 },
    { url: `${base}~small.jpg`, filename: "PIA03606~small.jpg", format: "jpg", role: "rendition", width: 640, height: 640 },
  ];

  const spec = {
    openapi: "3.1.0",
    info: {
      title: "Image Asset Server API",
      version: "0.1.0",
      summary: "One search API for free images: photos, museum art, illustrations, maps, SVG vectors and icons, with licence verdicts.",
      description: [
        `Search ${allProviders.length} image sites at once (NASA, The Met, the Art Institute of Chicago, the Cleveland Museum of Art, the Library of Congress,`,
        "Wikimedia Commons, Iconify and Openverse, plus deep links into Unsplash, Pexels, Pixabay, Shutterstock and more), get each image's licence",
        "with a plain verdict on commercial use, and download the size you need with its credits. **No image passes through this server:**",
        "thumbnails and previews load from the sources, and downloads are redirects to the file on the source.",
        "",
        "**Typical flow:** `GET /v1/search` → `GET /v1/images/{id}` → `GET /v1/images/{id}/download?width=1920`. To pick images for a whole",
        "page, deck or post in one call, `POST /v1/sets`.",
        "",
        `**Licence verdicts:** every image's \`license.verdict\` answers "can this go into something I publish commercially?": ${verdicts}.`,
        "`license.editorial=true` means people, insignia or brands appear without releases (fine for articles and education, not for ads).",
        "`commercial=true` keeps only `yes` and `yes-with-credit`. Verdicts are a summary, not legal advice: read the licence before publishing.",
        "",
        "**Authentication:** the public server at image.shep.bot is open. Self-hosted servers can require a key",
        "(`IMAGE_SERVER_API_KEY`); send it as `Authorization: Bearer <key>` or `x-api-key: <key>`. Keys are accepted in headers",
        "only, never in the URL, so they stay out of logs, browser history and Referer headers.",
        "",
        "**For AI agents:** the same capabilities are exposed as MCP tools at `/mcp` (Streamable HTTP).",
        "See [Use with coding agents](/docs/mcp).",
        "",
        "**Rate limits:** 120 requests per minute per client on `/v1/*` and `/mcp`. Every response carries",
        "`RateLimit-Policy` and `RateLimit` (IETF RateLimit header fields) plus `RateLimit-Limit`,",
        "`RateLimit-Remaining` and `RateLimit-Reset`; a `429` adds `Retry-After` (seconds).",
        "",
        "**Versioning:** the major version is in the path (`/v1`). Breaking changes only ship in a new major",
        "version; deprecated endpoints announce themselves with `Deprecation` and `Sunset` headers at least",
        "90 days ahead. See [Versioning & deprecation](/docs/api/versioning).",
      ].join("\n"),
      contact: { name: "Image Asset Server", url: "https://github.com/arielshad/image-asset-server" },
      license: { name: "Apache-2.0", identifier: "Apache-2.0" },
    },
    externalDocs: { description: "Guides: quick start, MCP setup, API usage", url: `${server}/docs` },
    "x-api-lifecycle": { versioning: "path (/v1)", deprecationPolicy: `${server}/docs/api/versioning`, minimumSunsetNoticeDays: 90 },
    servers: [{ url: server, description: "This server" }],
    tags: [
      { name: "Search", description: "Find images across every source in one call." },
      { name: "Images", description: "Details, sizes, downloads and credits for one image." },
      { name: "Sets", description: "Pick one image per slot for a page, deck or post in one call." },
      { name: "Sources", description: "The image sites this server searches, what they hold, and how the server is used." },
      { name: "MCP", description: "Model Context Protocol endpoint for AI agents." },
      { name: "System", description: "Health and machine-readable descriptions." },
    ],
    security: [{}, { bearer: [] }, { apiKey: [] }],
    components: {
      securitySchemes: {
        bearer: { type: "http", scheme: "bearer", description: "Only when the server sets IMAGE_SERVER_API_KEY." },
        apiKey: { type: "apiKey", in: "header", name: "x-api-key", description: "Same key, as a header. Query parameters are not accepted." },
      },
      headers: {
        RateLimit: { description: 'Current quota, e.g. `"default";r=117;t=42` (r = requests remaining, t = seconds until reset).', schema: { type: "string" } },
        "RateLimit-Policy": { description: 'Quota policy, e.g. `"default";q=120;w=60` (q = requests per window, w = window seconds).', schema: { type: "string" } },
        "RateLimit-Limit": { description: "Requests allowed per window.", schema: { type: "integer" } },
        "RateLimit-Remaining": { description: "Requests left in the current window.", schema: { type: "integer" } },
        "RateLimit-Reset": { description: "Seconds until the window resets.", schema: { type: "integer" } },
        "Retry-After": { description: "Seconds to wait before retrying (on 429).", schema: { type: "integer" } },
        "X-License": { description: "The image's licence id and verdict, e.g. `CC-BY-4.0; verdict=yes-with-credit; editorial`.", schema: { type: "string" } },
        "X-Attribution": { description: "The credit line to publish with the image (ASCII), when the licence asks for one.", schema: { type: "string" } },
      },
      responses: {
        TooManyRequests: {
          description: "Rate limit exceeded. Wait `Retry-After` seconds.",
          headers: {
            "Retry-After": { $ref: "#/components/headers/Retry-After" },
            RateLimit: { $ref: "#/components/headers/RateLimit" },
            "RateLimit-Policy": { $ref: "#/components/headers/RateLimit-Policy" },
          },
          content: json(ref("Error"), { error: "Rate limit exceeded: 120 requests per 60s. Retry after 12s.", retryAfter: 12 }),
        },
      },
      schemas: {
        Category: { type: "string", enum: CATEGORIES, description: "Dot-path category; a parent (`nature`) matches its children (`nature.ocean`)." },
        ImageStyle: { type: "string", enum: IMAGE_STYLES },
        Orientation: { type: "string", enum: ORIENTATIONS },
        CommercialVerdict: { type: "string", enum: COMMERCIAL_VERDICTS, description: `Can this go into something published commercially? ${verdicts}.` },
        NativeFilter: { type: "string", enum: NATIVE_FILTERS },
        License: {
          type: "object",
          required: ["id", "name", "assertedBy", "verdict"],
          properties: {
            id: { type: "string", description: "SPDX id where one exists (CC0-1.0, CC-BY-4.0…), else LicenseRef-*." },
            name: { type: "string" },
            url: { type: "string", format: "uri" },
            commercialUse: { type: "boolean" },
            attributionRequired: { type: "boolean" },
            shareAlike: { type: "boolean" },
            redistribution: { type: "boolean", description: "May the image itself be re-uploaded or passed on?" },
            editorial: { type: "boolean", description: "People, insignia or brands without releases: fine for articles and education, not for ads." },
            assertedBy: { type: "string", enum: ["source", "site", "uploader"], description: "`uploader` = an unverified claim (verdict capped at check-terms)." },
            verdict: ref("CommercialVerdict"),
            note: { type: "string" },
          },
          example: exampleLicense,
        },
        Price: { type: "object", required: ["free"], properties: { free: { type: "boolean" }, amount: { type: "number" }, currency: { type: "string" } } },
        ImageAsset: {
          type: "object",
          required: ["id", "provider", "nativeId", "title", "url", "tags", "category", "downloadable"],
          properties: {
            id: { type: "string", description: "`<provider>:<nativeId>`" },
            provider: { type: "string" },
            nativeId: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            url: { type: "string", format: "uri", description: "The image's page on the source site." },
            author: { type: "string" },
            authorUrl: { type: "string", format: "uri" },
            tags: { type: "array", items: { type: "string" } },
            category: ref("Category"),
            categoryEvidence: { type: "object", properties: { by: { type: "string", enum: ["source", "rules"] }, confidence: { type: "number" } } },
            styles: { type: "array", items: ref("ImageStyle") },
            orientation: ref("Orientation"),
            width: { type: "integer", description: "Pixel width of the largest version (vectors: their view box)." },
            height: { type: "integer" },
            vector: { type: "boolean", description: "Scalable vector art (SVG): any size." },
            transparent: { type: "boolean", description: "Has a transparent background (icons, SVGs, PNG cut-outs)." },
            year: { type: "integer", description: "Year the work was made (art and archive images)." },
            thumbnailUrl: { type: "string", format: "uri", description: "Small version (≈200–640 px) for grids, on the source." },
            previewUrl: { type: "string", format: "uri", description: "Display-size version (≈800–1600 px), on the source." },
            formats: { type: "array", items: { type: "string" } },
            license: ref("License"),
            attribution: { type: "string", description: "Ready-to-paste credit line when the licence asks for one." },
            price: ref("Price"),
            requiresAccount: { type: "boolean" },
            downloadable: { type: "boolean" },
            createdAt: { type: "string", format: "date-time" },
            popularity: { type: "number" },
            sameAs: { type: "array", items: { type: "string" } },
            score: { type: "number" },
          },
          example: exampleImage,
        },
        ImageFile: {
          type: "object",
          required: ["url", "filename", "format", "role"],
          properties: {
            url: { type: "string", format: "uri" },
            filename: { type: "string" },
            format: { type: "string", description: "jpg, png, webp, svg, gif, tif…" },
            mime: { type: "string" },
            role: { type: "string", enum: FILE_ROLES, description: "`original` the full-quality file; `rendition` a resized copy; `thumbnail` a small copy for browsing." },
            width: { type: "integer" },
            height: { type: "integer" },
            sizeBytes: { type: "integer" },
            requiresAuth: { type: "boolean" },
          },
        },
        ImageDetails: {
          allOf: [
            ref("ImageAsset"),
            {
              type: "object",
              properties: {
                files: { type: "array", items: ref("ImageFile") },
                display: {
                  type: "object",
                  description: "What a browser should show in a detail view (straight from the source): a displayable format near 1280 px wide.",
                  properties: { url: { type: "string", format: "uri" }, type: { type: "string" }, width: { type: "integer" }, height: { type: "integer" } },
                },
                shareUrl: { type: "string", format: "uri" },
              },
            },
          ],
          example: { ...exampleImage, files: exampleFiles, display: { url: exampleFiles[2]!.url, type: "image/jpeg", width: 1280, height: 1280 } },
        },
        ImageFilters: {
          type: "object",
          properties: {
            categories: { type: "array", items: ref("Category") },
            styles: { type: "array", items: ref("ImageStyle") },
            orientations: { type: "array", items: ref("Orientation") },
            minResolution: { type: "integer", description: "Short side in pixels. Vectors always pass." },
            transparent: { type: "boolean" },
            formats: { type: "array", items: { type: "string" } },
            commercialOnly: { type: "boolean" },
            freeOnly: { type: "boolean" },
          },
        },
        ProviderSearchReport: {
          type: "object",
          required: ["provider", "name", "status", "count", "tookMs"],
          properties: {
            provider: { type: "string" },
            name: { type: "string" },
            status: { type: "string", enum: ["ok", "error", "timeout", "skipped", "link"], description: "`link` = the source can only be searched on its own site: open `searchUrl`." },
            count: { type: "integer" },
            total: { type: "integer" },
            searchUrl: { type: "string", format: "uri" },
            error: { type: "string" },
            filteredLocally: { type: "array", items: ref("NativeFilter") },
            tookMs: { type: "integer" },
          },
        },
        SearchResponse: {
          type: "object",
          required: ["query", "filters", "results", "providers"],
          properties: {
            query: { type: "string", description: "The words searched after the filters were parsed out." },
            filters: ref("ImageFilters"),
            results: { type: "array", items: ref("ImageAsset") },
            providers: { type: "array", items: ref("ProviderSearchReport") },
          },
        },
        Provider: {
          type: "object",
          required: ["id", "name", "homepage", "description", "categories", "access", "pricing", "supportsDownload"],
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            homepage: { type: "string", format: "uri" },
            description: { type: "string" },
            categories: { type: "array", items: ref("Category"), description: "Top-level categories the source carries." },
            access: {
              type: "string",
              enum: ["api", "static", "scrape", "link"],
              description: "`api` official API; `static` a curated manifest filtered locally; `scrape` public pages; `link` deep links only (paid/partner API, no key yet, or terms that forbid aggregation).",
            },
            pricing: { type: "string", enum: ["free", "freemium", "paid"] },
            license: ref("License"),
            apiKeyEnv: { type: "string", description: "Environment variable holding the source's API key on a self-hosted server." },
            supportsDownload: { type: "boolean" },
            nativeFilters: { type: "array", items: ref("NativeFilter"), description: "Filters the source applies itself; the rest are applied locally." },
            enabled: { type: "boolean" },
          },
        },
        FileSelection: {
          type: "object",
          required: ["id", "files"],
          properties: {
            id: { type: "string" },
            license: ref("License"),
            attribution: { type: "string" },
            totalBytes: { type: "integer" },
            files: { type: "array", items: ref("ImageFile") },
          },
        },
        SetRequest: {
          type: "object",
          required: ["slots"],
          properties: {
            slots: {
              oneOf: [
                { type: "array", items: { type: "string" }, maxItems: 24 },
                { type: "string", description: "One slot per line; `(1200px)` at the end sets a slot's width; `3 icons: a, b, c` makes one slot per item." },
              ],
            },
            width: { type: "integer", default: 1600, description: "Default width in pixels for slots without their own." },
            orientation: ref("Orientation"),
            styles: { type: "array", items: ref("ImageStyle"), description: "Default kind for slots that don't say, e.g. `[\"photo\"]`." },
            commercialOnly: { type: "boolean", default: true },
            providers: { type: "array", items: { type: "string" } },
            alternatives: { type: "integer", minimum: 0, maximum: 5, default: 3 },
            name: { type: "string" },
          },
          example: { slots: ["hero: city skyline at dusk, landscape (1920px)", "3 icons: rocket, shield, chart", "portrait of a baker at work"], styles: ["photo"] },
        },
        ImageSlot: {
          type: "object",
          required: ["index", "description", "width", "alternatives"],
          properties: {
            index: { type: "integer" },
            description: { type: "string" },
            width: { type: "integer", description: "The slot's target width in pixels." },
            image: ref("ImageAsset"),
            file: ref("ImageFile"),
            alt: { type: "string", description: "Suggested alt text." },
            alternatives: { type: "array", items: ref("ImageAsset") },
            note: { type: "string", description: "Why nothing (or something imperfect) was picked: upscaling, cropping, editorial use." },
          },
        },
        SetResponse: {
          type: "object",
          required: ["plan", "exports"],
          properties: {
            plan: {
              type: "object",
              properties: {
                commercialSafe: { type: "boolean" },
                slots: { type: "array", items: ref("ImageSlot") },
              },
            },
            exports: {
              type: "object",
              description: "File contents, ready to save: the picks as JSON, <figure> snippets with credit captions, a curl script and the credits. File URLs point at the sources.",
              properties: {
                "images.json": { type: "string" },
                "credits.html": { type: "string" },
                "download.sh": { type: "string" },
                "ATTRIBUTION.md": { type: "string" },
                "credits.json": { type: "string" },
              },
            },
          },
        },
        CountWithBound: {
          type: "object",
          required: ["count"],
          properties: { count: { type: "integer" }, atLeast: { type: "boolean", description: "The count is a lower bound." } },
        },
        SourceCensus: {
          type: "object",
          required: ["id", "name", "homepage", "total", "byCategory", "method", "countedAt"],
          properties: {
            id: { type: "string", example: "nasa" },
            name: { type: "string", example: "NASA Image and Video Library" },
            homepage: { type: "string", format: "uri" },
            license: { type: "string", description: "The source's single licence id, when uniform." },
            pricing: { type: "string", enum: ["free", "freemium", "paid"] },
            supportsDownload: { type: "boolean" },
            total: { type: "integer", description: "Listings on the source (free and paid)." },
            atLeast: { type: "boolean" },
            free: { type: "integer" },
            byCategory: {
              type: "object",
              description: "Listings per top-level category; each listing counts once.",
              additionalProperties: { type: "integer" },
              example: { space: 120000, science: 18000, people: 9000 },
            },
            byLicense: { type: "object", additionalProperties: { type: "integer" } },
            categories: { type: "object", additionalProperties: { type: "integer" }, description: "The source's own categories or tags (may overlap)." },
            addedLast30Days: { type: "integer" },
            downloads: { type: "integer", description: "Total downloads, when the source publishes them." },
            highlights: {
              type: "array",
              items: {
                type: "object",
                required: ["label", "title", "url"],
                properties: { label: { type: "string" }, title: { type: "string" }, url: { type: "string", format: "uri" }, value: { type: "integer" } },
              },
            },
            method: { type: "string", description: "How the source was counted." },
            countedAt: { type: "string", format: "date-time" },
            stale: { type: "object", properties: { since: { type: "string", format: "date-time" }, error: { type: "string" } } },
          },
        },
        Catalog: {
          type: "object",
          required: ["countedAt", "totals", "byCategory", "byLicense", "sources"],
          properties: {
            countedAt: { type: "string", format: "date-time" },
            totals: {
              type: "object",
              properties: {
                listings: ref("CountWithBound"),
                free: ref("CountWithBound"),
                cc0: ref("CountWithBound"),
                directDownload: ref("CountWithBound"),
                addedLast30Days: { type: "integer" },
                sourcesCounted: { type: "integer" },
                sourcesLinked: { type: "integer" },
              },
            },
            byCategory: { type: "object", additionalProperties: ref("CountWithBound"), description: "Listings per top-level category across sources." },
            byLicense: { type: "object", additionalProperties: { type: "integer" } },
            sources: { type: "array", items: ref("SourceCensus") },
            linked: { type: "array", items: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, homepage: { type: "string" } } } },
          },
        },
        UsageWindow: {
          type: "object",
          required: ["key", "label", "searches", "searchesWithResults", "bySurface", "imageViews", "downloads", "toolCalls", "pageViews"],
          properties: {
            key: { type: "string", description: "`24h`, `7d`, or `process` (since the last restart).", example: "24h" },
            label: { type: "string", example: "Last 24 hours" },
            searches: { type: "integer" },
            searchesWithResults: { type: "integer" },
            bySurface: {
              type: "object",
              required: ["web", "api", "mcp"],
              properties: { web: { type: "integer" }, api: { type: "integer" }, mcp: { type: "integer" } },
            },
            imageViews: { type: "integer" },
            downloads: { type: "integer" },
            toolCalls: { type: "integer", description: "MCP tool calls." },
            pageViews: { type: "integer", description: "Website pages served." },
          },
        },
        Ranked: { type: "object", required: ["name", "count"], properties: { name: { type: "string" }, count: { type: "integer" } } },
        ProviderHealth: {
          type: "object",
          required: ["provider", "requests", "ok", "errors", "timeouts", "okRate", "p50Ms", "p95Ms"],
          properties: {
            provider: { type: "string", example: "nasa" },
            requests: { type: "integer", description: "Searches that reached the source." },
            ok: { type: "integer" },
            errors: { type: "integer" },
            timeouts: { type: "integer" },
            okRate: { type: ["number", "null"], minimum: 0, maximum: 1 },
            p50Ms: { type: ["integer", "null"] },
            p95Ms: { type: ["integer", "null"] },
          },
        },
        Stats: {
          type: "object",
          required: ["generatedAt", "source", "windows", "breakdownLabel", "clients", "tools", "assetTypes", "providers", "catalog"],
          properties: {
            generatedAt: { type: "string", format: "date-time" },
            source: { type: "string", enum: ["prometheus", "process"] },
            since: { type: "string", format: "date-time", description: "Start of counting for `source: process`." },
            windows: { type: "array", items: ref("UsageWindow") },
            breakdownLabel: { type: "string", description: "Period covered by `clients`, `tools` and `assetTypes`.", example: "Last 7 days" },
            clients: { type: "array", items: ref("Ranked"), description: "Searches by client family (claude-code, cursor, browser, curl…)." },
            tools: { type: "array", items: ref("Ranked"), description: "MCP tool calls by tool." },
            assetTypes: { type: "array", items: ref("Ranked"), description: "Searches by category filter (`any` = no filter)." },
            providers: { type: "array", items: ref("ProviderHealth"), description: "Per-source health over the last 24 hours." },
            catalog: {
              type: "object",
              required: ["sources", "directDownload", "byAccess", "byPricing"],
              properties: {
                sources: { type: "integer" },
                directDownload: { type: "integer" },
                byAccess: { type: "object", additionalProperties: { type: "integer" } },
                byPricing: { type: "object", additionalProperties: { type: "integer" } },
              },
            },
          },
        },
        Error: {
          type: "object",
          required: ["error"],
          properties: {
            error: { type: "string" },
            url: { type: "string", format: "uri", description: "The image's page on the source, when the file must be fetched there." },
            requiresAccount: { type: "boolean" },
            retryAfter: { type: "integer" },
          },
        },
      },
    },
    paths: {
      "/v1/search": {
        get: {
          operationId: "searchImages",
          tags: ["Search"],
          summary: "Search every source",
          description:
            "Fans out to every enabled source in parallel (each with its own timeout), then merges and ranks. Words like " +
            "`4k`, `high resolution`, `vertical`, `16:9`, `png`, `svg`, `transparent` in `q` become filters (see `filters` in the response); " +
            "explicit parameters win. Unknown orientation, size or transparency stay in the list, " +
            "ranked below known matches, unless `strict=true`. A slow or failing source never fails the search: it shows up in `providers` with its status.",
          parameters: [
            { name: "q", in: "query", description: "Short query, written like a designer would.", schema: { type: "string", maxLength: 300 }, examples: { lake: { value: "mountain lake at sunrise" }, art: { value: "van gogh sunflowers" }, icon: { value: "rocket icon svg" } } },
            {
              name: "category",
              in: "query",
              description: `Comma-separated categories; a parent includes its children. Top level: ${TOP_CATEGORIES.join(", ")}; children like \`nature.ocean\`, \`art.painting\`, \`space.planets\`, \`archive.map\`.`,
              schema: { type: "string" },
              example: "nature.ocean",
            },
            { name: "style", in: "query", description: `Comma-separated kinds and looks: ${IMAGE_STYLES.join(", ")}. \`vector\` and \`icon\` filter strictly; the others rank first (filtered only with strict=true).`, schema: { type: "string" }, example: "painting" },
            { name: "orientation", in: "query", description: `Comma-separated: ${ORIENTATIONS.join(", ")}.`, schema: { type: "string" }, example: "portrait" },
            { name: "min_resolution", in: "query", description: "Short side at least: 720, 1080, 1440, 2160, or hd / fhd / large / 4k. Vectors always pass.", schema: { type: "string" }, example: "1080" },
            bool("transparent", "Only images with a transparent background."),
            { name: "format", in: "query", description: "Comma-separated formats: jpg, png, svg, webp, tif.", schema: { type: "string" }, example: "svg" },
            bool("commercial", "Only images whose licence verdict is `yes` or `yes-with-credit`."),
            bool("free", "Only free images."),
            bool("downloadable", "Only images with direct file links."),
            bool("strict", "Drop images whose orientation, size or transparency is unknown when that filter is set."),
            { name: "providers", in: "query", description: "Comma-separated source ids (see /v1/providers).", schema: { type: "string" }, example: "nasa,wikimediacommons" },
            { name: "limit", in: "query", description: "Max results (default 24).", schema: { type: "integer", minimum: 1, maximum: 100 } },
            { name: "offset", in: "query", description: "Per-source offset for paging (e.g. 24 for page 2).", schema: { type: "integer", minimum: 0, maximum: 1000 } },
          ],
          responses: {
            200: { description: "Ranked results, the filters in force and a per-source report.", content: json(ref("SearchResponse")) },
            400: errorResponse("Invalid parameters or unknown source id.", { error: '✖ min_resolution must be 720, 1080, 1440, 2160 or hd/fhd/large/4k, got "huge"' }),
            401: errorResponse("API key required (self-hosted servers only)."),
          },
        },
      },
      "/v1/images/{id}": {
        get: {
          operationId: "getImage",
          tags: ["Images"],
          summary: "Image details, files and display URL",
          description: "Full metadata, the licence with its verdict and credit line, every file (original, resized copies, thumbnail) and the file a browser should show.",
          parameters: [idParam],
          responses: {
            200: { description: "The image and its files.", content: json(ref("ImageDetails")) },
            400: errorResponse("Malformed id or unknown source."),
            404: errorResponse("Unknown image."),
            501: errorResponse("The source has no detail pages here; open `url` on the source site."),
            502: errorResponse("The source site failed."),
          },
        },
      },
      "/v1/images/{id}/files": {
        get: {
          operationId: "selectFiles",
          tags: ["Images"],
          summary: "Pick the right file",
          description: "The best file for a width and format (the original by default), or every file with `all=true`, with sizes and the licence.",
          parameters: [idParam, ...fileQuery, bool("all", "Every file, including thumbnails.")],
          responses: {
            200: { description: "Selected files and total size.", content: json(ref("FileSelection")) },
            404: errorResponse("Unknown image."),
          },
        },
      },
      "/v1/images/{id}/download": {
        get: {
          operationId: "downloadImage",
          tags: ["Images"],
          summary: "Download (redirect to the source)",
          description:
            "Answers 302 to the chosen file on the source: the image never passes through this server. `width` picks a resized copy " +
            "(the smallest at least that wide), `format` a format. The licence and credit line come back as `X-License` and `X-Attribution` headers; " +
            "get the credits as files from `/v1/images/{id}/credits`.",
          parameters: [idParam, ...fileQuery],
          responses: {
            302: {
              description: "Redirect to the file.",
              headers: { Location: { schema: { type: "string", format: "uri" } }, "X-License": { $ref: "#/components/headers/X-License" }, "X-Attribution": { $ref: "#/components/headers/X-Attribution" } },
            },
            404: errorResponse("Unknown image, or no file matches."),
            409: errorResponse("No direct download: get it from the source page.", { error: "This image has no direct download here; get it from the source page.", url: "https://…", requiresAccount: false }),
          },
        },
      },
      "/v1/images/{id}/credits": {
        get: {
          operationId: "imageCredits",
          tags: ["Images"],
          summary: "Credits for an image",
          description: "ATTRIBUTION.md (default), credits.json, or a zip holding both. No image inside.",
          parameters: [idParam, { name: "format", in: "query", schema: { type: "string", enum: ["md", "json", "zip"], default: "md" } }],
          responses: {
            200: {
              description: "The credits.",
              content: { "text/markdown": { schema: { type: "string" } }, "application/json": { schema: { type: "object" } }, "application/zip": { schema: { type: "string", format: "binary" } } },
            },
            404: errorResponse("Unknown image."),
          },
        },
      },
      "/v1/sets": {
        post: {
          operationId: "planImageSet",
          tags: ["Sets"],
          summary: "Pick images for a page, deck or post",
          description:
            "One image per slot, matching the slot's orientation and kind, at least half the slot's width where possible, commercial-safe by default " +
            "and directly downloadable; alternatives per slot. Returns the plan and the files to save: images.json (src, size, alt text, licence and " +
            "credit per pick), credits.html (<figure> snippets with credit captions), download.sh and the credits.",
          requestBody: { required: true, content: json(ref("SetRequest")) },
          responses: {
            200: { description: "The plan and its exports.", content: json(ref("SetResponse")) },
            400: errorResponse("Invalid body."),
          },
        },
      },
      "/v1/providers": {
        get: {
          operationId: "listProviders",
          tags: ["Sources"],
          summary: "List sources",
          description: "Every image site with the categories it carries, pricing, licence, the filters it applies itself and whether files can be downloaded directly.",
          responses: {
            200: {
              description: "Sources.",
              content: json({ type: "object", required: ["providers"], properties: { providers: { type: "array", items: ref("Provider") } } }),
            },
          },
        },
      },
      "/v1/catalog": {
        get: {
          operationId: "getCatalog",
          tags: ["Sources"],
          summary: "Catalog census",
          description:
            "How many images every source holds, counted once a day: listings per source, by top-level category, licence and the " +
            "source's own categories, free counts, listings added in the last 30 days, and highlights such as the most downloaded " +
            "image. `atLeast: true` marks lower bounds (sources that cap their counts). Sources whose count failed today keep their " +
            "last good numbers with `stale`. The same file is at `/catalog.json`; one point per day is in `/catalog-history.json`.",
          responses: {
            200: { description: "Catalog census.", content: json(ref("Catalog")) },
            404: errorResponse("The census has not been built on this server."),
          },
        },
      },
      "/v1/stats": {
        get: {
          operationId: "getStats",
          tags: ["Sources"],
          summary: "Usage statistics",
          description:
            "Aggregate usage of this server: searches by surface (web, API, MCP), downloads, MCP tool calls, the client families " +
            "and categories searched most, and per-source health (success rate, p50/p95 latency). Counts come from Prometheus " +
            "(`source: prometheus`, last 24 hours and 7 days) or, when it is unavailable, from this process since it started " +
            "(`source: process`). No queries, IPs or user agents are exposed. Cached for 60 seconds.",
          responses: {
            200: { description: "Usage statistics.", content: json(ref("Stats")) },
          },
        },
      },
      "/mcp": {
        post: {
          operationId: "mcp",
          tags: ["MCP"],
          summary: "MCP endpoint (Streamable HTTP)",
          description:
            "Stateless Model Context Protocol endpoint for AI agents. Tools: `search_images`, `get_image`, `build_image_set`, " +
            "`list_sources` (and `download_image` on local installs, which saves files with their credits). " +
            "Point any MCP client at this URL; see /docs/mcp for per-client setup.",
          requestBody: {
            required: true,
            content: json(
              { type: "object", description: "JSON-RPC 2.0 request" },
              { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "search_images", arguments: { query: "mountain lake at sunrise", orientation: "landscape", min_resolution: 1080, commercial_only: true } } },
            ),
          },
          responses: { 200: { description: "JSON-RPC 2.0 response.", content: json({ type: "object" }) } },
        },
      },
      "/health": {
        get: {
          operationId: "health",
          tags: ["System"],
          summary: "Health check",
          security: [{}],
          responses: { 200: { description: "OK", content: json({ type: "object", properties: { ok: { type: "boolean" } } }, { ok: true }) } },
        },
      },
      "/openapi.json": {
        get: {
          operationId: "openapi",
          tags: ["System"],
          summary: "This OpenAPI document",
          security: [{}],
          responses: { 200: { description: "OpenAPI 3.1", content: json({ type: "object" }) } },
        },
      },
    },
  };

  // Every rate-limited operation documents its headers and the 429 response.
  const limited = { 429: { $ref: "#/components/responses/TooManyRequests" } };
  const rateHeaders = Object.fromEntries(
    ["RateLimit", "RateLimit-Policy", "RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Reset"].map((h) => [h, { $ref: `#/components/headers/${h}` }]),
  );
  for (const [path, item] of Object.entries(spec.paths)) {
    if (!path.startsWith("/v1/") && path !== "/mcp") continue;
    for (const op of Object.values(item) as { responses: Record<string, Record<string, unknown>> }[]) {
      for (const res of Object.values(op.responses)) if (!("$ref" in res)) res.headers = { ...(res.headers as object), ...rateHeaders };
      Object.assign(op.responses, limited);
    }
  }
  return spec;
}
