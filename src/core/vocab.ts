/**
 * The one place the image vocabulary lives: categories, styles (kind and
 * look), orientations, size tiers and the words that point at them. The server, scripts and
 * web UI all import from here (the web build reads it from dist/), so the
 * lists never drift apart.
 */

export interface CategoryDef {
  id: string;
  label: string;
  /** Words (lowercase, matched as whole tokens or phrases) that suggest this category. */
  aliases: string[];
}

/**
 * Dot-path categories. A parent ("nature") matches every child ("nature.ocean").
 * Order matters for classification ties: more specific entries come after their parent.
 */
export const CATEGORY_DEFS = [
  { id: "nature", label: "Nature & landscapes", aliases: ["nature", "landscape", "landscapes", "landscape scenery", "scenery", "outdoors", "wilderness", "natural", "landscape photo", "national park"] },
  { id: "nature.ocean", label: "Ocean & beach", aliases: ["ocean", "sea", "beach", "waves", "wave", "surf", "coast", "shore", "seaside", "underwater", "coral", "reef", "seascape"] },
  { id: "nature.water", label: "Rivers & lakes", aliases: ["river", "waterfall", "waterfalls", "lake", "stream", "rain", "raindrops", "pond", "creek", "water"] },
  { id: "nature.sky", label: "Sky & weather", aliases: ["sky", "clouds", "cloud", "sunset", "sunsets", "sunrise", "dawn", "dusk", "golden hour", "storm", "lightning", "aurora", "northern lights", "rainbow", "fog", "mist"] },
  { id: "nature.forest", label: "Forest & trees", aliases: ["forest", "woods", "trees", "tree", "jungle", "rainforest", "leaves", "leaf", "autumn", "fall foliage", "moss"] },
  { id: "nature.plants", label: "Flowers & plants", aliases: ["flowers", "flower", "plants", "plant", "botanical", "botany", "rose", "roses", "tulip", "tulips", "sunflower", "sunflowers", "orchid", "cactus", "succulent", "garden", "bouquet", "blossom"] },
  { id: "nature.mountain", label: "Mountains & snow", aliases: ["mountain", "mountains", "snow", "snowy", "winter", "glacier", "ice", "volcano", "canyon", "desert", "dunes", "hills", "valley", "alps"] },
  { id: "animals", label: "Animals & wildlife", aliases: ["animal", "animals", "wildlife", "bird", "birds", "dog", "dogs", "puppy", "cat", "cats", "kitten", "horse", "horses", "fish", "insect", "insects", "bee", "bees", "butterfly", "butterflies", "whale", "lion", "tiger", "elephant", "deer", "bear", "fox", "owl", "pet", "pets", "zoo"] },
  { id: "city", label: "Cities & streets", aliases: ["city", "urban", "downtown", "town", "metropolis", "street", "streets", "traffic", "crosswalk", "sidewalk", "street photography"] },
  { id: "city.skyline", label: "Skylines", aliases: ["skyline", "skyscraper", "skyscrapers", "cityscape", "city lights", "city at night", "night city"] },
  { id: "architecture", label: "Architecture & interiors", aliases: ["architecture", "building", "buildings", "house", "houses", "church", "cathedral", "temple", "castle", "bridge", "tower", "facade", "interior", "interiors", "room", "living room", "bedroom", "staircase", "monument", "landmark", "ruins"] },
  { id: "people", label: "People & portraits", aliases: ["people", "person", "man", "woman", "men", "women", "child", "children", "kids", "family", "friends", "portrait", "portraits", "face", "faces", "hands", "crowd", "selfie", "headshot"] },
  { id: "people.work", label: "Work & business", aliases: ["business", "office", "meeting", "teamwork", "working", "worker", "workers", "laptop", "startup", "coworking", "presentation", "desk", "workspace", "entrepreneur"] },
  { id: "people.lifestyle", label: "Lifestyle & travel", aliases: ["lifestyle", "travel", "traveler", "tourist", "vacation", "holiday", "shopping", "yoga", "fitness", "workout", "wedding", "party", "celebration", "home", "relaxing"] },
  { id: "people.sport", label: "Sport", aliases: ["sport", "sports", "football", "soccer", "basketball", "tennis", "surfing", "skateboard", "skiing", "cycling", "bike", "swimming", "athlete", "athletes", "running", "baseball", "golf"] },
  { id: "food", label: "Food & drink", aliases: ["food", "drink", "drinks", "coffee", "tea", "kitchen", "restaurant", "meal", "breakfast", "lunch", "dinner", "fruit", "fruits", "vegetables", "wine", "beer", "cocktail", "baking", "bread", "cake", "pizza", "dessert"] },
  { id: "objects", label: "Objects & still life", aliases: ["object", "objects", "still life", "flat lay", "flatlay", "product", "products", "mockup", "isolated", "cutout", "vase", "book", "books", "chair", "furniture", "camera", "clock", "toy", "toys", "jewelry", "fashion", "clothing", "shoes"] },
  { id: "tech", label: "Technology", aliases: ["technology", "tech", "computer", "computers", "screen", "code", "coding", "programming", "data", "server", "servers", "circuit", "robot", "robots", "ai", "smartphone", "phone", "digital", "network", "cyber", "electronics"] },
  { id: "transport", label: "Transport", aliases: ["car", "cars", "train", "trains", "railway", "plane", "planes", "airplane", "aircraft", "airport", "ship", "ships", "boat", "boats", "truck", "bus", "subway", "metro", "bicycle", "motorcycle"] },
  { id: "space", label: "Space & astronomy", aliases: ["space", "outer space", "cosmos", "universe", "galaxy", "galaxies", "nebula", "stars", "starfield", "astronomy", "milky way", "telescope", "hubble", "webb", "jwst"] },
  { id: "space.earth", label: "Earth from space", aliases: ["earth from space", "planet earth", "globe", "orbit", "iss", "space station", "international space station", "satellite image", "satellite view"] },
  { id: "space.missions", label: "Rockets & astronauts", aliases: ["launch", "rocket", "rockets", "liftoff", "shuttle", "space shuttle", "spacecraft", "astronaut", "astronauts", "spacewalk", "apollo", "artemis", "rover"] },
  { id: "space.planets", label: "Sun, moon & planets", aliases: ["sun", "solar", "moon", "lunar", "mars", "jupiter", "saturn", "venus", "mercury", "neptune", "uranus", "pluto", "planet", "planets", "eclipse", "asteroid", "comet", "black hole"] },
  { id: "science", label: "Science & medicine", aliases: ["science", "scientific", "laboratory", "lab", "microscope", "microscopic", "cells", "cell", "dna", "molecule", "chemistry", "physics", "biology", "anatomy", "medical", "medicine", "health", "doctor", "hospital", "fossil", "dinosaur", "specimen"] },
  { id: "art", label: "Art", aliases: ["art", "artwork", "artworks", "fine art", "masterpiece", "museum", "gallery", "old master", "old masters"] },
  { id: "art.painting", label: "Paintings", aliases: ["painting", "paintings", "oil painting", "oil on canvas", "watercolor", "watercolour", "canvas", "impressionism", "impressionist", "landscape painting", "portrait painting", "fresco", "tempera"] },
  { id: "art.drawing", label: "Drawings & prints", aliases: ["drawing", "drawings", "sketch", "sketches", "etching", "engraving", "woodcut", "lithograph", "print", "prints", "ukiyo e", "ukiyo-e", "woodblock", "pen and ink", "charcoal"] },
  { id: "art.sculpture", label: "Sculpture & objects", aliases: ["sculpture", "sculptures", "statue", "statues", "bust", "ceramic", "ceramics", "pottery", "porcelain", "vase", "armor", "armour", "textile", "tapestry", "decorative art"] },
  { id: "archive", label: "History & archives", aliases: ["history", "historic", "historical", "vintage", "archive", "archival", "old photo", "old photograph", "retro", "antique", "19th century", "victorian", "civil war", "world war", "ww2", "wwii", "daguerreotype"] },
  { id: "archive.map", label: "Maps", aliases: ["map", "maps", "atlas", "chart", "cartography", "old map", "antique map", "globe map"] },
  { id: "archive.poster", label: "Posters & ephemera", aliases: ["poster", "posters", "advertisement", "ad", "ephemera", "postcard", "postcards", "label", "magazine cover", "book cover", "propaganda"] },
  { id: "background", label: "Backgrounds & textures", aliases: ["background", "backgrounds", "backdrop", "wallpaper", "wallpapers", "texture", "textures", "pattern", "patterns", "gradient", "abstract", "bokeh", "paper texture", "wood texture", "marble"] },
  { id: "icons", label: "Icons & symbols", aliases: ["icon", "icons", "symbol", "symbols", "logo", "logos", "glyph", "glyphs", "emoji", "pictogram", "ui icon", "favicon"] },
  { id: "other", label: "Other", aliases: [] },
] as const satisfies readonly CategoryDef[];

