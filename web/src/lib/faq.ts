import { LINKED, MCP_NAME, MCP_URL, SEARCHED, SOURCE_COUNT } from "./site";

const searchedNames = SEARCHED.map((p) => p.name).join(", ");
const linkedNames = LINKED.slice(0, 8).map((p) => p.name).join(", ");

/** Shown on the home page and emitted as FAQPage JSON-LD (answers are plain text). */
export const FAQ = [
  {
    q: "What is Image Asset Server?",
    a: `Image Asset Server is a free search engine and API for openly licensed images. One query searches ${SOURCE_COUNT} sites: ${searchedNames} directly, plus deep links into ${linkedNames} and other image sites. Results show a thumbnail, the pixel size, the kind of image (photo, painting, vector, icon…) and a licence verdict. It works in the browser, over a REST API, from a CLI, and as an MCP server for AI agents.`,
  },
  {
    q: "Can I use these images commercially?",
    a: "It depends on each image's licence, which is why every result carries a verdict. Green means commercial use is fine (CC0, public domain, museum open access), or fine with a credit line (CC BY, NASA media, open-source icon sets). Amber means read the conditions first: share-alike, unevaluated archive rights, partner-credited images or paid stock. Red means non-commercial only. A separate editorial flag marks images with people, insignia or brands that have no releases: fine for articles and education, not for ads. Turn on Commercial-safe to see only green results.",
  },
  {
    q: "Do the images pass through this server?",
    a: "No. Thumbnails, previews and the full view load straight from the source (NASA, the museums, Wikimedia, Iconify, Openverse). Downloads are a redirect to the file on the source. The server only searches, reads metadata and writes credit files, so no image bytes pass through it and nothing is re-hosted.",
  },
  {
    q: "Why do some results open on Unsplash, Pexels or Shutterstock instead?",
    a: `Those sites either need an API key, forbid aggregators in their terms, or sell their images. Rather than scrape them, every search returns a link that runs the same query on their site (${linkedNames}…), so you still see where else to look.`,
  },
  {
    q: "Is it free?",
    a: "Yes: no account, no API key, no ads and no paid tier. It is open source (Apache-2.0), so you can also run your own copy with Docker or npx. Paid stock libraries show up only as links to their own search; any purchase happens on their site.",
  },
  {
    q: "How do I connect Claude Code, Cursor or another AI agent?",
    a: `Add the MCP server URL ${MCP_URL}. In Claude Code run: claude mcp add --transport http ${MCP_NAME} ${MCP_URL}. Cursor, VS Code, Windsurf, Codex CLI and Gemini CLI take the same URL. The agent gets search_images, get_image, build_image_set and list_sources, searches commercial-safe by default, and is told never to present a non-commercial, unclear or editorial-only image as cleared for ads.`,
  },
];

