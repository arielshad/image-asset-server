/**
 * schema.org JSON-LD builders. Every page gets WebSite + Organization (via
 * the layout); pages add their own (SoftwareApplication, WebAPI, FAQPage,
 * TechArticle, BreadcrumbList, ItemList).
 */
import { CATALOG } from "./catalog";
import { MCP_URL, ORG, PROVIDERS, SITE } from "./site";

const abs = (path: string) => new URL(path, SITE.url).toString();
const ORG_ID = `${SITE.url}/#organization`;
const SITE_ID = `${SITE.url}/#website`;
const APP_ID = `${SITE.url}/#app`;

export type JsonLd = Record<string, unknown>;

/**
 * Organization with its contact point. `email` and `address` come from
 * src/data/organization.json and are only emitted when filled in, so the
 * markup never claims contact details that don't exist.
 */
export const organization = (): JsonLd => ({
  "@type": "Organization",
  "@id": ORG_ID,
  name: ORG.name,
  url: ORG.url,
  logo: abs("/icon-512.png"),
  sameAs: [SITE.repo],
  contactPoint: [
    {
      "@type": "ContactPoint",
      contactType: "customer support",
      url: ORG.contactUrl,
      availableLanguage: ["en"],
      ...(ORG.email ? { email: ORG.email } : {}),
    },
    { "@type": "ContactPoint", contactType: "technical support", url: ORG.issuesUrl, availableLanguage: ["en"] },
  ],
  ...(ORG.address ? { address: { "@type": "PostalAddress", ...ORG.address } } : {}),
});

export const aboutPage = (a: { title: string; description: string; path: string; type: "AboutPage" | "ContactPage" | "WebPage" }): JsonLd => ({
  "@type": a.type,
  name: a.title,
  description: a.description,
  url: abs(a.path),
  inLanguage: "en",
  isPartOf: { "@id": SITE_ID },
  about: { "@id": a.type === "AboutPage" ? APP_ID : ORG_ID },
  publisher: { "@id": ORG_ID },
});

export const website = (): JsonLd => ({
  "@type": "WebSite",
  "@id": SITE_ID,
  url: SITE.url,
  name: SITE.name,
  description: SITE.description,
  inLanguage: "en",
  publisher: { "@id": ORG_ID },
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: `${SITE.url}/search?q={search_term_string}` },
    "query-input": "required name=search_term_string",
  },
});

export const softwareApplication = (): JsonLd => ({
  "@type": "WebApplication",
  "@id": APP_ID,
  name: SITE.name,
  url: SITE.url,
  description: SITE.description,
  applicationCategory: "DeveloperApplication",
  applicationSubCategory: "Free image search",
  operatingSystem: "Any (web browser, HTTP API, MCP)",
  browserRequirements: "Requires JavaScript for live search",
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    `Searches ${PROVIDERS.length} image sites at once (NASA, The Met, Art Institute of Chicago, Cleveland Museum of Art, Library of Congress, Wikimedia Commons, Iconify, Openverse and deep links into Unsplash, Pexels, Pixabay and more)`,
    "Photos, public-domain art, maps, illustrations, SVG vectors and icons, with size, orientation, format, transparency and kind filters",
    "See every image in the browser, loaded straight from the source",
    "A commercial-use verdict, editorial flag and ready-to-paste credit line for every image",
    "Image set builder: a list of slots in, one licence-checked image per slot out (images.json, HTML with credit captions, download script)",
    "REST API with OpenAPI 3.1 description",
    "Model Context Protocol (MCP) server for AI coding agents",
  ],
  softwareHelp: { "@type": "CreativeWork", url: abs("/docs") },
  codeRepository: SITE.repo,
  license: "https://www.apache.org/licenses/LICENSE-2.0",
  publisher: { "@id": ORG_ID },
});

