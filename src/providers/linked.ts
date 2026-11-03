/**
 * Image sites we only deep-link to (checked 2026-11-03). Each is link-only
 * for a stated reason:
 *
 * - Unsplash, Pexels, Pixabay: good free APIs, but each needs a key we don't
 *   have yet, and their terms forbid using the API to build a "competing"
 *   or "similar" service. Kept link-only until we have keys and their
 *   blessing.
 * - Flickr: the API needs a key; its Creative Commons photos already reach
 *   us through Openverse.
 * - Smithsonian Open Access, Europeana, Rijksmuseum: open collections whose
 *   APIs need a key (api.data.gov, Europeana, Rijksmuseum data services).
 * - NYPL Digital Collections, National Gallery of Art, Internet Archive:
 *   no usable keyless image search API (token, CSV dumps only, or mostly
 *   uploader-asserted licences).
 * - Rawpixel, StockSnap, Burst, Vecteezy, Freepik: free tiers behind
 *   accounts, paid APIs, or terms against scraping and aggregation.
 * - Openclipart, SVG Repo, Flaticon, The Noun Project, unDraw: vector and
 *   icon sites without a keyless API, or with terms against bots (Iconify
 *   covers open-source icon sets directly).
 * - Shutterstock, Adobe Stock, Getty Images, iStock, Alamy: paid libraries
 *   with partner-only APIs.
 *
 * Every `buildSearchUrl` is the URL the site's own search produces. Where a
 * site has URL parameters for orientation or kind they are set.
 */
import { customLicense, license, royaltyFree } from "../core/licence.js";
import type { Category, ImageQuery, License } from "../core/types.js";
import { qs } from "../core/util.js";
import { linkProvider, linkTerms, slug, wantedKind } from "./link.js";

const ALL: Category[] = ["nature", "animals", "city", "architecture", "people", "food", "objects", "tech", "transport", "space", "science", "art", "archive", "background", "icons"];
const STOCK: Category[] = ["nature", "animals", "city", "architecture", "people", "food", "objects", "tech", "transport", "background"];
const MUSEUM: Category[] = ["art", "archive", "science", "nature", "animals", "people", "architecture"];
const VECTOR: Category[] = ["icons", "background", "objects", "people", "tech", "nature", "animals"];

const one = <T>(xs: T[] | undefined): T | undefined => (xs?.length === 1 ? xs[0] : undefined);

/** A paid stock library: commercial use once you buy the licence. */
function paidStock(name: string, url: string): License {
  return customLicense(`${name} licence (paid)`, {
    url,
    verdict: "clearance-required",
    commercialUse: true,
    note: "Royalty-free after you buy a licence for each image (or hold a subscription). Editorial-only images are marked on the site.",
  });
}

function mixed(name: string, url: string, note: string): License {
  return customLicense(name, { url, verdict: "check-terms", note });
}

const PD_MIX = "Mostly public domain or CC0, but each item states its own rights: check the item page.";

// ---------------------------------------------------------------------------
// Free stock photo sites (key needed, or terms against aggregation)
// ---------------------------------------------------------------------------

export const unsplash = linkProvider({
  id: "unsplash",
  name: "Unsplash",
  homepage: "https://unsplash.com",
  description:
    "Over 5 million high-resolution photos from a community of photographers; Unsplash licence (no credit needed). Link-only for now: its API needs a key and its terms forbid replicating Unsplash.",
  categories: STOCK,
  pricing: "freemium",
  apiKeyEnv: "UNSPLASH_ACCESS_KEY",
  license: royaltyFree("Unsplash License", {
    url: "https://unsplash.com/license",
    note: "Free for commercial use, no credit needed (appreciated). Don't sell unaltered copies or compile them into a competing service. Unsplash+ images need a subscription.",
  }),
  buildSearchUrl(q) {
    const s = slug(linkTerms(q, { orientation: false, resolution: false }));
    const o = one(q.orientations);
    const orientation = o === "square" ? "squarish" : o;
    return `${s ? `https://unsplash.com/s/photos/${s}` : "https://unsplash.com"}${qs({ orientation, license: q.freeOnly ? "free" : undefined })}`;
  },
});