export type Category = (typeof CATEGORY_DEFS)[number]["id"];
export const CATEGORIES = CATEGORY_DEFS.map((c) => c.id) as Category[];
export const TOP_CATEGORIES = CATEGORIES.filter((c) => !c.includes(".")) as Category[];

const CATEGORY_SET = new Set<string>(CATEGORIES);
export function isCategory(s: string): s is Category {
  return CATEGORY_SET.has(s);
}

export function categoryLabel(id: string): string {
  return CATEGORY_DEFS.find((c) => c.id === id)?.label ?? id;
}

/** "nature.ocean" -> "nature" */
export function topCategory(id: string): Category {
  return (id.split(".")[0] ?? "other") as Category;
}

/** Does a image in `category` satisfy the `wanted` filter? Parents match their children. */
export function categoryMatches(category: string | undefined, wanted?: readonly string[]): boolean {
  if (!wanted?.length) return true;
  if (!category) return false;
  return wanted.some((w) => category === w || category.startsWith(`${w}.`));
}

/**
 * What kind of image it is and how it looks, independent of what it shows:
 * - photo:        a photograph
 * - illustration: drawn or rendered digital art (not a museum drawing)
 * - painting:     a painting (oil, watercolour, tempera…)
 * - drawing:      a drawing, print, etching or engraving
 * - vector:       scalable vector art (SVG)
 * - icon:         a small symbol from an icon set
 * - transparent:  has a transparent background (PNG/SVG cut-outs and icons)
 * - black-white:  black-and-white or monochrome
 */
