/**
 * build_image_set: turn a list of image slots ("hero: sunrise over a city
 * skyline, landscape", "3 icons: rocket, shield, chart", "portrait of a
 * baker at work") into a set of images for a page, deck or post.
 *
 * For each slot: search every source with the slot's orientation, size and
 * kind, pick the best image not already used (alternatives kept), then
 * resolve its files and choose the smallest one at least as wide as the
 * slot. The plan carries everything a site, deck or render script needs:
 * - `images.json`     the picks: file URL, size, alt text, credit, licence
 * - `credits.html`    <figure> snippets with each image's credit line
 * - `download.sh`     curl each pick into ./images (with a polite User-Agent)
 * - credits (ATTRIBUTION.md + credits.json)
 *
 * The hosted server only plans: file URLs point at the sources. Local
 * installs can download the picks and the exports then use local paths.
 */
import { creditsJson, creditsMarkdown, type CreditsFile } from "./credits.js";
import { selectFiles } from "./download.js";
import { COMMERCIAL_SAFE } from "./licence.js";
import type { ImageService } from "./service.js";
import type { ImageAsset, ImageDetails, ImageFile, ImageStyle, Orientation } from "./types.js";
import { orientationOf } from "./vocab.js";

export interface SlotRequest {
  /** What the image shows: the search query ("vertical", "png", "icon" in it become filters). */
  description: string;
  /** Wanted width in pixels; default from the set (1600). */
  width?: number;
  orientation?: Orientation;
  /** Kind: photo, illustration, painting, vector, icon… */
  styles?: ImageStyle[];
}

export interface ImageSetOptions {
  slots: SlotRequest[];
  /** Default width for slots without their own (pixels). */
  width?: number;
  /** Default orientation for slots without their own. */
  orientation?: Orientation;
  /** Default kind for slots without their own (e.g. ["photo"] for a photo-only page). */
  styles?: ImageStyle[];
  commercialOnly?: boolean;
  providers?: string[];
  /** Alternatives kept per slot. */
  alternatives?: number;
  credentials?: Record<string, string>;
}

export interface ImageSlot {
  index: number;
  description: string;
  width: number;
  image?: ImageAsset;
  /** The file the exports use (a direct URL on the source). */
  file?: Pick<ImageFile, "url" | "filename" | "format" | "width" | "height" | "sizeBytes">;
  /** Suggested alt text: the title, cleaned up. */
  alt?: string;
  alternatives: ImageAsset[];
  /** Why nothing (or something imperfect) was picked. */
  note?: string;
}

export interface ImageSetPlan {
  slots: ImageSlot[];
  /** True when every pick's licence is yes / yes-with-credit. */
  commercialSafe: boolean;
}

const DEFAULT_WIDTH = 1600;
const MAX_SLOTS = 24;

/**
 * "Hero: city skyline at dusk\n- 3 icons: rocket, shield, chart\n2. baker portrait"
 * → slots. "N icons: a, b, c" (or "N images of a, b, c") becomes one slot per
 * item with the kind kept; "(800px)" / "800w" at the end sets the width.
 */
export function parseSlotList(text: string): SlotRequest[] {
  const out: SlotRequest[] = [];
  for (const raw of text.split(/\r?\n|;/)) {
    let line = raw.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim();
    if (!line) continue;
    let width: number | undefined;
    const w = /[([]?\s*(\d{2,5})\s*(?:px|w)\s*(?:wide)?\s*[)\]]?\s*$/i.exec(line);
    if (w) {
      width = Number(w[1]);
      line = line.slice(0, w.index).trim();
    }
    line = line.replace(/^(?:hero|header|banner|cover|thumbnail|background|slide\s*\d+|section\s*\d+|image\s*\d+)\s*[:.-]\s*/i, (m) => m.replace(/\s*[:.-]\s*$/, " ")).trim();
    const multi = /^(\d{1,2})\s+([a-z -]+?)s?\s*(?:of|:)\s*(.+)$/i.exec(line);
    if (multi && multi[3]!.includes(",")) {
      const kind = multi[2]!.trim();
      for (const item of multi[3]!.split(/,|\band\b/).map((x) => x.trim()).filter(Boolean)) out.push({ description: `${item} ${kind}`, ...(width ? { width } : {}) });
      continue;
    }
    out.push({ description: line, ...(width ? { width } : {}) });
  }
  return out;
}

