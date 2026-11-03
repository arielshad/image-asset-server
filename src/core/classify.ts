/**
 * Turn a image's words (title, tags, the source's own collections or keywords)
 * into one of our categories and styles, with a confidence.
 *
 * Rules only, no model: phrases from src/core/vocab.ts are matched longest
 * first ("earth from space" beats "earth", "light leak" beats "light"), each
 * field has a weight, and deeper categories win ties.
 */
import { CATEGORY_DEFS, STYLE_ALIASES, IMAGE_STYLES, type Category, type ImageStyle } from "./vocab.js";

export interface ClassifyInput {
  title: string;
  tags?: string[];
  /** The source's own category labels or keywords, e.g. NASA keywords or an Internet Archive collection. */
  sourceCategories?: string[];
  description?: string;
}

export interface Classification {
  category: Category;
  confidence: number;
  styles: ImageStyle[];
}

/**
 * Context words that cancel an alias in the same field: "water" in a
 * "watercolor" is not a river, "earth" on "Earth Day" is not space.
 */
const NOT_IN_CONTEXT: Record<string, string[]> = {
  "space.earth": ["day", "soil", "dirt", "mud"],
  "nature.water": ["bottle", "glass", "drinking", "color", "colour", "watercolor", "watercolour"],
  "archive.poster": ["bed", "frame"],
  "people.lifestyle": ["robot"],
  "space.planets": ["sunflower", "sunflowers", "sunglasses", "sunday"],
};

const PRIORITY: Record<string, number> = { icons: 1.6, "archive.map": 1.5, "archive.poster": 1.3, "art.painting": 1.3, "art.drawing": 1.2, animals: 1.3, background: 1.2 };

const FIELD_WEIGHTS = { source: 1.3, title: 1.0, tags: 0.7, description: 0.25 } as const;
type Field = keyof typeof FIELD_WEIGHTS;

/** Split text into lowercase word tokens, also splitting camelCase and letter/digit runs ("Earth4K" → earth 4 k). */
export function wordTokens(text: string): string[] {
  return text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .replace(/(\d)([A-Za-z])/g, "$1 $2")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}&']+/gu, " ")
    .replace(/'/g, "")
    .split(" ")
    .filter(Boolean);
}

export interface Alias {
  words: string[];
  target: string;
}

function buildAliases(): Alias[] {
  const out: Alias[] = [];
  for (const def of CATEGORY_DEFS) for (const a of def.aliases) out.push({ words: wordTokens(a), target: def.id });
  // Longest phrases first so they consume their words before shorter aliases see them.
  return out.sort((a, b) => b.words.length - a.words.length);
}
const CATEGORY_ALIASES = buildAliases();

export const STYLE_ALIAS_LIST: Alias[] = IMAGE_STYLES.flatMap((style) => STYLE_ALIASES[style].map((a) => ({ words: wordTokens(a), target: style }))).sort(
  (a, b) => b.words.length - a.words.length,
);

/** Find which alias targets occur in `tokens`, longest match first, each token used once. */
export function matchAliases(tokens: string[], aliases: Alias[] = CATEGORY_ALIASES): Set<string> {
  return new Set(matchAliasPositions(tokens, aliases).keys());
}

/** Like matchAliases, with the last token position of each target (later words are the head noun: "ocean sunset"). */
export function matchAliasPositions(tokens: string[], aliases: Alias[] = CATEGORY_ALIASES): Map<string, number> {
  const used = new Array<boolean>(tokens.length).fill(false);
  const hits = new Map<string, number>();
  for (const alias of aliases) {
    const n = alias.words.length;
    for (let i = 0; i + n <= tokens.length; i++) {
      let ok = true;
      for (let j = 0; j < n; j++) {
        if (used[i + j] || tokens[i + j] !== alias.words[j]) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      hits.set(alias.target, Math.max(hits.get(alias.target) ?? -1, i + n - 1));
      for (let j = 0; j < n; j++) used[i + j] = true;
    }
  }
  return hits;
}

function depth(id: string): number {
  return id.split(".").length - 1;
}

function scoreCategories(fields: Partial<Record<Field, string[]>>): Map<string, number> {
  const scores = new Map<string, number>();
  for (const [field, values] of Object.entries(fields) as [Field, string[]][]) {
    if (!values?.length) continue;
    const fieldHits = new Map<string, number>();
    for (const v of values) {
      const tokens = wordTokens(v);
      const present = new Set(tokens);
      for (const [h, pos] of matchAliasPositions(tokens)) {
        if (NOT_IN_CONTEXT[h]?.some((w) => present.has(w))) continue;
        // A tiny bonus for words nearer the start: titles name the subject first ("Ocean waves at sunset").
        fieldHits.set(h, Math.max(fieldHits.get(h) ?? 0, 0.01 * (1 - pos / Math.max(tokens.length, 1))));
      }
    }
    for (const [h, bonus] of fieldHits) {
      scores.set(h, (scores.get(h) ?? 0) + FIELD_WEIGHTS[field] + (FIELD_WEIGHTS[field] >= 1 ? bonus : 0));
    }
  }
  // Some categories say more than what else is in the picture: an "icon of a
  // city" is an icon, a "map of the coast" is a map, a "painting of a harbour"
  // is a painting.
  for (const [id, k] of Object.entries(PRIORITY)) if (scores.has(id)) scores.set(id, scores.get(id)! * k);
  // A child that scored lends its weight to its parent, so "beach" also means "nature".
  for (const [id, s] of [...scores]) {
    const parts = id.split(".");
    for (let i = parts.length - 1; i > 0; i--) {
      const parent = parts.slice(0, i).join(".");
      scores.set(parent, Math.max(scores.get(parent) ?? 0, s * 0.8));
    }
  }
  return scores;
}

export function classify(input: ClassifyInput): Classification {
  const scores = scoreCategories({
    source: input.sourceCategories,
    title: [input.title],
    tags: input.tags,
    description: input.description ? [input.description.slice(0, 400)] : undefined,
  });

  let best: string | undefined;
  let bestScore = 0;
  for (const [id, s] of scores) {
    const ranked = s + 0.15 * depth(id);
    const current = best === undefined ? -1 : bestScore + 0.15 * depth(best);
    if (ranked > current) {
      best = id;
      bestScore = s;
    }
  }

  let confidence = 0;
  if (best) {
    let rival = 0;
    for (const [id, s] of scores) {
      if (id === best || best.startsWith(`${id}.`)) continue;
      rival = Math.max(rival, s);
    }
    confidence = round(Math.min(1, bestScore / 1.3) * (bestScore / (bestScore + rival)));
  }
  return { category: (best ?? "other") as Category, confidence, styles: inferStyles(input) };
}

/** Styles named in the title, tags or source keywords (descriptions are too chatty to trust). */
export function inferStyles(input: Pick<ClassifyInput, "title" | "tags" | "sourceCategories">): ImageStyle[] {
  const words = [input.title, ...(input.tags ?? []), ...(input.sourceCategories ?? [])].join(" | ");
  const hits = matchAliases(wordTokens(words), STYLE_ALIAS_LIST);
  return IMAGE_STYLES.filter((s) => hits.has(s));
}

/** All categories the words point at (for query hints), most specific first. */
export function categoriesIn(text: string): Category[] {
  return [...matchAliases(wordTokens(text))].sort((a, b) => depth(b) - depth(a)) as Category[];
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
