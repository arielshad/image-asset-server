// Markdown twin of /build (the builder is an interactive island; this says what it does and how to call it).
import type { APIRoute } from "astro";
import { MCP_NAME, MCP_URL, SITE } from "@/lib/site";

export const GET: APIRoute = () =>
  new Response(
    [
      "# Image set builder",
      "",
      "> List the images a page, deck or post needs and get one free image per slot in one call: matched to the slot's orientation, kind and width (at least half of it where possible), commercial-safe by default, with direct files and alternatives per slot, plus images.json, credits.html (<figure> snippets with credit captions), download.sh and the credits.",
      "",
      `The page at ${SITE.url}/build is an interactive front end to one API call. Agents and scripts should call the API directly:`,
      "",
      "```bash",
      `curl -X POST ${SITE.url}/v1/sets \\`,
      '  -H "content-type: application/json" \\',
      `  -d '{"slots":["hero: mountain lake at sunrise (1920px)","3 icons: rocket, shield, chart","botanical illustration of a rose"],"width":1600,"commercialOnly":true,"name":"landing"}'`,
      "```",
      "",
      "`slots` is a list, or text with one slot per line; \"(1200px)\" at the end of a slot sets its width, and \"3 icons: rocket, shield, chart\" makes one slot per item. Words like \"vertical\", \"png\", \"svg\", \"transparent\" or \"4k\" in a slot become filters. Up to 24 slots. Other fields: `width` (default 1600), `orientation` (landscape, portrait, square), `styles` (photo, illustration, painting, drawing, vector, icon…), `commercialOnly` (default true), `providers`, `alternatives` (0-5, default 3), `name`.",
      "",
      "## What you get",
      "",
      "- `plan.slots[]`: `index`, `description`, `width`, `image` (the pick, with its licence), `file` (the file the exports use: the smallest at least as wide as the slot), `alt` (suggested alt text), `alternatives[]` and a `note` when the pick is smaller, a different shape or editorial-only.",
      "- `plan.commercialSafe`: true when every pick's verdict is `yes` or `yes-with-credit`. Editorial-flagged picks (`license.editorial`) are still not for ads.",
      "- `exports`: `images.json`, `credits.html`, `download.sh` (curl into ./images), `ATTRIBUTION.md` and `credits.json`.",
      "",
      "File URLs in the exports point at the sources: nothing is re-hosted.",
      "",
      "## From the CLI or an AI agent",
      "",
      "- CLI: `npx image-asset-server set slots.txt --width 1600 [--download]`",
      `- MCP: connect ${MCP_URL} (as \`${MCP_NAME}\`) and call \`build_image_set\` (slots, width, orientation, styles, commercial_only). Run locally (\`npx -y image-asset-server mcp\`), \`download=true\` saves the images and writes the exports next to them.`,
      "",
      `Guide: ${SITE.url}/guides/ai-agent-find-and-license-images.md`,
      "",
      "---",
      `Source: ${SITE.url}/build`,
      "",
    ].join("\n"),
    { headers: { "content-type": "text/markdown; charset=utf-8" } },
  );