/** "Golden_Gate_Bridge_at_sunset.jpg" → "Golden Gate Bridge at sunset". */
export function altText(title: string): string {
  return title
    .replace(/\.[a-z0-9]{2,4}$/i, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 125);
}

export async function planImageSet(service: ImageService, o: ImageSetOptions): Promise<ImageSetPlan> {
  const slots = o.slots.slice(0, MAX_SLOTS);
  if (!slots.length) throw new Error("An image set needs at least one slot.");
  const used = new Set<string>();
  const alternatives = o.alternatives ?? 3;
  const commercialOnly = o.commercialOnly ?? true;
  const widthOf = (s: SlotRequest) => s.width ?? o.width ?? DEFAULT_WIDTH;

  // Searches run in parallel; picks are made in order so an image is used once.
  // A slot that finds nothing at its orientation and size searches again
  // without them: an image that has to be cropped or upscaled beats none (the
  // slot's note says so).
  const searchSlot = (s: SlotRequest, strict: boolean) => {
    const orientation = s.orientation ?? o.orientation;
    const styles = s.styles ?? o.styles;
    return service
      .search({
        query: s.description,
        parse: true,
        ...(strict && orientation ? { orientations: [orientation] } : {}),
        ...(strict ? { minResolution: Math.min(Math.round(widthOf(s) * 0.5), 1080) } : {}),
        ...(styles?.length ? { styles } : {}),
        commercialOnly,
        downloadableOnly: true,
        providers: o.providers,
        limit: 12,
        credentials: o.credentials,
      })
      .catch(() => undefined);
  };
  const searches = await Promise.all(
    slots.map(async (s) => {
      const first = await searchSlot(s, true);
      return first?.results.length ? first : ((await searchSlot(s, false)) ?? first);
    }),
  );

  const out: ImageSlot[] = [];
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]!;
    const width = widthOf(slot);
    const res = searches[i];
    const candidates = (res?.results ?? []).filter((c) => !used.has(c.id));
    const base: ImageSlot = { index: i + 1, description: slot.description, width, alternatives: [] };
    let picked: { image: ImageAsset; details: ImageDetails; file: ImageFile } | undefined;
    for (const c of candidates.slice(0, 4)) {
      const details = await service.getImage(c.id, o.credentials).catch(() => null);
      const file = details ? selectFiles(details, { width })[0] : undefined;
      if (details && file) {
        picked = { image: { ...c, ...stripFiles(details), score: c.score }, details, file };
        break;
      }
    }
    if (!picked) {
      out.push({ ...base, note: res ? "No downloadable image matched; try other words or drop the commercial filter." : "Search failed for this slot." });
      continue;
    }
    used.add(picked.image.id);
    const notes: string[] = [];
    const f = picked.file;
    if (f.format !== "svg" && f.width !== undefined && f.width < width * 0.97) notes.push(`Largest file is ${f.width}px wide, below the ${width}px slot: it will be upscaled.`);
    const wanted = slot.orientation ?? o.orientation;
    const got = picked.image.orientation ?? orientationOf(f.width, f.height);
    if (wanted && got && got !== wanted) notes.push(`Image is ${got}; it will be cropped to ${wanted}.`);
    if (picked.image.license?.editorial) notes.push("Editorial: fine for articles and education, but don't use it to advertise or imply endorsement.");
    out.push({
      ...base,
      image: picked.image,
      file: { url: f.url, filename: f.filename, format: f.format, width: f.width, height: f.height, sizeBytes: f.sizeBytes },
      alt: altText(picked.image.title),
      alternatives: candidates.filter((c) => c.id !== picked!.image.id && !used.has(c.id)).slice(0, alternatives),
      ...(notes.length ? { note: notes.join(" ") } : {}),
    });
  }

  const picks = out.filter((s) => s.image).map((s) => s.image!);
  return {
    slots: out,
    commercialSafe: picks.length > 0 && picks.every((c) => c.license && COMMERCIAL_SAFE.has(c.license.verdict)),
  };
}

function stripFiles(d: ImageDetails): ImageAsset {
  const { files: _f, ...rest } = d;
  return rest;
}

// ---------------------------------------------------------------------------
// Exports

export interface ImageSetExports {
  "images.json": string;
  "credits.html": string;
  "download.sh": string;
  "ATTRIBUTION.md": string;
  "credits.json": string;
}

