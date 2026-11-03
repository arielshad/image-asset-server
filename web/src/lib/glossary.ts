/**
 * The glossary (/glossary, /glossary.md): image, file format and licence
 * terms in plain words. Each term has a stable id used as its URL fragment
 * (/glossary#cc-by) and as the DefinedTerm @id in JSON-LD. `see` links point
 * at guides, collections or searches on this site; `ref` at an authoritative
 * external definition (licence deeds, specifications).
 */

export interface Term {
  id: string;
  term: string;
  aliases?: string[];
  group: (typeof GLOSSARY_GROUPS)[number];
  definition: string;
  see?: { label: string; href: string }[];
  ref?: string;
}

export const GLOSSARY_GROUPS = ["Images", "Image files", "Licences and rights", "Tools"] as const;

export const GLOSSARY: Term[] = [
  // Images
  { id: "stock-photo", term: "Stock photo", aliases: ["stock image", "stock photography"], group: "Images", definition: "A photo made once and licensed many times, so designers and writers don't have to shoot everything themselves. It ranges from free public-domain archives to paid libraries that license each image per use.", see: [{ label: "Search free images", href: "/search" }, { label: "Free images for commercial use", href: "/guides/free-images-commercial-use" }] },
  { id: "public-domain-art", term: "Public-domain art", aliases: ["open access art", "museum open access"], group: "Images", definition: "Paintings, prints and drawings whose copyright has expired. Museums such as the Met, the Art Institute of Chicago and the Cleveland Museum of Art release their photographs of these works under CC0, so anyone may reuse them.", see: [{ label: "Museum open access", href: "/guides/museum-open-access-art" }, { label: "Impressionist paintings", href: "/collections/public-domain-impressionist-paintings" }] },
  { id: "botanical-illustration", term: "Botanical illustration", aliases: ["botanical plate"], group: "Images", definition: "A scientifically accurate drawing or print of a plant, often hand-coloured, made for herbals and botany books before photography. Most are now public domain.", see: [{ label: "Botanical illustrations", href: "/collections/botanical-illustrations" }] },
  { id: "ukiyo-e", term: "Ukiyo-e", aliases: ["woodblock print", "Japanese print"], group: "Images", definition: "Japanese woodblock prints of the 17th to 19th centuries (Hokusai, Hiroshige, Utamaro): landscapes, actors and city life in flat colour and bold line. Museum impressions are widely available as CC0.", see: [{ label: "Japanese woodblock prints", href: "/collections/japanese-woodblock-prints" }] },
  { id: "archive-photo", term: "Archive photograph", aliases: ["historical photo", "vintage photo"], group: "Images", definition: "A photograph kept by a library or archive, such as the Library of Congress. Many are public domain, but each comes with a rights statement worth reading, and the people in them can still need clearance for advertising.", see: [{ label: "Vintage city photos", href: "/collections/vintage-city-photographs" }] },
  { id: "icon", term: "Icon", aliases: ["icon set", "pictogram"], group: "Images", definition: "A small symbol for an action or idea (upload, share, settings). Icons come in sets with a shared style and licence; open-source sets such as Material Symbols, Tabler and Phosphor are searched through Iconify.", see: [{ label: "Free SVG icons", href: "/collections/free-svg-icons" }, { label: "SVG icons and transparent PNGs", href: "/guides/transparent-png-and-svg-icons" }] },
  { id: "illustration", term: "Illustration", aliases: ["clip art", "vector illustration"], group: "Images", definition: "A drawn or digitally made picture rather than a photo. Illustrations are often vectors and come with their own licences; museum drawings and prints are listed separately as art." },
  { id: "texture", term: "Texture", aliases: ["background texture", "pattern"], group: "Images", definition: "A close-up of a surface (paper, wood, stone, fabric) used as a background or overlay in a design. A seamless texture tiles without visible edges.", see: [{ label: "Paper textures", href: "/collections/paper-textures-backgrounds" }] },
  { id: "composite", term: "Composite image", aliases: ["false colour", "representative colour"], group: "Images", definition: "An image made from several exposures or wavelengths, common in astronomy: Hubble and Webb pictures map infrared, ultraviolet or X-ray light to visible colours. Say so in the caption when it matters.", see: [{ label: "Hubble and Webb images", href: "/collections/hubble-space-images" }] },

  // Image files
  { id: "resolution", term: "Resolution", aliases: ["pixel size", "dimensions"], group: "Image files", definition: "An image's width and height in pixels. Image Asset Server groups images by the short side, so a 2160×3840 phone wallpaper counts as 4K, the same as a 3840×2160 desktop one." },
  { id: "megapixels", term: "Megapixels", aliases: ["MP"], group: "Image files", definition: "Width times height in millions of pixels. A 6000×4000 photo is 24 MP. More megapixels allow larger prints and tighter crops." },
  { id: "dpi", term: "DPI / PPI", aliases: ["print resolution", "300 dpi"], group: "Image files", definition: "Dots or pixels per inch when an image is printed. 300 dpi is the usual target for print: an A4 page (8.3 × 11.7 in) needs about 2480 × 3508 pixels. On screens only the pixel size matters." },
  { id: "aspect-ratio", term: "Aspect ratio", aliases: ["16:9", "3:2", "4:5", "1:1"], group: "Image files", definition: "Width divided by height. 16:9 suits banners and slides, 3:2 is the classic camera frame, 4:5 and 9:16 suit phone screens, 1:1 avatars and social posts. Changing it means cropping." },
  { id: "orientation", term: "Orientation", group: "Image files", definition: "Whether an image is landscape (wider than tall), portrait (taller than wide, also called vertical) or square. Within 5% of square counts as square here." },
  { id: "vector", term: "Vector (SVG)", aliases: ["SVG", "scalable vector graphics"], group: "Image files", definition: "An image described as shapes rather than pixels. It scales to any size without blurring, stays small, and can be recoloured with CSS. Icons, logos, diagrams and maps are often vectors.", see: [{ label: "SVG icons", href: "/guides/transparent-png-and-svg-icons" }] },
  { id: "raster", term: "Raster image", aliases: ["bitmap", "JPG", "PNG"], group: "Image files", definition: "An image made of pixels: photos and scans. JPG compresses photos well; PNG is lossless and supports transparency; WebP and AVIF do both more efficiently." },
  { id: "transparency", term: "Transparent background", aliases: ["alpha channel", "cut-out", "PNG transparency"], group: "Image files", definition: "Areas of an image with no colour, so whatever is behind shows through. PNG, WebP and SVG support it; JPG does not. Transparent images are shown on a checkerboard on this site." },
  { id: "tiff", term: "TIFF", aliases: ["TIF"], group: "Image files", definition: "A lossless format used for archival scans and print masters. Files are large (tens of megabytes); museums such as the Cleveland Museum of Art offer TIFFs for print." },
  { id: "iiif", term: "IIIF", aliases: ["International Image Interoperability Framework"], group: "Image files", definition: "A standard image API used by museums and libraries to serve an image at any size or crop from one URL. The Art Institute of Chicago and the Library of Congress use it.", ref: "https://iiif.io" },
  { id: "rendition", term: "Resized copy", aliases: ["rendition", "derivative"], group: "Image files", definition: "A smaller copy of an image made by the source, such as NASA's 1920 px 'large' JPG or a Wikimedia thumbnail. Quicker to download than the original and usually enough for the web." },
  { id: "original", term: "Original", aliases: ["master", "full resolution"], group: "Image files", definition: "The file as published by the source, at full size. Download it for print or heavy cropping; for a website a resized copy is lighter." },
  { id: "alt-text", term: "Alt text", aliases: ["alternative text"], group: "Image files", definition: "A short description of an image for people using screen readers and when the image fails to load. Image sets suggest one per pick; write your own when the image carries meaning." },

  // Licences and rights
  { id: "public-domain", term: "Public domain", aliases: ["PD", "Public Domain Mark"], group: "Licences and rights", definition: "Works no one owns a copyright in, because it expired, was never claimed, or (in the US) the work was made by the federal government. Anyone may use them for anything, though trademarks and the rights of people shown can still apply.", see: [{ label: "Free images for commercial use", href: "/guides/free-images-commercial-use" }], ref: "https://creativecommons.org/publicdomain/mark/1.0/" },
  { id: "cc0", term: "CC0", aliases: ["CC0 1.0", "public domain dedication"], group: "Licences and rights", definition: "A Creative Commons tool with which a creator gives up their copyright as far as the law allows, putting the work in the public domain: use it commercially, no credit needed. Museum open-access images use it.", ref: "https://creativecommons.org/publicdomain/zero/1.0/" },
  { id: "cc-by", term: "CC BY", aliases: ["Attribution"], group: "Licences and rights", definition: "Creative Commons Attribution: use it for anything, including commercial work, as long as you credit the author, name the licence, link it and say if you changed the image.", see: [{ label: "How to credit CC BY images", href: "/guides/credit-cc-by-images" }], ref: "https://creativecommons.org/licenses/by/4.0/" },
  { id: "cc-by-sa", term: "CC BY-SA", aliases: ["share-alike", "SA"], group: "Licences and rights", definition: "Attribution-ShareAlike: like CC BY, but an adapted version of the image must be released under the same licence. Marked Restricted, because most commercial designs edit their images and can't be relicensed that way.", ref: "https://creativecommons.org/licenses/by-sa/4.0/" },
  { id: "nc", term: "NC (NonCommercial)", aliases: ["CC BY-NC"], group: "Licences and rights", definition: "A Creative Commons condition that rules out use 'primarily intended for or directed towards commercial advantage or monetary compensation': ads, client work, products you sell.", ref: "https://creativecommons.org/licenses/by-nc/4.0/" },
  { id: "nd", term: "ND (NoDerivatives)", aliases: ["CC BY-ND"], group: "Licences and rights", definition: "A Creative Commons condition that forbids sharing adapted versions. Cropping, retouching, putting text on top or compositing an ND image counts as adapting it, so ND images get a 'no' verdict here.", ref: "https://creativecommons.org/licenses/by-nd/4.0/" },
  { id: "mit-license", term: "MIT, Apache 2.0, ISC", aliases: ["open-source icon licence"], group: "Licences and rights", definition: "Software licences used by most open-source icon sets. They allow commercial use and modification; keep the set's copyright and licence notice with copies you distribute, for example in your app's third-party notices.", ref: "https://opensource.org/license/mit" },
  { id: "ofl", term: "SIL Open Font License", aliases: ["OFL"], group: "Licences and rights", definition: "A licence used by icon fonts and some icon sets: free to use, embed and modify in any project, but the font or icon files may not be sold on their own.", ref: "https://openfontlicense.org/" },
  { id: "royalty-free", term: "Royalty free", group: "Licences and rights", definition: "Pay once (or nothing) and use the image without per-use fees. It does not mean copyright free: the licence still sets rules, typically no reselling or re-uploading the image as stock." },
  { id: "editorial-use", term: "Editorial use", aliases: ["editorial only"], group: "Licences and rights", definition: "Use in articles, books, education and commentary, as opposed to advertising or promotion. Images showing people, logos or insignia without releases are often editorial-only, whatever their copyright licence says.", see: [{ label: "Free images for commercial use", href: "/guides/free-images-commercial-use" }] },
  { id: "model-release", term: "Model release", group: "Licences and rights", definition: "A signed permission from a recognisable person to use their likeness commercially. Without one, a photo of them is usually fine for editorial use but not for ads or endorsements." },
  { id: "property-release", term: "Property release", group: "Licences and rights", definition: "Permission from the owner of recognisable private property, artwork or a trademark to show it commercially. Logos and branded products in the picture are the most common reason an image is editorial-only." },
  { id: "attribution", term: "Attribution", aliases: ["credit line", "TASL"], group: "Licences and rights", definition: "The credit a licence asks for: title, author, source and licence (TASL), with links. Every result that needs one carries a ready-made credit line.", see: [{ label: "How to credit CC BY images", href: "/guides/credit-cc-by-images" }] },
  { id: "rights-statement", term: "Rights statement", aliases: ["no known restrictions"], group: "Licences and rights", definition: "An archive's note on an item's copyright status, such as the Library of Congress's 'No known restrictions on publication' or 'Rights status not evaluated'. It is the archive's best knowledge, not a licence." },
  { id: "nasa-media-guidelines", term: "NASA media guidelines", group: "Licences and rights", definition: "NASA's rules for its images: generally not copyrighted in the US, credit NASA, don't imply endorsement, don't use the NASA insignia or logotype, and ask before using identifiable astronauts or staff in ads.", see: [{ label: "Using NASA images", href: "/guides/nasa-image-rules" }], ref: "https://www.nasa.gov/nasa-brand-center/images-and-media/" },
  { id: "licence-verdict", term: "Licence verdict", group: "Licences and rights", definition: "Image Asset Server's one-word answer to 'can this be used commercially?': yes, yes with credit, restricted, needs a paid licence or releases, unclear (check the terms) or no. Decided the same way for every source.", see: [{ label: "Image licences explained", href: "/docs/licences" }] },
  { id: "uploader-asserted", term: "Uploader-asserted licence", group: "Licences and rights", definition: "A licence chosen by whoever uploaded the file, which the site does not verify. Such licences are capped at 'check the terms' here." },

  // Tools
  { id: "image-set", term: "Image set", aliases: ["slot list"], group: "Tools", definition: "The images one page, deck or post needs, one per slot (a hero, three icons, a background). The image set builder picks one image per slot with alternatives and writes the credits.", see: [{ label: "Image set builder", href: "/build" }] },
  { id: "figure-caption", term: "Figure and caption", aliases: ["figcaption"], group: "Tools", definition: "HTML's <figure> and <figcaption> elements: the natural place for an image's credit line on a web page. credits.html from the image set builder writes them for you." },
  { id: "mcp", term: "MCP (Model Context Protocol)", group: "Tools", definition: "An open protocol that lets AI assistants call tools on a server. Image Asset Server's MCP endpoint gives agents search_images, get_image, build_image_set and list_sources.", see: [{ label: "Coding agents & MCP", href: "/docs/mcp" }], ref: "https://modelcontextprotocol.io" },
];