export const webApi = (): JsonLd => ({
  "@type": "WebAPI",
  "@id": `${SITE.url}/#api`,
  name: `${SITE.name} API`,
  description: "REST and MCP API to search and download free images (photos, museum art, maps, SVG vectors and icons) from many sources, with a licence verdict for commercial use.",
  url: abs("/docs/api"),
  documentation: abs("/docs/api/reference"),
  termsOfService: SITE.repo,
  provider: { "@id": ORG_ID },
  isAccessibleForFree: true,
  potentialAction: { "@type": "SearchAction", target: `${SITE.url}/v1/search?q={query}` },
  subjectOf: [
    { "@type": "DigitalDocument", name: "OpenAPI 3.1 description", encodingFormat: "application/json", url: abs("/openapi.json") },
    { "@type": "DigitalDocument", name: "MCP endpoint (Streamable HTTP)", url: MCP_URL },
  ],
});

export const faqPage = (items: { q: string; a: string }[]): JsonLd => ({
  "@type": "FAQPage",
  mainEntity: items.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } })),
});

export const breadcrumbs = (trail: { name: string; path: string }[]): JsonLd => ({
  "@type": "BreadcrumbList",
  itemListElement: trail.map((t, i) => ({ "@type": "ListItem", position: i + 1, name: t.name, item: abs(t.path) })),
});

export const techArticle = (a: { title: string; description: string; path: string }): JsonLd => ({
  "@type": "TechArticle",
  headline: a.title,
  description: a.description,
  url: abs(a.path),
  mainEntityOfPage: abs(a.path),
  inLanguage: "en",
  isPartOf: { "@id": SITE_ID },
  about: { "@id": APP_ID },
  publisher: { "@id": ORG_ID },
  dateModified: new Date().toISOString().slice(0, 10),
  proficiencyLevel: "Beginner",
});

export const sourcesList = (): JsonLd => ({
  "@type": "ItemList",
  name: "Video sources searched by Image Asset Server",
  numberOfItems: PROVIDERS.length,
  itemListElement: PROVIDERS.map((p, i) => ({
    "@type": "ListItem",
    position: i + 1,
    item: { "@type": "WebSite", name: p.name, url: p.homepage, description: p.description },
  })),
});

/** The daily catalog census as a schema.org Dataset (for dataset search and citation). */
export const catalogDataset = (): JsonLd => ({
  "@type": "Dataset",
  "@id": `${SITE.url}/stats#catalog`,
  name: "Image Asset Server catalog census",
  description:
    "Daily counts of the images held by the sites Image Asset Server searches: listings per source, by category (nature, art, space, archive, icons and more) and licence, free and CC0 counts, and additions in the last 30 days.",
  url: abs("/stats"),
  isAccessibleForFree: true,
  creator: { "@id": ORG_ID },
  publisher: { "@id": ORG_ID },
  dateModified: CATALOG.countedAt,
  temporalCoverage: `${CATALOG.countedAt.slice(0, 10)}/..`,
  keywords: ["free images", "stock photos", "public domain art", "CC0", "NASA images", "museum open access", "SVG icons"],
  variableMeasured: ["image listings", "free listings", "CC0 listings", "listings by category", "listings per source", "listings released in the last 30 days"],
  distribution: [
    { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: abs("/catalog.json"), name: "Latest census" },
    { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: abs("/catalog-history.json"), name: "Daily history" },
  ],
});

/**
 * A guide: Article with the short answer as its abstract, dated, credited to
 * the organisation, citing the licences and documents it relies on.
 */