/** Where each slot's file is: the source URL, or a local path when the picks were downloaded. */
export type MediaPaths = Record<number, string>;

export function imageSetExports(plan: ImageSetPlan, opts: { name?: string; sourceNames?: Record<string, string>; media?: MediaPaths; now?: Date } = {}): ImageSetExports {
  const name = opts.name ?? "image-set";
  const slots = plan.slots.filter((s) => s.image && s.file);
  const media = (s: ImageSlot) => opts.media?.[s.index] ?? s.file!.url;
  const credits: CreditsFile = creditsJson(slots.map((s) => s.image!), { sourceNames: opts.sourceNames, now: opts.now });
  return {
    "images.json": JSON.stringify(manifest(plan, slots, media, name), null, 2),
    "credits.html": creditsHtml(slots, media),
    "download.sh": downloadScript(slots, name),
    "ATTRIBUTION.md": creditsMarkdown(credits),
    "credits.json": JSON.stringify(credits, null, 2),
  };
}

/** The local file name a slot downloads to: "01-city-skyline-at-dusk.jpg". */
export function slotFilename(s: ImageSlot): string {
  const stem = s.description.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "image";
  return `${String(s.index).padStart(2, "0")}-${stem}.${s.file?.format ?? "jpg"}`;
}

export function manifest(plan: ImageSetPlan, slots: ImageSlot[], media: (s: ImageSlot) => string, name: string) {
  return {
    name,
    generator: "image-asset-server",
    commercialSafe: plan.commercialSafe,
    images: slots.map((s) => ({
      slot: s.index,
      description: s.description,
      id: s.image!.id,
      title: s.image!.title,
      src: media(s),
      file: slotFilename(s),
      width: s.file!.width,
      height: s.file!.height,
      format: s.file!.format,
      alt: s.alt,
      page: s.image!.url,
      license: s.image!.license?.name,
      licenseUrl: s.image!.license?.url,
      verdict: s.image!.license?.verdict,
      editorial: s.image!.license?.editorial || undefined,
      credit: s.image!.attribution,
    })),
  };
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** One <figure> per pick, credit in the caption (what CC BY asks for, and good manners for the rest). */
export function creditsHtml(slots: ImageSlot[], media: (s: ImageSlot) => string): string {
  const parts = slots.map((s) => {
    const img = s.image!;
    const by = img.author ? ` by ${esc(img.author)}` : "";
    const lic = img.license ? (img.license.url ? `<a href="${esc(img.license.url)}">${esc(img.license.name)}</a>` : esc(img.license.name)) : "";
    const size = s.file!.width && s.file!.height ? ` width="${s.file!.width}" height="${s.file!.height}"` : "";
    return [
      `<!-- ${s.index}. ${esc(s.description)} (${esc(img.id)}) -->`,
      `<figure>`,
      `  <img src="${esc(media(s))}" alt="${esc(s.alt ?? img.title)}"${size} loading="lazy">`,
      `  <figcaption><a href="${esc(img.url)}">${esc(img.title)}</a>${by}${lic ? `, ${lic}` : ""}</figcaption>`,
      `</figure>`,
    ].join("\n");
  });
  return `${parts.join("\n\n")}\n`;
}

/** Sources like Wikimedia throttle anonymous clients: say who is fetching. */
const CURL_UA = "image-asset-server-set/0.1 (+https://image.shep.bot; https://github.com/arielshad/image-asset-server)";

function sh(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/** A POSIX shell script: curl each pick into ./images under its slot file name. */
export function downloadScript(slots: ImageSlot[], name: string): string {
  const lines = [
    "#!/bin/sh",
    `# ${name}: ${slots.length} images, generated by image-asset-server.`,
    "# Credits: see ATTRIBUTION.md before publishing.",
    "set -eu",
    'cd "$(dirname "$0")"',
    "mkdir -p images",
  ];
  for (const s of slots) {
    lines.push(`# ${s.index}. ${s.description.replace(/\n/g, " ")} — ${s.image!.title.replace(/\n/g, " ")} (${s.image!.id})`, `curl -fsSL -A ${sh(CURL_UA)} -o ${sh(`images/${slotFilename(s)}`)} ${sh(s.file!.url)}`);
  }
  lines.push(`echo "Downloaded ${slots.length} images into ./images"`, "");
  return lines.join("\n");
}
