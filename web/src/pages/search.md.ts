// Markdown twin of /search: how to search, as URLs and API calls.
import type { APIRoute } from "astro";
import { SEARCHED, SITE, SOURCE_COUNT } from "@/lib/site";
import { CATEGORY_DEFS, STYLES } from "@/lib/vocab";

export const GET: APIRoute = () =>
  new Response(
    [
      "# Search free images",
      "",
      `> One search across ${SOURCE_COUNT} image sites (${SEARCHED.map((p) => p.name).join(", ")}, plus deep links into Unsplash, Pexels, Pixabay and paid stock libraries) for photos, public-domain art, maps, illustrations, SVG vectors and icons, with a thumbnail, a display-size preview, pixel size, orientation and a licence verdict on every result.`,
      "",
      `The search page (${SITE.url}/search) is an interactive app. Every search is a URL, and the same parameters work on the JSON API:`,
      "",
      `- Web: ${SITE.url}/search?q=mountain+lake&orientation=landscape&min_resolution=1080&commercial=true`,
      `- API: \`curl "${SITE.url}/v1/search?q=mountain+lake&orientation=landscape&min_resolution=1080&commercial=true"\``,
      "",
      "No image passes through the server: thumbnails, previews and downloads load straight from the source sites.",
      "",
      "## Parameters",
      "",
      "| Parameter | Meaning |",
      "| --- | --- |",
      "| `q` | Free text describing the picture: `mountain lake at sunrise`, `van gogh sunflowers`, `rocket icon svg`. Size (`4k`, `high resolution`), orientation (`vertical`, `16:9`), format (`svg`, `png`) and transparency (`transparent`) words become filters. |",
      "| `category` | Comma-separated categories (below). A parent matches its children. |",
      `| \`style\` | ${STYLES.map((s) => `\`${s.id}\``).join(", ")}. \`vector\` and \`icon\` filter strictly; the others rank first (filtered only with \`strict=true\`). |`,
      "| `orientation` | `landscape`, `portrait` (vertical) or `square`. |",
      "| `min_resolution` | Short side in pixels: `720`, `1080`, `1440`, `2160` (or `hd`, `fhd`, `large`, `4k`). A 2160×3840 phone wallpaper counts as 2160. Vectors always pass. |",
      "| `transparent` | `true`: only images with a transparent background. |",
      "| `format` | `jpg`, `png`, `svg`, `webp`, `tif` (comma-separated). |",
      "| `commercial` | `true`: only images cleared for commercial use (verdict `yes` or `yes-with-credit`). Editorial-only images can still appear: check `license.editorial`. |",
      "| `free` | `true`: no paid images. |",
      "| `downloadable` | `true`: only images with direct file links. |",
      "| `strict` | `true`: drop images whose orientation, size or transparency is unknown when you filter on them. |",
      "| `providers` | Source ids, e.g. `nasa,met,wikimediacommons`. |",
      "| `image` | Opens one image full size with its files and credit line, e.g. `image=nasa:PIA03606` (web only). |",
      "",
      "## Categories",
      "",
      ...CATEGORY_DEFS.map((c) => `- \`${c.id}\`: ${c.label}`),
      "",
      `Full API: ${SITE.url}/docs/api.md · OpenAPI: ${SITE.url}/openapi.json · Agent guide: ${SITE.url}/AGENTS.md`,
      "",
      "---",
      `Source: ${SITE.url}/search`,
      "",
    ].join("\n"),
    { headers: { "content-type": "text/markdown; charset=utf-8" } },
  );