export const pexels = linkProvider({
  id: "pexels",
  name: "Pexels",
  homepage: "https://www.pexels.com",
  description:
    "Millions of free stock photos, many of people and lifestyle; Pexels licence (no credit needed). Link-only for now: its API needs a key and its terms forbid competing services.",
  categories: STOCK,
  pricing: "free",
  apiKeyEnv: "PEXELS_API_KEY",
  license: royaltyFree("Pexels License", { url: "https://www.pexels.com/license/", note: "Free for commercial use, no credit needed. Don't sell unaltered copies, don't imply endorsement by people shown." }),
  buildSearchUrl(q) {
    const text = linkTerms(q, { orientation: false, resolution: false });
    const orientation = one(q.orientations);
    const size = q.minResolution ? (q.minResolution >= 2160 ? "large" : q.minResolution >= 1080 ? "medium" : "small") : undefined;
    const base = text ? `https://www.pexels.com/search/${encodeURIComponent(text)}/` : "https://www.pexels.com/";
    return `${base}${qs({ orientation, size })}`;
  },
});

export const pixabay = linkProvider({
  id: "pixabay",
  name: "Pixabay",
  homepage: "https://pixabay.com",
  description:
    "Over 5 million free photos, illustrations and vectors; Pixabay Content License (no credit needed). Link-only for now: its API needs a key and its terms limit automated use.",
  categories: [...STOCK, "icons"],
  pricing: "free",
  apiKeyEnv: "PIXABAY_API_KEY",
  license: royaltyFree("Pixabay Content License", { url: "https://pixabay.com/service/license-summary/", note: "Free for commercial use, no credit needed. Don't sell unaltered copies or redistribute them on stock sites." }),
  buildSearchUrl(q) {
    const text = linkTerms(q, { orientation: false });
    const kind = wantedKind(q);
    const section = kind === "vector" || kind === "icon" ? "vectors" : kind === "illustration" ? "illustrations" : kind === "photo" ? "photos" : "images";
    const o = one(q.orientations);
    const orientation = o === "landscape" ? "horizontal" : o === "portrait" ? "vertical" : undefined;
    return `${text ? `https://pixabay.com/${section}/search/${encodeURIComponent(text)}/` : `https://pixabay.com/${section}/`}${qs({ orientation })}`;
  },
});

export const flickr = linkProvider({
  id: "flickr",
  name: "Flickr (Creative Commons)",
  homepage: "https://www.flickr.com/creativecommons/",
  description:
    "Hundreds of millions of photos, over 500 million under Creative Commons or public domain. Link-only: the API needs a key, and Openverse already indexes Flickr's CC photos.",
  categories: ALL,
  pricing: "free",
  apiKeyEnv: "FLICKR_API_KEY",
  license: mixed("Per-photo licence (Flickr)", "https://www.flickr.com/creativecommons/", "Each photo has its own licence, from all rights reserved to CC0. The link searches commercial-friendly CC licences only."),
  buildSearchUrl(q) {
    // 4 = CC BY, 5 = CC BY-SA, 9 = CC0, 10 = public domain mark, 7 = no known restrictions.
    return `https://www.flickr.com/search/${qs({ text: linkTerms(q) || undefined, license: "4,5,9,10,7" })}`;
  },
});

export const rawpixel = linkProvider({
  id: "rawpixel",
  name: "Rawpixel",
  homepage: "https://www.rawpixel.com",
  description: "Free and premium photos, vectors and mockups, plus a large set of public-domain art remastered from museum scans. Link-only: downloads need an account.",
  categories: [...STOCK, "art", "archive"],
  pricing: "freemium",
  license: mixed("Rawpixel licence", "https://www.rawpixel.com/services/licenses", "Public-domain (CC0) items are free for any use; other free items have a personal-use licence; premium items need a membership."),
  buildSearchUrl(q) {
    const text = linkTerms(q);
    return text ? `https://www.rawpixel.com/search/${encodeURIComponent(text)}` : "https://www.rawpixel.com/free-images";
  },
});

export const stocksnap = linkProvider({
  id: "stocksnap",
  name: "StockSnap.io",
  homepage: "https://stocksnap.io",
  description: "Tens of thousands of free CC0 photos added weekly. Link-only: no public API.",
  categories: STOCK,
  pricing: "free",
  license: license("CC0-1.0", "site"),
  buildSearchUrl(q) {
    const s = slug(linkTerms(q));
    return s ? `https://stocksnap.io/search/${s}` : "https://stocksnap.io";
  },
});

