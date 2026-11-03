/**
 * Image facts in free text: "4k", "high resolution", "vertical", "16:9",
 * "png", "svg", "transparent", "black and white". Used on a user's query to
 * turn words into filters (`parseQuery`), and to read pixel sizes out of
 * titles and file names.
 */
import { STYLE_ALIAS_LIST, categoriesIn, matchAliases, wordTokens } from "./classify.js";
import type { ImageFilters } from "./types.js";
import { IMAGE_STYLES, ORIENTATIONS, ORIENTATION_ALIASES, type Category, type ImageStyle, type Orientation } from "./vocab.js";

export interface ParsedQuery extends ImageFilters {
  /** The words left for text search. */
  query: string;
  /** Categories the words point at (ranking hints, not filters). */
  hints: Category[];
}

// Size words. Order matters: "4k" before "k", "full hd" before "hd".
const RESOLUTION_WORDS: [RegExp, number][] = [
  [/(?<![\w])(8k|4320p)(?![\w])/i, 4320],
  [/(?<![\w])(4k|5k|uhd|ultra\s*hd|2160p)(?![\w])/i, 2160],
  [/(?<![\w])(2k|qhd|1440p|high[\s-]*res(?:olution)?|hi[\s-]*res|print[\s-]*quality|large)(?![\w])/i, 1440],
  [/(?<![\w])(full\s*hd|fhd|1080p|1080)(?![\w])/i, 1080],
  [/(?<![\w])(hd|720p|720)(?![\w])/i, 720],
];

/** File-format words that become a `formats` filter. "svg" also means vector. */
const FORMAT_WORDS: [RegExp, string[]][] = [
  [/(?<![\w])(svg|svgs)(?![\w])/i, ["svg"]],
  [/(?<![\w])(png|pngs)(?![\w])/i, ["png", "svg"]],
  [/(?<![\w])(jpe?g|jpegs|jpgs)(?![\w])/i, ["jpg"]],
  [/(?<![\w])(tiff?)(?![\w])/i, ["tif"]],
];

const TRANSPARENT = /(?<![\w])(transparent(?:\s+background)?|no\s+background|without\s+background|background[\s-]*removed|cut[\s-]*outs?|alpha\s+channel)(?![\w])/i;

const ORIENTATION_ALIAS_LIST = ORIENTATIONS.flatMap((o) => ORIENTATION_ALIASES[o].map((a) => ({ words: wordTokens(a), target: o }))).sort(
  (a, b) => b.words.length - a.words.length,
);
// Ratio forms ("9:16", "16x9") survive tokenising only as separate numbers, so match them on the raw text.
const RATIO_ORIENTATION: [RegExp, Orientation][] = [
  [/(?<![\d])(9\s*[:x]\s*16|4\s*[:x]\s*5|2\s*[:x]\s*3|3\s*[:x]\s*4)(?![\d])/i, "portrait"],
  [/(?<![\d])(16\s*[:x]\s*9|21\s*[:x]\s*9|4\s*[:x]\s*3|3\s*[:x]\s*2)(?![\d])/i, "landscape"],
  [/(?<![\d])(1\s*[:x]\s*1)(?![\d])/i, "square"],
];

/**
 * Pull size, orientation, format, transparency and style out of a user's
 * query. Size, orientation, format and transparency words are removed from
 * the text (sources don't put "4k" or "png" in titles, so they only hurt text
 * search); style and category words stay because sources without those
 * fields still match them in titles ("watercolor of a heron").
 */
export function parseQuery(raw: string): ParsedQuery {
  let text = ` ${raw} `;

  let minResolution: number | undefined;
  for (const [re, px] of RESOLUTION_WORDS) {
    const m = re.exec(text);
    if (!m) continue;
    minResolution = Math.max(minResolution ?? 0, px);
    text = text.replace(m[0], " ");
  }

  let transparent: boolean | undefined;
  const t = TRANSPARENT.exec(text);
  if (t) {
    transparent = true;
    text = text.replace(t[0], " ");
  }

  const formats = new Set<string>();
  for (const [re, fmts] of FORMAT_WORDS) {
    const m = re.exec(text);
    if (!m) continue;
    fmts.forEach((f) => formats.add(f));
    text = text.replace(m[0], " ");
  }

  const orientations = new Set<Orientation>();
  for (const [re, o] of RATIO_ORIENTATION) {
    const m = re.exec(text);
    if (m) {
      orientations.add(o);
      text = text.replace(m[0], " ");
    }
  }
  const tokens = wordTokens(text);
  for (const o of matchAliases(tokens, ORIENTATION_ALIAS_LIST)) orientations.add(o as Orientation);
  if (orientations.size) text = stripAliases(text, ORIENTATION_ALIAS_LIST.filter((a) => orientations.has(a.target as Orientation)).map((a) => a.words));

  const styleHits = matchAliases(wordTokens(text), STYLE_ALIAS_LIST);
  const styles = IMAGE_STYLES.filter((s) => styleHits.has(s)) as ImageStyle[];
  // "svg" is a vector; "transparent" became its own filter.
  if (formats.has("svg") && formats.size === 1 && !styles.includes("vector")) styles.push("vector");

  // Words every image "matches" ("free stock photos of waves" → "waves"). Sources don't
  // put them in titles, so leaving them in only lowers text scores. "photo" stays a
  // style filter but is dropped from the text.
  const query = text
    .replace(/(?<![\p{L}\p{N}])(images?|pictures?|pics?|photos?|photographs?|stock|free|royalty[- ]free|wallpapers?|hd|download|high quality)(?![\p{L}\p{N}])/giu, " ")
    .replace(/(?<![\p{L}\p{N}])(icons?|vectors?|illustrations?)(?![\p{L}\p{N}])/giu, (w) => (styles.length ? " " : w))
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:(?:a|an|the|of|in|with|for|at|on)\s+)+|(?:\s+(?:a|an|the|of|in|with|for|at|on))+$/gi, "")
    .trim();

  return {
    query,
    hints: categoriesIn(query),
    ...(minResolution ? { minResolution } : {}),
    ...(orientations.size === 1 ? { orientations: [...orientations] } : {}),
    ...(transparent ? { transparent } : {}),
    ...(formats.size ? { formats: [...formats] } : {}),
    ...(styles.length ? { styles } : {}),
  };
}

function stripAliases(text: string, phrases: string[][]): string {
  let out = text;
  for (const words of phrases.sort((a, b) => b.length - a.length)) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${words.map(escape).join("[\\s_-]+")}(?![\\p{L}\\p{N}])`, "giu");
    out = out.replace(re, " ");
  }
  return out;
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Parse "WxH" pixel sizes written in titles or file names ("1920x1080", "3840 × 2160"). */
export function frameSizeFromText(text: string): { width: number; height: number } | undefined {
  const m = /(?<!\d)(\d{3,5})\s*[x×]\s*(\d{3,5})(?!\d)/.exec(text);
  if (!m) return undefined;
  const width = Number(m[1]);
  const height = Number(m[2]);
  return width >= 160 && height >= 120 ? { width, height } : undefined;
}

/** "3840 × 2160", or undefined. */
export function formatSize(width?: number, height?: number): string | undefined {
  return width && height ? `${width} × ${height}` : undefined;
}
