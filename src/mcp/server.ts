import { mkdir, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { clientFamily, noopAnalytics, type Analytics } from "../core/analytics.js";
import { recordCredits } from "../core/credits-file.js";
import { downloadImage, fetchFile, formatBytes, imageFilePath, pickDisplay, selectFiles, totalBytes } from "../core/download.js";
import { VERDICT_LABELS } from "../core/licence.js";
import { imageSetExports, parseSlotList, planImageSet, slotFilename, type ImageSetPlan, type MediaPaths } from "../core/imageset.js";
import { ImageService, errorMessage } from "../core/service.js";
import type { ImageAsset, ImageDetails, ImageFile, ImageStyle, Orientation } from "../core/types.js";
import { compact } from "../core/util.js";
import { CATEGORIES, IMAGE_STYLES, ORIENTATIONS, resolutionLabel, type Category } from "../core/vocab.js";
import { versionLabel } from "./attribution.js";

export interface McpOptions {
  /** Allow tools to write to the local filesystem (stdio / trusted local use). */
  allowLocalDownload: boolean;
  /** Default destination for downloads. */
  downloadDir?: string;
  /** Public base URL of the HTTP API, used to offer download and preview links. */
  publicBaseUrl?: string;
  /** Where tool calls are recorded (defaults to no-op). */
  analytics?: Analytics;
  /**
   * Client family of the caller, for analytics only. The HTTP endpoint sets it
   * per request (src/mcp/attribution.ts). Without it, the family of the name
   * the client declared when it connected is used (stdio).
   */
  client?: string;
  /** More about the HTTP caller, for analytics only. */
  attribution?: {
    network: string;
    consistency: string;
    /** True on this caller's first tool call today (counts distinct callers). */
    newCaller?: (client: string) => boolean;
  };
}

export const VERSION = "0.1.0";

const categoryEnum = z.enum(CATEGORIES as [Category, ...Category[]]);
const styleEnum = z.enum(IMAGE_STYLES);
const orientationEnum = z.enum(ORIENTATIONS);

const LICENCE_RULES =
  "Every result has license.verdict. 'yes' = usable commercially (ads, products, client sites, print); 'yes-with-credit' = usable if you credit " +
  "the source (put the `attribution` line in a caption, alt-adjacent credit or a credits page); 'restricted', 'clearance-required' and 'check-terms' = " +
  "tell the user to read the terms first; 'no' = non-commercial only. license.editorial=true means people, insignia or brands appear without releases: " +
  "fine for articles, documentary and education, not for ads or anything implying endorsement. Never present a 'no', 'check-terms' or editorial " +
  "image as cleared for advertising. Searches are commercial-safe by default (commercial_only=true); set commercial_only=false only when the " +
  "user says the project is personal, educational or non-commercial.";

/** "1080", "4k", 2160 → pixels of the short side. */
const resolutionParam = z
  .union([z.number().int().min(100).max(8000), z.enum(["720", "1080", "1440", "2160", "hd", "fullhd", "large", "4k"])])
  .optional()
  .describe("Minimum size (short side in pixels): 720, 1080, 1440 (large) or 2160 (4K). A 2160×3840 phone wallpaper counts as 2160. Vectors always pass.");

function resolutionPx(v: number | string | undefined): number | undefined {
  if (v === undefined) return undefined;
  if (typeof v === "number") return v;
  return { hd: 720, fullhd: 1080, large: 1440, "4k": 2160 }[v] ?? Number(v);
}

export function createMcpServer(service: ImageService, opts: McpOptions): McpServer {
  const base = opts.publicBaseUrl?.replace(/\/$/, "");
  const providerNames = service
    .listProviders()
    .filter((p) => p.access !== "link")
    .map((p) => p.name)
    .join(", ");
  const server = new McpServer(
    { name: "image-asset-server", version: VERSION },
    {
      instructions: [
        "Search free, openly licensed images (photos, museum art, illustrations, maps, SVG vectors and icons) across many sources at once",
        `(${providerNames}), with deep links into image sites that can't be searched automatically (Unsplash, Pexels, Pixabay, Shutterstock…).`,
        "Queries understand size, orientation, format, transparency and kind words ('4k vertical mountain lake photo', 'rocket icon svg', 'transparent png coffee cup', 'watercolor heron').",
        ...(opts.allowLocalDownload
          ? [
              "Typical flow: search_images -> get_image (licence, sizes, display URL) -> download_image.",
              "build_image_set turns a list of image slots for a page, deck or post into one pick per slot in one call, downloads them, and writes images.json, credits.html (<figure> snippets with credit lines) and the credits.",
            ]
          : [
              "Typical flow: search_images -> get_image -> fetch selection.downloadUrl (a redirect to the file on the source).",
              "This server cannot write to your disk: if you have a shell, download the file yourself",
              '(`curl -L -o "images/<selection.filename>" "<selection.downloadUrl>"`); otherwise give the user the link.',
              "build_image_set picks one image per slot for a page, deck or post and returns images.json, credits.html, a download.sh script and the credits, with file URLs on the sources.",
            ]),
        LICENCE_RULES,
        "Results marked downloadable=false must be obtained from their `url` on the source site.",
      ].join(" "),
    },
  );

  const providerIds = service.listProviders().map((p) => p.id);
  const sourceNames = Object.fromEntries(service.listProviders().map((p) => [p.id, p.name]));
  const analytics = opts.analytics ?? noopAnalytics;
  /** The caller's client family: given per request (HTTP), or from the client's declared name (stdio). */
  const clientOf = () => opts.client ?? clientFamily(server.server.getClientVersion()?.name);

  // Over a connection that stays open (stdio), the declared client is known
  // once it has connected. The stateless HTTP endpoint reports connects itself.
  server.server.oninitialized = () => {
    const info = server.server.getClientVersion();
    if (!info || opts.client) return;
    const client = clientFamily(info.name);
    analytics.mcpConnect({ client, clientVersion: versionLabel(client, info.version), clientName: info.name.slice(0, 64) });
  };

  /** Wrap a tool handler so every call is counted and timed. */
  const timed =
    <A>(tool: string, handler: (args: A) => Promise<ToolResult>) =>
    async (args: A): Promise<ToolResult> => {
      const started = Date.now();
      let outcome: "ok" | "error" = "error";
      try {
        const res = await handler(args);
        outcome = res.isError ? "error" : "ok";
        return res;
      } finally {
        const client = clientOf();
        const a = opts.attribution;
        analytics.toolCall({
          tool,
          client,
          outcome,
          tookMs: Date.now() - started,
          network: a?.network,
          consistency: a?.consistency,
          newCaller: a?.newCaller?.(client),
        });
      }
    };

  const links = (c: Pick<ImageAsset, "id">) =>
    base
      ? {
          download: `${base}/v1/images/${encodeURIComponent(c.id)}/download`,
          credits: `${base}/v1/images/${encodeURIComponent(c.id)}/credits`,
          share: `${base}/search?image=${encodeURIComponent(c.id)}`,
        }
      : undefined;

  server.registerTool(
    "search_images",
    {
      title: "Search free images",
      description:
        "Search every image source at once. Write the query like a designer would: 'mountain lake at sunrise', 'baker kneading dough', 'van gogh sunflowers', " +
        "'saturn rings', 'vintage map of paris', 'rocket icon', 'paper texture background', 'coffee cup transparent png'. " +
        "Size ('4k', 'high resolution', '1080p'), orientation ('vertical', '16:9', 'square'), format ('svg', 'png', 'jpg') and transparency ('transparent', 'no background') " +
        "in the query become filters; you can also pass them explicitly. " +
        "Filter with `categories` (e.g. nature.ocean, animals, city.skyline, architecture, people.work, food, objects, space.planets, art.painting, art.drawing, archive.map, background, icons; " +
        "a parent like 'nature' matches all nature) and `styles` (photo, illustration, painting, drawing, vector, icon, transparent, black-white). " +
        "Results carry pixel size, orientation, a thumbnail and a display-size preview URL (both load straight from the source) and the licence verdict. " +
        "The response also lists deep links into image sites that can't be searched automatically. " +
        LICENCE_RULES,
      inputSchema: {
        query: z.string().describe("What the image shows, e.g. 'mountain lake at sunrise', 'van gogh sunflowers', 'rocket icon'."),
        categories: z.array(categoryEnum).optional().describe("Only these categories (parents match children)."),
        styles: z.array(styleEnum).optional().describe("Kind and look. 'vector' and 'icon' filter strictly; the others rank first (filtered only with strict=true, since sources rarely tag them)."),
        orientation: orientationEnum.optional().describe("landscape, portrait (vertical) or square."),
        min_resolution: resolutionParam,
        transparent: z.boolean().optional().describe("Only images with a transparent background (icons, SVGs, PNG cut-outs)."),
        formats: z.array(z.string()).optional().describe("Only these formats: jpg, png, svg, webp, tif."),
        commercial_only: z.boolean().optional().describe("Only images usable commercially (default true)."),
        free_only: z.boolean().optional().describe("Exclude paid images."),
        downloadable_only: z.boolean().optional().describe("Only images with direct file links."),
        strict: z.boolean().optional().describe("Drop images whose orientation/size/transparency is unknown when you filter on them."),
        providers: z.array(z.string()).optional().describe(`Only search these sources. Available: ${providerIds.join(", ")}.`),
        limit: z.number().int().min(1).max(50).optional().describe("Max results (default 12)."),
        offset: z.number().int().min(0).optional().describe("Per-source offset for paging (e.g. 12 for page 2)."),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    timed("search_images", async (args) => {
      try {
        const started = Date.now();
        const res = await service.search({
          query: args.query,
          categories: args.categories,
          styles: args.styles,
          orientations: args.orientation ? [args.orientation] : undefined,
          minResolution: resolutionPx(args.min_resolution),
          transparent: args.transparent,
          formats: args.formats,
          commercialOnly: args.commercial_only ?? true,
          freeOnly: args.free_only,
          downloadableOnly: args.downloadable_only,
          strict: args.strict,
          providers: args.providers,
          limit: args.limit ?? 12,
          offset: args.offset,
        });
        analytics.search({
          surface: "mcp",
          client: clientOf(),
          query: args.query,
          categories: res.filters.categories,
          orientations: res.filters.orientations,
          minResolution: res.filters.minResolution,
          freeOnly: args.free_only,
          downloadableOnly: args.downloadable_only,
          response: res,
          tookMs: Date.now() - started,
        });
        return json({
          query: res.query,
          filters: res.filters,
          results: res.results.map((c) => summarize(c)),
          sources: res.providers
            .filter((p) => p.status === "ok")
            .map((p) => `${p.provider}: ${p.count}${p.total !== undefined ? `/${p.total}` : ""}`)
            .join(", "),
          skipped: res.providers.filter((p) => p.status === "skipped").map((p) => `${p.provider} (${p.error})`).join(", ") || undefined,
          also_search_on: res.providers.filter((p) => p.status === "link" && p.searchUrl).map((p) => ({ provider: p.name, url: p.searchUrl })),
          unavailable: res.providers
            .filter((p) => p.status === "error" || p.status === "timeout")
            .map((p) => ({ provider: p.provider, reason: p.error, url: p.searchUrl })),
          hint: res.results.length
            ? undefined
            : "Nothing matched. Try fewer or more general words, drop the size/format filters, set commercial_only=false for personal projects, or open also_search_on links.",
        });
      } catch (e) {
        return fail(e);
      }
    }),
  );

  server.registerTool(
    "get_image",
    {
      title: "Get image details, sizes and download link",
      description:
        "Full details for an image id from search_images (e.g. 'nasa:PIA12348', 'met:436524', 'iconify:mdi:rocket'): licence and credit line, " +
        "every file (size, format), and a `display` URL that shows in a browser straight from the source. " +
        (opts.allowLocalDownload
          ? "Use download_image to fetch it."
          : "selection.downloadUrl redirects to the chosen file on the source (follow redirects); pass `width` to pick a smaller copy than the original."),
      inputSchema: {
        id: z.string().describe("Image id in the form '<provider>:<id>'."),
        width: z.number().int().min(16).max(20000).optional().describe("Wanted width in pixels: picks the smallest file at least that wide (e.g. 1600 for a web hero)."),
        format: z.string().optional().describe("Preferred format: jpg, png, svg, tif."),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    timed("get_image", async (args) => {
      try {
        const image = await service.getImage(args.id);
        analytics.imageView({ surface: "mcp", client: clientOf(), provider: args.id.split(":")[0] ?? "", found: Boolean(image) });
        if (!image) return fail(`Image not found: ${args.id}`);
        const selected = image.files.length ? selectFiles(image, { width: args.width, format: args.format }) : [];
        const size = totalBytes(selected);
        const l = links(image);
        const q = new URLSearchParams();
        if (args.width) q.set("width", String(args.width));
        if (args.format) q.set("format", args.format);
        const pick = selected[0];
        return json(
          compact({
            ...summarize(image),
            description: image.description?.slice(0, 600),
            display: pickDisplay(image)?.url,
            files: image.files.filter((f) => f.role !== "thumbnail").map(describeFile),
            selection: pick
              ? compact({
                  file: pick.filename,
                  size: pick.width ? `${pick.width}×${pick.height}` : undefined,
                  format: pick.format,
                  bytes: size !== undefined ? formatBytes(size) : undefined,
                  downloadUrl: l ? `${l.download}${q.size ? `?${q}` : ""}` : pick.url,
                  directUrl: pick.url,
                  filename: imageFilePath(image, pick).split("/").pop(),
                })
              : undefined,
            credits: l?.credits,
            note: image.files.length ? undefined : "No direct files: get it from the image's page on the source site.",
            shareUrl: l?.share,
          }),
        );
      } catch (e) {
        return fail(e);
      }
    }),
  );

  if (opts.allowLocalDownload) {
    server.registerTool(
      "download_image",
      {
        title: "Download an image",
        description:
          "Download an image to a local folder (default: ./images), filed by category (images/nature/ocean/….jpg). " +
          "ATTRIBUTION.md and credits.json in the folder are updated with every download so the credits for a project are always in one place. " +
          "Pass `width` to get a smaller copy instead of the original (e.g. 1920 instead of a 60 MB TIFF). Only works for images with downloadable=true.",
        inputSchema: {
          id: z.string().describe("Image id from search_images."),
          dest_dir: z.string().optional().describe("Destination folder (the project's images folder)."),
          width: z.number().int().min(16).max(20000).optional().describe("Wanted width in pixels, e.g. 1920."),
          format: z.string().optional().describe("Preferred format: jpg, png, svg, tif."),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
      },
      timed("download_image", async (args) => {
        try {
          const image = await service.getImage(args.id);
          if (!image) return fail(`Image not found: ${args.id}`);
          const files = selectFiles(image, { width: args.width, format: args.format });
          if (!files.length) {
            return fail(
              image.files.length
                ? `No downloadable files match. Files: ${JSON.stringify(image.files.map(describeFile))}`
                : `${image.title} has no direct downloads. Get it from ${image.url}`,
            );
          }
          const dir = resolve(args.dest_dir ?? opts.downloadDir ?? "images");
          const result = await downloadImage(service.http, image, files, dir);
          await recordCredits(dir, [image], sourceNames);
          analytics.download({ surface: "mcp", client: clientOf(), provider: image.provider, kind: "local", quality: qualityOf(files[0]) });
          return json(
            compact({
              id: image.id,
              title: image.title,
              directory: result.directory,
              files: result.files.map((f) => f.path),
              downloaded: formatBytes(result.bytes),
              license: licenceSummary(image),
              attribution: image.attribution,
              credits: `${dir}/ATTRIBUTION.md`,
              source: image.url,
            }),
          );
        } catch (e) {
          return fail(e);
        }
      }),
    );
  }

  server.registerTool(
    "build_image_set",
    {
      title: "Pick images for a page, deck or post",
      description:
        "Pick one image per slot in one call. Give the slots as a list ('hero: city skyline at dusk, landscape', '3 icons: rocket, shield, chart', " +
        "'portrait of a baker at work', 'paper texture background (2400px)') and optionally a default width, orientation and kind. Each pick matches the " +
        "slot's orientation and kind, is at least half the slot's width where possible, is commercial-safe by default and has direct files; alternatives " +
        "are listed per slot. Returns the plan plus images.json (src, size, alt text, licence, credit per pick), credits.html (<figure> snippets with " +
        "credit captions), download.sh and the credits (ATTRIBUTION.md, credits.json)" +
        (opts.allowLocalDownload ? ". With download=true the images are saved and every file is written to dest_dir." : ". File URLs point at the sources."),
      inputSchema: {
        slots: z
          .union([z.array(z.string().min(2)).min(1).max(24), z.string().min(2)])
          .describe("Slot descriptions, as a list or as text with one slot per line. '(1200px)' at the end sets a slot's width; 'N icons: a, b, c' makes one slot per item."),
        width: z.number().int().min(16).max(12000).optional().describe("Default width in pixels (default 1600)."),
        orientation: orientationEnum.optional().describe("Default orientation for slots that don't say."),
        styles: z.array(styleEnum).optional().describe("Default kind for slots that don't say, e.g. ['photo'] or ['icon']."),
        commercial_only: z.boolean().optional().describe("Default true."),
        providers: z.array(z.string()).optional(),
        alternatives: z.number().int().min(0).max(5).optional().describe("Alternatives per slot (default 3)."),
        name: z.string().max(60).optional().describe("Name of the set (folder and file names)."),
        ...(opts.allowLocalDownload
          ? {
              download: z.boolean().optional().describe("Download the picks and write the exports (default false)."),
              dest_dir: z.string().optional().describe("Folder for the set (default ./images/sets/<name>)."),
            }
          : {}),
      },
      annotations: { readOnlyHint: !opts.allowLocalDownload, openWorldHint: true },
    },
    timed("build_image_set", async (args: Record<string, unknown>) => {
      try {
        const raw = args.slots as string[] | string;
        const slots = Array.isArray(raw) ? raw.flatMap((s) => parseSlotList(s)) : parseSlotList(raw);
        if (!slots.length) return fail("Give at least one slot description.");
        const plan = await planImageSet(service, {
          slots,
          width: args.width as number | undefined,
          orientation: args.orientation as Orientation | undefined,
          styles: args.styles as ImageStyle[] | undefined,
          commercialOnly: (args.commercial_only as boolean | undefined) ?? true,
          providers: args.providers as string[] | undefined,
          alternatives: (args.alternatives as number | undefined) ?? 3,
        });
        const name = (args.name as string | undefined) ?? "image-set";
        let media: MediaPaths | undefined;
        let written: string | undefined;
        if (opts.allowLocalDownload && args.download) {
          const dir = resolve((args.dest_dir as string | undefined) ?? join(opts.downloadDir ?? "images", "sets", name.replace(/[^\w.-]+/g, "-")));
          media = await downloadSet(service, plan, dir);
          const files = imageSetExports(plan, { name, sourceNames, media });
          await mkdir(dir, { recursive: true });
          for (const [file, content] of Object.entries(files)) await writeFile(join(dir, file), content, { mode: file.endsWith(".sh") ? 0o755 : 0o644 });
          written = dir;
          analytics.download({ surface: "mcp", client: clientOf(), provider: "set", kind: "local" });
        }
        const exportsOut = written ? undefined : imageSetExports(plan, { name, sourceNames });
        return json(
          compact({
            name,
            commercialSafe: plan.commercialSafe,
            slots: plan.slots.map((s) =>
              compact({
                slot: s.index,
                description: s.description,
                width: s.width,
                pick: s.image ? summarize(s.image) : undefined,
                file: s.file ? compact({ url: s.file.url, size: s.file.width ? `${s.file.width}×${s.file.height}` : undefined, format: s.file.format }) : undefined,
                alt: s.alt,
                alternatives: s.alternatives.length ? s.alternatives.map((a) => ({ id: a.id, title: a.title, verdict: a.license?.verdict })) : undefined,
                note: s.note,
              }),
            ),
            directory: written,
            files: written ? ["images.json", "credits.html", "download.sh", "ATTRIBUTION.md", "credits.json", "images/…"] : undefined,
            exports: exportsOut
              ? {
                  "images.json": JSON.parse(exportsOut["images.json"]),
                  "credits.html": exportsOut["credits.html"],
                  "download.sh": exportsOut["download.sh"],
                  "ATTRIBUTION.md": exportsOut["ATTRIBUTION.md"],
                }
              : undefined,
          }),
        );
      } catch (e) {
        return fail(e);
      }
    }),
  );

  server.registerTool(
    "list_sources",
    {
      title: "List image sources",
      description: "Every image source with what it is best for, categories, pricing, licence and capabilities.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    timed("list_sources", async () =>
      json(
        service.listProviders().map((p) =>
          compact({
            id: p.id,
            name: p.name,
            bestFor: p.description,
            categories: p.categories,
            pricing: p.pricing,
            license: p.license ? `${p.license.name} (${p.license.verdict})` : "per image",
            search: p.access === "link" ? "deep link only" : p.access,
            downloads: p.supportsDownload,
            enabled: p.enabled ? undefined : `needs ${p.apiKeyEnv}`,
          }),
        ),
      ),
    ),
  );

  return server;
}

/** Download every pick of a planned set into <dir>/images and return the local path per slot (relative to dir). */
async function downloadSet(service: ImageService, plan: ImageSetPlan, dir: string): Promise<MediaPaths> {
  const media: MediaPaths = {};
  const folder = join(dir, "images");
  await mkdir(folder, { recursive: true });
  for (const s of plan.slots) {
    if (!s.image || !s.file) continue;
    // fetchFile re-checks every redirect hop against private addresses.
    const res = await fetchFile(service.http, s.file.url).catch(() => undefined);
    if (!res?.ok) continue;
    const path = join(folder, slotFilename(s));
    await writeFile(path, Buffer.from(await res.arrayBuffer()));
    media[s.index] = relative(dir, path);
  }
  return media;
}

/** Download size tier by width: "vector", "4k" (3840+), "large" (1920+), "medium" (1000+), "small". */
export function qualityOf(f: ImageFile | undefined): string | undefined {
  if (!f) return undefined;
  if (f.format === "svg") return "vector";
  if (!f.width) return undefined;
  return f.width >= 3800 ? "4k" : f.width >= 1900 ? "large" : f.width >= 1000 ? "medium" : "small";
}

function licenceSummary(c: ImageAsset) {
  return c.license
    ? compact({
        name: c.license.name,
        id: c.license.id,
        verdict: c.license.verdict,
        meaning: VERDICT_LABELS[c.license.verdict],
        editorial: c.license.editorial || undefined,
        note: c.license.note,
        url: c.license.url,
      })
    : { verdict: "check-terms", meaning: VERDICT_LABELS["check-terms"] };
}

export function summarize(c: ImageAsset) {
  return compact({
    id: c.id,
    title: c.title,
    category: c.category,
    styles: c.styles?.length ? c.styles : undefined,
    orientation: c.orientation,
    size: c.vector ? "vector (any size)" : c.width && c.height ? `${c.width}×${c.height}${resolutionLabel(c.width, c.height) ? ` (${resolutionLabel(c.width, c.height)})` : ""}` : undefined,
    transparent: c.transparent || undefined,
    year: c.year,
    source: c.provider,
    url: c.url,
    thumbnail: c.thumbnailUrl,
    preview: c.previewUrl,
    license: licenceSummary(c),
    attribution: c.attribution,
    author: c.author,
    free: c.price ? c.price.free : undefined,
    formats: c.formats?.length ? c.formats : undefined,
    downloadable: c.downloadable,
    needsAccount: c.requiresAccount || undefined,
    tags: c.tags.length ? c.tags.slice(0, 8) : undefined,
    score: c.score,
  });
}

function describeFile(f: ImageFile) {
  return compact({
    filename: f.filename,
    role: f.role,
    format: f.format,
    size: f.width && f.height ? `${f.width}×${f.height}` : undefined,
    bytes: f.sizeBytes !== undefined ? formatBytes(f.sizeBytes) : undefined,
    needsLogin: f.requiresAuth || undefined,
  });
}

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

export function json(value: unknown): ToolResult {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 1) }] };
}

function fail(e: unknown): ToolResult {
  return { isError: true, content: [{ type: "text" as const, text: typeof e === "string" ? e : errorMessage(e) }] };
}

export type { ImageDetails };