export const IMAGE_STYLES = ["photo", "illustration", "painting", "drawing", "vector", "icon", "transparent", "black-white"] as const;
export type ImageStyle = (typeof IMAGE_STYLES)[number];

export const STYLE_ALIASES: Record<ImageStyle, string[]> = {
  photo: ["photo", "photos", "photograph", "photographs", "photography", "photographic", "picture", "pictures", "snapshot"],
  illustration: ["illustration", "illustrations", "illustrated", "clipart", "clip art", "cartoon", "cartoons", "digital art", "graphic", "graphics", "infographic"],
  painting: ["painting", "paintings", "oil painting", "oil on canvas", "watercolor", "watercolour", "painted", "acrylic", "gouache", "tempera"],
  drawing: ["drawing", "drawings", "sketch", "sketches", "etching", "engraving", "woodcut", "lithograph", "pen and ink", "charcoal", "line art", "line drawing"],
  vector: ["vector", "vectors", "svg", "eps", "scalable"],
  icon: ["icon", "icons", "glyph", "glyphs", "pictogram", "pictograms"],
  transparent: ["transparent", "transparent background", "no background", "png cutout", "cutout", "cut out", "isolated on transparent", "alpha"],
  "black-white": ["black and white", "black & white", "b&w", "bw", "monochrome", "grayscale", "greyscale"],
};

