import type { Category, ImageStyle } from "../core/vocab.js";

/**
 * The category of a museum object. A museum's own classification is more
 * reliable than the words in a title: Van Gogh's "Sunflowers" is a painting
 * first, flowers second (the subject stays searchable through the tags).
 * Photographs are left to the classifier, since what they show matters more
 * than the medium.
 */
export function museumCategory(styles: ImageStyle[] | undefined, ...words: (string | undefined | null)[]): Category | undefined {
  if (styles?.includes("painting")) return "art.painting";
  if (styles?.includes("drawing")) return "art.drawing";
  if (styles?.includes("photo")) return undefined;
  const text = words.filter(Boolean).join(" ").toLowerCase();
  if (/\bmaps?\b|atlas/.test(text)) return "archive.map";
  if (/sculpt|statue|ceramic|porcelain|pottery|vase|jar|vessel|textile|tapestry|armou?r|arms|metalwork|jewel|furniture|glass|decorative|bronze|silver|ivory|lacquer|costume/.test(text)) return "art.sculpture";
  return "art";
}
