/**
 * The image vocabulary (categories, styles, orientations, size tiers,
 * licence verdicts), read from src/data/vocab.json, which
 * web/scripts/export-vocab.mjs writes from the compiled server
 * (src/core/vocab.ts, src/core/licence.ts). Nothing here is a hand-copied
 * list: only presentation (tones, wording, formatting) is added.
 */
import vocab from "@/data/vocab.json";

export interface CategoryDef {
  id: string;
  label: string;
}

export const CATEGORY_DEFS: CategoryDef[] = vocab.categories;
export const TOP_CATEGORIES: string[] = vocab.topCategories;
export const STYLES: { id: string; label: string }[] = vocab.styles;
export const ORIENTATIONS: string[] = vocab.orientations;
export const RESOLUTIONS: { id: string; label: string; minShortSide: number }[] = vocab.resolutions;
export const VERDICTS = vocab.verdicts as Verdict[];
export const VERDICT_LABELS = vocab.verdictLabels as Record<Verdict, string>;

export type Verdict = "yes" | "yes-with-credit" | "restricted" | "clearance-required" | "check-terms" | "no";

const byId = new Map(CATEGORY_DEFS.map((c) => [c.id, c]));

export function categoryLabel(id: string | undefined): string {
  if (!id) return "";
  return byId.get(id)?.label ?? id;
}

/** "nature.ocean" -> "nature" */
export const topCategory = (id: string) => id.split(".")[0] ?? id;

/** Children of a top-level category, in vocabulary order ("nature" -> ocean, rivers, sky…). */
export function subCategories(top: string): CategoryDef[] {
  return CATEGORY_DEFS.filter((c) => c.id.startsWith(`${top}.`));
}

/** Depth of a category below its top level (nature.ocean = 1). */
export const depth = (id: string) => id.split(".").length - 1;

/** "Nature › Ocean & beach" */
export function categoryPath(id: string): string {
  const parts = id.split(".");
  if (parts.length === 1) return categoryLabel(id);
  return `${categoryLabel(parts[0])} › ${categoryLabel(id)}`;
}

export function styleLabel(id: string | undefined): string {
  if (!id) return "";
  return STYLES.find((s) => s.id === id)?.label ?? id;
}

export const ORIENTATION_LABELS: Record<string, string> = { landscape: "Landscape", portrait: "Vertical", square: "Square" };
export const orientationLabel = (o: string | undefined) => (o ? ORIENTATION_LABELS[o] ?? o : "");

/** Width/height → orientation (within 5% of square counts as square), as the server decides it. */
export function orientationOf(width?: number, height?: number): string | undefined {
  if (!width || !height) return undefined;
  const r = width / height;
  if (r > 1.05) return "landscape";
  if (r < 0.95) return "portrait";
  return "square";
}

/**
 * Short badge for a pixel size, by its short side (a 2160×3840 phone
 * wallpaper is "4K"): "4K+", "XL", "L", "M", "S". 3% slack, as on the server.
 */
export function resolutionBadge(width?: number, height?: number): string {
  if (!width || !height) return "";
  const s = Math.min(width, height);
  if (s >= 2160 * 0.97) return "4K+";
  if (s >= 1440 * 0.97) return "XL";
  if (s >= 1080 * 0.97) return "L";
  if (s >= 720 * 0.97) return "M";
  return "S";
}

/** Long label for a pixel size ("Large 1080+"), from the server's tiers. */
export function resolutionLabel(width?: number, height?: number): string {
  if (!width || !height) return "";
  const s = Math.min(width, height);
  let label = RESOLUTIONS[0]?.label ?? "";
  for (const r of RESOLUTIONS) if (s >= r.minShortSide * 0.97) label = r.label;
  return label;
}

/** "3864 × 3864" */
export function sizeText(width?: number, height?: number): string {
  return width && height ? `${width} × ${height}` : "";
}

/** Megapixels, one decimal: "14.9 MP". */
export function megapixelText(width?: number, height?: number): string {
  if (!width || !height) return "";
  return `${Math.round((width * height) / 100_000) / 10} MP`;
}

/** Minimum-size filter choices (short side in pixels, the API's `min_resolution`). */
export const MIN_RESOLUTIONS: { value: number; label: string; short: string }[] = [
  { value: 720, label: "Medium 720+ px", short: "720+" },
  { value: 1080, label: "Large 1080+ px", short: "1080+" },
  { value: 1440, label: "XL 1440+ px", short: "1440+" },
  { value: 2160, label: "4K+ 2160+ px", short: "4K+" },
];

/** Format filter choices (the API's `format`). */
export const FORMATS: { value: string; label: string }[] = [
  { value: "jpg", label: "JPG" },
  { value: "png", label: "PNG" },
  { value: "svg", label: "SVG" },
  { value: "tif", label: "TIFF" },
];

/** Traffic-light colour of a verdict. */
export type Tone = "green" | "amber" | "red";
export function verdictTone(v: string | undefined): Tone {
  if (v === "yes" || v === "yes-with-credit") return "green";
  if (v === "no") return "red";
  return "amber";
}

/** Longer, plain-language meaning of each verdict (detail sheet, licence docs, landing page). */
export const VERDICT_MEANING: Record<Verdict, string> = {
  yes: "You can use it commercially (an ad, a product page, a client website, a printed book) without crediting anyone. Crediting the source is still kind.",
  "yes-with-credit": "You can use it commercially as long as you credit the source, for example in a caption, next to the image or on a credits page. Use the credit line below.",
  restricted: "Commercial use comes with conditions that usually rule out a normal project, such as share-alike: an edited version would have to carry the same Creative Commons licence.",
  "clearance-required": "Stock imagery that needs a paid licence, or releases for the people and property shown, for each use. Fine for a mock-up; license it before you publish.",
  "check-terms": "Nobody has verified the licence: the source states none, the rights were not evaluated, or a third party may own the image. Read the terms before you use it.",
  no: "Non-commercial only: personal projects, study and teaching. Not for ads, client work or anything you sell.",
};

/** What `license.editorial` means, in one paragraph. */
export const EDITORIAL_MEANING =
  "Editorial use: identifiable people, logos, insignia or brands appear without model or property releases. Fine for articles, books and education; not for ads, product promotion or anything that implies endorsement.";

/** Verdicts in display order, grouped by tone. */
export const VERDICTS_BY_TONE: Record<Tone, Verdict[]> = {
  green: VERDICTS.filter((v) => verdictTone(v) === "green"),
  amber: VERDICTS.filter((v) => verdictTone(v) === "amber"),
  red: VERDICTS.filter((v) => verdictTone(v) === "red"),
};