export const GLOSSARY_PATH = "/glossary";
export const GLOSSARY_TITLE = "Glossary of image and licence terms";
export const GLOSSARY_DESCRIPTION = "Plain definitions of the terms you meet with free images: resolution, DPI, SVG, transparency, IIIF, CC0, CC BY, share-alike, editorial use, model release.";

const abs = (site: string, path: string) => (path.startsWith("http") ? path : `${site}${path}`);

export function glossaryMarkdown(site: string): string {
  return [
    `# ${GLOSSARY_TITLE}`,
    "",
    `> ${GLOSSARY_DESCRIPTION}`,
    "",
    ...GLOSSARY_GROUPS.flatMap((group) => [
      `## ${group}`,
      "",
      ...GLOSSARY.filter((t) => t.group === group).flatMap((t) => [
        `### ${t.term}`,
        "",
        `${t.definition}${t.aliases?.length ? ` Also: ${t.aliases.join(", ")}.` : ""}`,
        ...(t.see?.length || t.ref ? ["", [...(t.see ?? []).map((s) => `[${s.label}](${abs(site, s.href)})`), ...(t.ref ? [`[reference](${t.ref})`] : [])].join(" · ")] : []),
        "",
      ]),
    ]),
    "---",
    `Source: ${site}${GLOSSARY_PATH}`,
    "",
  ].join("\n");
}