export const STYLE_LABELS: Record<ImageStyle, string> = {
  photo: "Photo",
  illustration: "Illustration",
  painting: "Painting",
  drawing: "Drawing / print",
  vector: "Vector (SVG)",
  icon: "Icon",
  transparent: "Transparent background",
  "black-white": "Black & white",
};

export const ORIENTATIONS = ["landscape", "portrait", "square"] as const;
export type Orientation = (typeof ORIENTATIONS)[number];

export const ORIENTATION_ALIASES: Record<Orientation, string[]> = {
  landscape: ["landscape orientation", "horizontal", "widescreen", "16:9", "16x9", "banner", "hero image", "header image", "desktop wallpaper", "cover photo"],
  portrait: ["portrait orientation", "vertical", "9:16", "9x16", "phone wallpaper", "mobile wallpaper", "pinterest", "stories", "story", "instagram story", "poster size"],
  square: ["square", "1:1", "1x1", "avatar", "profile picture", "instagram post"],
};

/** Width/height → orientation (within 5% of square counts as square). */
export function orientationOf(width?: number, height?: number): Orientation | undefined {
  if (!width || !height) return undefined;
  const r = width / height;
  if (r > 1.05) return "landscape";
  if (r < 0.95) return "portrait";
  return "square";
}

/**
 * Size tiers, by the short side of the image (a 2160×3840 phone wallpaper is
 * "4K", the same as a 3840×2160 desktop one). Vectors and icons scale to any
 * size and count as the top tier.
 */
export const RESOLUTIONS = [
  { id: "sd", label: "Small", minShortSide: 0 },
  { id: "hd", label: "Medium 720+", minShortSide: 720 },
  { id: "fhd", label: "Large 1080+", minShortSide: 1080 },
  { id: "qhd", label: "XL 1440+", minShortSide: 1440 },
  { id: "uhd", label: "4K+ 2160+", minShortSide: 2160 },
] as const;
export type ResolutionTier = (typeof RESOLUTIONS)[number]["id"];

/** Short side in pixels. */
export function shortSide(width?: number, height?: number): number | undefined {
  if (!width || !height) return undefined;
  return Math.min(width, height);
}

/** The tier a frame size reaches. 3% slack so 1920×1050 is still "1080+". */
export function resolutionTier(width?: number, height?: number): ResolutionTier | undefined {
  const s = shortSide(width, height);
  if (s === undefined) return undefined;
  let tier: ResolutionTier = "sd";
  for (const r of RESOLUTIONS) if (s >= r.minShortSide * 0.97) tier = r.id;
  return tier;
}

export function resolutionLabel(width?: number, height?: number): string | undefined {
  const t = resolutionTier(width, height);
  return t ? RESOLUTIONS.find((r) => r.id === t)!.label : undefined;
}

/** Megapixels, one decimal ("24.2 MP"). */
export function megapixels(width?: number, height?: number): number | undefined {
  if (!width || !height) return undefined;
  return Math.round((width * height) / 100_000) / 10;
}

/** Image formats, the most widely usable first: the order downloads prefer. */
export const IMAGE_FORMATS = ["jpg", "png", "webp", "svg", "gif", "avif", "tif", "bmp"] as const;
export const OTHER_FORMATS = ["pdf", "zip", "json"] as const;

export const IMAGE_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  svg: "image/svg+xml",
  gif: "image/gif",
  avif: "image/avif",
  tif: "image/tiff",
  bmp: "image/bmp",
  pdf: "application/pdf",
};

/** Formats every modern browser shows in an <img> tag. */
export const BROWSER_DISPLAYABLE = new Set(["jpg", "png", "webp", "svg", "gif", "avif"]);