export const burst = linkProvider({
  id: "burst",
  name: "Burst (Shopify)",
  homepage: "https://burst.shopify.com",
  description: "Free stock photos from Shopify, aimed at online shops: products, small business, lifestyle. Link-only: no public API.",
  categories: STOCK,
  pricing: "free",
  license: royaltyFree("Burst licence", { url: "https://burst.shopify.com/licenses/shopify-some-rights-reserved", note: "Free for commercial use, no credit needed; don't resell the photos or use them in a way that is defamatory or misleading." }),
  buildSearchUrl(q) {
    return `https://burst.shopify.com/photos/search${qs({ q: linkTerms(q) || undefined })}`;
  },
});

export const vecteezy = linkProvider({
  id: "vecteezy",
  name: "Vecteezy",
  homepage: "https://www.vecteezy.com",
  description: "Millions of free and Pro vectors, photos and PNG cut-outs. Link-only: its API is paid and its terms forbid scraping.",
  categories: [...STOCK, "icons"],
  pricing: "freemium",
  license: mixed("Vecteezy licence", "https://www.vecteezy.com/licensing-agreement", "Free items need credit to Vecteezy; Pro items need a subscription and no credit."),
  buildSearchUrl(q) {
    const s = slug(linkTerms(q));
    const kind = wantedKind(q);
    const section = kind === "vector" || kind === "icon" ? "free-vector" : q.transparent ? "free-png" : "free-photos";
    return s ? `https://www.vecteezy.com/${section}/${s}` : `https://www.vecteezy.com/${section}`;
  },
});

export const freepik = linkProvider({
  id: "freepik",
  name: "Freepik",
  homepage: "https://www.freepik.com",
  description: "Millions of photos, vectors, icons and PSD mock-ups; free with credit or premium. Link-only: paid API, terms against scraping.",
  categories: [...STOCK, "icons"],
  pricing: "freemium",
  license: mixed("Freepik licence", "https://www.freepik.com/legal/terms-of-use", "Free images need credit to Freepik; premium images need a subscription. Check each image's licence."),
  buildSearchUrl(q) {
    const kind = wantedKind(q);
    const type = kind === "photo" ? "photo" : kind === "vector" || kind === "illustration" ? "vector" : kind === "icon" ? "icon" : undefined;
    return `https://www.freepik.com/search${qs({ format: "search", query: linkTerms(q) || undefined, type })}`;
  },
});

// ---------------------------------------------------------------------------
// Museums, libraries and archives (key needed or no image search API)
// ---------------------------------------------------------------------------

export const smithsonian = linkProvider({
  id: "smithsonian",
  name: "Smithsonian Open Access",
  homepage: "https://www.si.edu/openaccess",
  description: "About 5 million CC0 images from the Smithsonian's 21 museums, libraries and zoo: art, natural history, aviation and space, American history. Link-only for now: its API needs an api.data.gov key.",
  categories: MUSEUM,
  pricing: "free",
  apiKeyEnv: "SMITHSONIAN_API_KEY",
  license: license("CC0-1.0", "source", "Items marked CC0 in Smithsonian Open Access are free for any use. Other items on si.edu keep their own rights."),
  buildSearchUrl(q) {
    return `https://www.si.edu/search/collection-images${qs({ edan_q: linkTerms(q) || undefined, "edan_fq[0]": 'media_usage:"CC0"' })}`;
  },
});

export const europeana = linkProvider({
  id: "europeana",
  name: "Europeana",
  homepage: "https://www.europeana.eu",
  description: "Tens of millions of images from European museums, libraries and archives; the link shows openly licensed ones. Link-only for now: its API needs a key.",
  categories: MUSEUM,
  pricing: "free",
  apiKeyEnv: "EUROPEANA_API_KEY",
  license: mixed("Per-item rights statement (Europeana)", "https://www.europeana.eu/en/rights", "Each item carries its own rights statement (CC0, public domain mark, CC BY…): check the item page."),
  buildSearchUrl(q) {
    return `https://www.europeana.eu/en/search${qs({ query: linkTerms(q) || "*", qf: 'TYPE:"IMAGE"', reusability: "open" })}`;
  },
});

export const rijksmuseum = linkProvider({
  id: "rijksmuseum",
  name: "Rijksmuseum",
  homepage: "https://www.rijksmuseum.nl/en/collection",
  description: "Over 700,000 public-domain images of Dutch art and history (Rembrandt, Vermeer), downloadable at full resolution. Link-only for now: its data services need a key.",
  categories: ["art", "archive"],
  pricing: "free",
  apiKeyEnv: "RIJKSMUSEUM_API_KEY",
  license: license("CC0-1.0", "source", "Public-domain works are released as CC0; a few items keep other rights."),
  buildSearchUrl(q) {
    return `https://www.rijksmuseum.nl/en/collection/search${qs({ query: linkTerms(q) || undefined })}`;
  },
});