export const FAQ_GROUPS: { title: string; id: string; items: { q: string; a: string }[] }[] = [
  { title: "About Image Asset Server", id: "about", items: FAQ },
  {
    title: "Searching",
    id: "searching",
    items: [
      {
        q: "What can I type in the search box?",
        a: "Describe the picture: 'mountain lake at sunrise', 'van gogh sunflowers', 'saturn rings', 'vintage map of paris', 'rocket icon'. Size ('4k', 'high resolution'), orientation ('vertical', '16:9', 'square'), format ('svg', 'png') and transparency ('transparent', 'no background') are read out of the query and become filters, shown as chips under the search box.",
      },
      {
        q: "How do I find icons or vectors?",
        a: "Add 'icon' or 'svg' to the query, or pick Icon or Vector in the Kind filter. Icons come from open-source sets through Iconify; SVG drawings, maps and diagrams come from Wikimedia Commons. Both filter strictly: only vectors or icons come back.",
      },
      {
        q: "Why do some images have no size?",
        a: "Some sources only report pixel size on the image's own record. Such images stay in the results, ranked below images known to match. Opening one reads its full details; the API's strict=true drops unknowns when you filter on them.",
      },
      {
        q: "Can I find images with a transparent background?",
        a: "Yes. Turn on Transparent, or type 'transparent' or 'png'. Icons and SVGs are always transparent; transparent results are shown on a checkerboard so you can see their edges.",
      },
    ],
  },
  {
    title: "Licences",
    id: "licences",
    items: [
      {
        q: "What does 'editorial' mean on an image?",
        a: "Identifiable people, logos, insignia or brands appear without model or property releases. The image can be fine in articles, books and education, but not in advertising or anything that suggests endorsement. All NASA images are flagged this way because NASA forbids implying endorsement and using its insignia.",
      },
      {
        q: "Are museum images really free?",
        a: "Yes, for works the museum releases as open access. The Met, the Art Institute of Chicago and the Cleveland Museum of Art put their photographs of public-domain works under CC0: print, crop, sell, no credit required. Only those works are searched; works still in copyright are left out.",
      },
      {
        q: "Is NASA imagery public domain?",
        a: "NASA media is generally not copyrighted in the US. NASA asks for credit, forbids using its insignia or implying endorsement, and requires permission for identifiable astronauts or staff in ads. Some items are copyrighted by a partner such as ESA or a university; those carry an 'Unclear: check the terms' verdict.",
      },
      {
        q: "What is the difference between CC BY, BY-SA and BY-ND for images?",
        a: "CC BY lets you use and edit the image commercially with a credit line. CC BY-SA adds share-alike: an edited version must be released under the same licence, so it is marked Restricted. CC BY-ND forbids edits, including cropping and adding text, so it is marked Non-commercial only here.",
      },
      {
        q: "Do I need to credit open-source icons?",
        a: "Not next to each icon. MIT, Apache 2.0 and ISC icon sets ask you to keep their licence notice with copies you distribute, for example in your app's third-party notices. The SIL OFL needs nothing visible. A few icon sets are CC BY and do need a visible credit.",
      },
      {
        q: "Is the verdict legal advice?",
        a: "No. It is a consistent reading of the licence the source states, decided the same way for every image. Check the source page for anything unusual, and remember that trademark, privacy and publicity rights can apply even to public-domain images.",
      },
    ],
  },
  {
    title: "Downloads and credits",
    id: "downloads",
    items: [
      {
        q: "Which file should I download?",
        a: "The detail view lists every file the source offers (original, resized copies) with pixel size, format and file size. For a website, a 1600–1920 px copy is plenty; take the original or TIFF for print. The API's download endpoint does this with ?width=1920.",
      },
      {
        q: "Where do I get the credit line?",
        a: "Every image that needs one shows a ready-to-paste credit line with a Copy button, and the API returns it as `attribution`. /v1/images/{id}/credits gives ATTRIBUTION.md, credits.json, or both in a zip, and the image set builder writes credits.html with <figure> captions for a whole page.",
      },
    ],
  },
  {
    title: "API, agents and self-hosting",
    id: "api",
    items: [
      {
        q: "Is there a rate limit?",
        a: "The public server allows 120 requests per minute per client on /v1 and /mcp, with RateLimit headers on every response and 429 plus Retry-After beyond that. A search fans out to every source, so cache results you reuse.",
      },
      {
        q: "Can the MCP server download images to my disk?",
        a: `Not the hosted one: it never writes to its own disk, so it returns download links instead (agents with a shell fetch them with curl -L). Run it locally with npx -y image-asset-server mcp to get download_image and build_image_set with download=true, which save images into ./images with ATTRIBUTION.md.`,
      },
      {
        q: "Can I run my own copy?",
        a: "Yes. docker run -p 8787:8787 ghcr.io/arielshad/image-asset-server starts the website, API and MCP server on port 8787. No source needs an API key. See the self-hosting docs for every setting.",
      },
    ],
  },
];

export const FAQ_ALL = FAQ_GROUPS.flatMap((g) => g.items);