export const article = (a: {
  title: string;
  description: string;
  path: string;
  answer: string;
  section: string;
  published: Date;
  updated: Date;
  cites?: { name: string; url: string }[];
  about?: string[];
  words?: number;
}): JsonLd => ({
  "@type": "Article",
  "@id": `${abs(a.path)}#article`,
  headline: a.title,
  description: a.description,
  abstract: a.answer,
  url: abs(a.path),
  mainEntityOfPage: abs(a.path),
  inLanguage: "en",
  articleSection: a.section,
  isPartOf: { "@id": SITE_ID },
  author: { "@id": ORG_ID },
  publisher: { "@id": ORG_ID },
  datePublished: a.published.toISOString().slice(0, 10),
  dateModified: a.updated.toISOString().slice(0, 10),
  isAccessibleForFree: true,
  ...(a.words ? { wordCount: a.words } : {}),
  ...(a.about?.length ? { about: a.about.map((name) => ({ "@type": "Thing", name })) } : {}),
  ...(a.cites?.length ? { citation: a.cites.map((c) => ({ "@type": "CreativeWork", name: c.name, url: c.url })) } : {}),
});

/** Step-by-step instructions (guides with `steps`). */
export const howTo = (h: { title: string; description: string; path: string; steps: { name: string; text: string }[] }): JsonLd => ({
  "@type": "HowTo",
  "@id": `${abs(h.path)}#howto`,
  name: h.title,
  description: h.description,
  url: abs(h.path),
  inLanguage: "en",
  step: h.steps.map((s, i) => ({ "@type": "HowToStep", position: i + 1, name: s.name, text: s.text, url: `${abs(h.path)}#step-${i + 1}` })),
});

/** The glossary: a DefinedTermSet whose terms have stable fragment ids (/glossary#b-roll). */
export const definedTermSet = (g: { title: string; description: string; path: string; terms: { id: string; term: string; definition: string; aliases?: string[]; url?: string }[] }): JsonLd => ({
  "@type": "DefinedTermSet",
  "@id": `${abs(g.path)}#terms`,
  name: g.title,
  description: g.description,
  url: abs(g.path),
  inLanguage: "en",
  publisher: { "@id": ORG_ID },
  hasDefinedTerm: g.terms.map((t) => ({
    "@type": "DefinedTerm",
    "@id": `${abs(g.path)}#${t.id}`,
    name: t.term,
    description: t.definition,
    termCode: t.id,
    url: `${abs(g.path)}#${t.id}`,
    inDefinedTermSet: { "@id": `${abs(g.path)}#terms` },
    ...(t.aliases?.length ? { alternateName: t.aliases } : {}),
    ...(t.url ? { sameAs: t.url } : {}),
  })),
});

/** An image source on its own page: the site as a WebSite run by its organisation. */
export const sourceEntity = (p: { id: string; name: string; homepage: string; description: string; license?: string | null; free: boolean }): JsonLd => ({
  "@type": "WebSite",
  "@id": `${abs(`/sources/${p.id}`)}#source`,
  name: p.name,
  url: p.homepage,
  description: p.description,
  isAccessibleForFree: p.free,
  ...(p.license ? { license: p.license } : {}),
  publisher: { "@type": "Organization", name: p.name, url: p.homepage },
});

/** Node types that describe the page itself (they get the share image). */
const PAGE_TYPES = new Set(["WebPage", "AboutPage", "ContactPage", "TechArticle", "Article", "CollectionPage", "SearchResultsPage", "FAQPage"]);
/** Article types take `image` but not `primaryImageOfPage` (a WebPage property). */
const ARTICLE_TYPES = new Set(["TechArticle", "Article"]);

export interface PageMeta {
  url: string;
  name: string;
  description: string;
  /** Absolute URL of the page's 1200×630 share card. */
  image: string;
  imageAlt: string;
}

/**
 * Wrap page nodes + the site-wide ones in a single @graph. The page's share
 * card is attached as an ImageObject: `primaryImageOfPage` + `image` on the
 * node that describes the page, or on a WebPage node added for pages that
 * have none (e.g. the home page, whose nodes describe the app and API).
 */