export const nga = linkProvider({
  id: "nga",
  name: "National Gallery of Art",
  homepage: "https://www.nga.gov/open-access-images.html",
  description: "About 60,000 open-access (CC0) images of paintings, prints and drawings from the National Gallery of Art, Washington. Link-only: no search API (the open data is a CSV dump).",
  categories: ["art"],
  pricing: "free",
  license: license("CC0-1.0", "source"),
  buildSearchUrl(q) {
    return `https://www.nga.gov/collection-search-result.html${qs({ keyword: linkTerms(q) || undefined })}`;
  },
});

export const nypl = linkProvider({
  id: "nypl",
  name: "NYPL Digital Collections",
  homepage: "https://digitalcollections.nypl.org",
  description: "About a million digitised prints, photos, maps and manuscripts from the New York Public Library, over 180,000 of them public domain. Link-only: its API needs a token.",
  categories: ["archive", "art", "city", "architecture"],
  pricing: "free",
  apiKeyEnv: "NYPL_API_TOKEN",
  license: mixed("Per-item rights (NYPL)", "https://www.nypl.org/research/collections/digital-collections/public-domain", PD_MIX),
  buildSearchUrl(q) {
    return `https://digitalcollections.nypl.org/search/index${qs({ keywords: linkTerms(q) || undefined, "filters[rights][]": "pd" })}`;
  },
});

export const internetarchive = linkProvider({
  id: "internetarchive",
  name: "Internet Archive (images)",
  homepage: "https://archive.org/details/image",
  description: "Millions of scanned photos, book illustrations, posters and ephemera. Link-only: licences are uploader-asserted and image search through its API is poor.",
  categories: ["archive", "art", "science"],
  pricing: "free",
  license: customLicense("Uploader-asserted licence", { url: "https://archive.org/about/terms.php", verdict: "check-terms", assertedBy: "uploader", note: "Uploaders state the rights themselves; verify before commercial use." }),
  buildSearchUrl(q) {
    return `https://archive.org/search${qs({ query: linkTerms(q) || undefined, "and[]": 'mediatype:"image"' })}`;
  },
});

// ---------------------------------------------------------------------------
// Vectors, clip art and icons
// ---------------------------------------------------------------------------

export const openclipart = linkProvider({
  id: "openclipart",
  name: "Openclipart",
  homepage: "https://openclipart.org",
  description: "About 180,000 public-domain clip-art drawings, all SVG. Link-only: no public API.",
  categories: VECTOR,
  pricing: "free",
  license: license("CC0-1.0", "site"),
  buildSearchUrl(q) {
    return `https://openclipart.org/search/${qs({ query: linkTerms(q) || undefined })}`;
  },
});

export const svgrepo = linkProvider({
  id: "svgrepo",
  name: "SVG Repo",
  homepage: "https://www.svgrepo.com",
  description: "About 500,000 free SVG icons and vectors from open-source sets, licence shown per collection. Link-only: no public API and it rate-limits bots.",
  categories: VECTOR,
  pricing: "free",
  license: mixed("Per-collection licence (SVG Repo)", "https://www.svgrepo.com/page/licensing/", "Each collection has its own licence (CC0, MIT, Apache, CC BY…): check the icon page."),
  buildSearchUrl(q) {
    const s = slug(linkTerms(q, { transparent: false }));
    return s ? `https://www.svgrepo.com/vectors/${s}/` : "https://www.svgrepo.com";
  },
});

export const flaticon = linkProvider({
  id: "flaticon",
  name: "Flaticon",
  homepage: "https://www.flaticon.com",
  description: "Millions of icons and stickers (Freepik); free with credit or premium. Link-only: paid API.",
  categories: ["icons"],
  pricing: "freemium",
  license: mixed("Flaticon licence", "https://www.flaticon.com/legal", "Free icons need credit to the author and Flaticon; premium icons need a subscription."),
  buildSearchUrl(q) {
    return `https://www.flaticon.com/search${qs({ word: linkTerms(q, { transparent: false }) || undefined })}`;
  },
});

export const nounproject = linkProvider({
  id: "nounproject",
  name: "The Noun Project",
  homepage: "https://thenounproject.com",
  description: "Over 8 million icons and photos from designers worldwide; free with credit (CC BY) or royalty-free with a subscription. Link-only: its API needs a key.",
  categories: ["icons"],
  pricing: "freemium",
  apiKeyEnv: "NOUN_PROJECT_KEY",
  license: mixed("Noun Project licence", "https://thenounproject.com/legal/", "Free downloads are CC BY (credit the creator); Noun Project Pro removes the credit requirement."),
  buildSearchUrl(q) {
    return `https://thenounproject.com/search/icons/${qs({ q: linkTerms(q, { transparent: false }) || undefined })}`;
  },
});