export const graph = (nodes: JsonLd[], page?: PageMeta): string => {
  let out = nodes;
  if (page) {
    const image = { "@type": "ImageObject", "@id": `${page.url}#primaryimage`, url: page.image, contentUrl: page.image, width: 1200, height: 630, caption: page.imageAlt };
    const i = nodes.findIndex((n) => PAGE_TYPES.has(String(n["@type"])) && n["@type"] !== "FAQPage");
    if (i >= 0) {
      out = nodes.map((n, j) => (j === i ? { ...n, image: { "@id": image["@id"] }, ...(ARTICLE_TYPES.has(String(n["@type"])) ? {} : { primaryImageOfPage: { "@id": image["@id"] } }) } : n));
    } else {
      out = [
        { "@type": "WebPage", "@id": `${page.url}#webpage`, url: page.url, name: page.name, description: page.description, inLanguage: "en", isPartOf: { "@id": SITE_ID }, primaryImageOfPage: { "@id": image["@id"] }, image: { "@id": image["@id"] } },
        ...nodes,
      ];
    }
    out = [...out, image];
  }
  return JSON.stringify({ "@context": "https://schema.org", "@graph": [website(), organization(), ...out] }).replace(/</g, "\\u003c");
};

interface ListedImage {
  id: string;
  provider: string;
  title: string;
  url: string;
  thumbnailUrl?: string;
  previewUrl?: string;
  author?: string;
  license?: { name: string; url?: string };
  free?: boolean;
  width?: number;
  height?: number;
  year?: number;
}

/**
 * One image in a collection's ItemList: an ImageObject credited to its
 * source. `contentUrl` is the display-size file on the source, `thumbnailUrl`
 * the grid thumbnail the page shows; neither is made up when missing.
 */
const listedImage = (a: ListedImage, providers: { id: string; name: string; homepage: string }[]): JsonLd => {
  const source = providers.find((p) => p.id === a.provider);
  return {
    "@type": "ImageObject",
    name: a.title,
    url: a.url,
    ...(a.thumbnailUrl ? { thumbnailUrl: a.thumbnailUrl } : {}),
    ...(a.previewUrl ?? a.thumbnailUrl ? { contentUrl: a.previewUrl ?? a.thumbnailUrl } : {}),
    ...(a.width && a.height ? { width: a.width, height: a.height } : {}),
    ...(a.year ? { dateCreated: String(a.year) } : {}),
    ...(a.author ? { creator: { "@type": "Person", name: a.author }, creditText: a.author } : {}),
    ...(a.license ? { license: a.license.url ?? a.license.name, acquireLicensePage: a.url } : {}),
    ...(a.free !== undefined ? { isAccessibleForFree: a.free } : {}),
    ...(source ? { provider: { "@type": "Organization", name: source.name, url: source.homepage } } : {}),
  };
};

/**
 * A curated collection (or hub, or source page): CollectionPage whose main
 * entity is an ItemList of its images or of the collections it groups.
 */
export const collectionPage = (c: {
  title: string;
  description: string;
  path: string;
  dateModified?: Date;
  about?: string[];
  images?: ListedImage[];
  links?: { name: string; path: string }[];
}): JsonLd => {
  const url = abs(c.path);
  const items = c.images
    ? c.images.map((a, i) => ({ "@type": "ListItem", position: i + 1, item: listedImage(a, PROVIDERS) }))
    : (c.links ?? []).map((l, i) => ({ "@type": "ListItem", position: i + 1, name: l.name, url: abs(l.path) }));
  return {
    "@type": "CollectionPage",
    "@id": `${url}#page`,
    name: c.title,
    description: c.description,
    url,
    inLanguage: "en",
    isPartOf: { "@id": SITE_ID },
    publisher: { "@id": ORG_ID },
    ...(c.dateModified ? { dateModified: c.dateModified.toISOString() } : {}),
    ...(c.about?.length ? { about: c.about.map((name) => ({ "@type": "Thing", name })) } : {}),
    mainEntity: { "@type": "ItemList", numberOfItems: items.length, itemListElement: items },
  };
};