export const undraw = linkProvider({
  id: "undraw",
  name: "unDraw",
  homepage: "https://undraw.co",
  description: "About 1,500 open-licence flat illustrations in a colour you pick, for websites and apps. Link-only: no public API.",
  categories: ["people", "tech", "objects"],
  pricing: "free",
  license: royaltyFree("unDraw licence", { url: "https://undraw.co/license", note: "Free for commercial and personal use, no credit needed; don't redistribute the illustrations as a pack or build a competing service." }),
  buildSearchUrl(q) {
    const s = slug(linkTerms(q, { transparent: false }));
    return s ? `https://undraw.co/search/${s}` : "https://undraw.co/illustrations";
  },
});

// ---------------------------------------------------------------------------
// Paid libraries (partner-only APIs)
// ---------------------------------------------------------------------------

export const shutterstock = linkProvider({
  id: "shutterstock",
  name: "Shutterstock",
  homepage: "https://www.shutterstock.com",
  description: "One of the largest paid image libraries: over 400 million photos, vectors and illustrations, per image or by subscription.",
  categories: ALL,
  pricing: "paid",
  license: paidStock("Shutterstock", "https://www.shutterstock.com/license"),
  buildSearchUrl(q) {
    const s = slug(linkTerms(q, { resolution: false }));
    const kind = wantedKind(q);
    return `${s ? `https://www.shutterstock.com/search/${s}` : "https://www.shutterstock.com"}${qs({ image_type: kind === "icon" ? "vector" : kind, orientation: one(q.orientations) === "landscape" ? "horizontal" : one(q.orientations) === "portrait" ? "vertical" : undefined })}`;
  },
});

export const adobestock = linkProvider({
  id: "adobestock",
  name: "Adobe Stock",
  homepage: "https://stock.adobe.com",
  description: "Paid photos, vectors, illustrations and templates, built into Creative Cloud apps.",
  categories: ALL,
  pricing: "paid",
  license: paidStock("Adobe Stock", "https://stock.adobe.com/license-terms"),
  buildSearchUrl(q) {
    return `https://stock.adobe.com/search${qs({ k: linkTerms(q) || undefined })}`;
  },
});

export const gettyimages = linkProvider({
  id: "gettyimages",
  name: "Getty Images",
  homepage: "https://www.gettyimages.com",
  description: "Premium creative and editorial photography: news, sport, entertainment and archive pictures.",
  categories: ALL,
  pricing: "paid",
  license: paidStock("Getty Images", "https://www.gettyimages.com/eula"),
  buildSearchUrl(q) {
    return `https://www.gettyimages.com/search/2/image${qs({ phrase: linkTerms(q) || undefined })}`;
  },
});

export const istock = linkProvider({
  id: "istock",
  name: "iStock",
  homepage: "https://www.istockphoto.com",
  description: "Getty Images' lower-priced library of photos, illustrations and vectors.",
  categories: ALL,
  pricing: "paid",
  license: paidStock("iStock", "https://www.istockphoto.com/legal/license-agreement"),
  buildSearchUrl(q) {
    return `https://www.istockphoto.com/search/2/image${qs({ phrase: linkTerms(q) || undefined })}`;
  },
});

export const alamy = linkProvider({
  id: "alamy",
  name: "Alamy",
  homepage: "https://www.alamy.com",
  description: "Over 400 million paid stock photos, strong on travel, news and historical pictures.",
  categories: ALL,
  pricing: "paid",
  license: paidStock("Alamy", "https://www.alamy.com/terms/licence-terms.aspx"),
  buildSearchUrl(q) {
    return `https://www.alamy.com/search.html${qs({ qt: linkTerms(q) || undefined })}`;
  },
});

export const linkedProviders = [
  unsplash,
  pexels,
  pixabay,
  flickr,
  rawpixel,
  stocksnap,
  burst,
  vecteezy,
  freepik,
  smithsonian,
  europeana,
  rijksmuseum,
  nga,
  nypl,
  internetarchive,
  openclipart,
  svgrepo,
  flaticon,
  nounproject,
  undraw,
  shutterstock,
  adobestock,
  gettyimages,
  istock,
  alamy,
];
