import { LINKED, MCP_NAME, MCP_URL, SEARCHED, SOURCE_COUNT } from "./site";

const searchedNames = SEARCHED.map((p) => p.name).join(", ");
const linkedNames = LINKED.slice(0, 8).map((p) => p.name).join(", ");

/** Shown on the home page and emitted as FAQPage JSON-LD (answers are plain text). */
export const FAQ = [
  {
    q: "What is Image Asset Server?",
    a: `Image Asset Server is a free search engine and API for stock video. One query searches ${SOURCE_COUNT} sites: ${searchedNames} directly, plus deep links into ${linkedNames} and other stock sites. Results show a poster, a playable preview, resolution, orientation, length and a licence verdict. It works in the browser, over a REST API, from a CLI, and as an MCP server for AI agents.`,
  },
  {
    q: "Can I use these images in a commercial video?",
    a: "It depends on each image's licence, which is why every result carries a verdict. Green means commercial use is fine (CC0, public domain), or fine with a credit line (CC BY, NASA media). Amber means read the conditions first: share-alike, uploader-asserted licences, third-party footage or paid stock. Red means non-commercial only. A separate editorial flag marks footage with people, insignia or brands that have no releases: fine for news and documentary, not for ads. Turn on Commercial-safe to see only green results.",
  },
  {
    q: "Does the video stream through this server?",
    a: "No. Posters, hover previews and the player in the detail view load straight from the source's CDN (NASA, Wikimedia, the Internet Archive). Downloads are a redirect to the file on the source. The server only searches, reads metadata and writes credit files, so no video bytes pass through it and nothing is re-hosted.",
  },
  {
    q: "Why do some results open on Pexels, Pixabay or Shutterstock instead?",
    a: `Those sites either need an API key, forbid aggregators in their terms, or sell their footage. Rather than scrape them, every search returns a link that runs the same query on their site (${linkedNames}…), so you still see where else to look.`,
  },
  {
    q: "Is it free?",
    a: "Yes: no account, no API key, no ads and no paid tier. It is open source (Apache-2.0), so you can also run your own copy with Docker or npx. Paid stock libraries show up only as links to their own search; any purchase happens on their site.",
  },
  {
    q: "How do I connect Claude Code, Cursor or another AI agent?",
    a: `Add the MCP server URL ${MCP_URL}. In Claude Code run: claude mcp add --transport http ${MCP_NAME} ${MCP_URL}. Cursor, VS Code, Windsurf, Codex CLI and Gemini CLI take the same URL. The agent gets search_videos, get_video, build_sequence and list_sources, searches commercial-safe by default, and is told never to present a non-commercial, unclear or editorial-only image as cleared for ads.`,
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
        a: "Describe the shot the way an editor would: 'ocean waves at sunset', 'drone city skyline night', 'rocket launch slow motion', '1950s newsreel factory'. Resolution ('4k', '1080p'), orientation ('vertical', '9:16', 'square'), length ('10s', 'under 30 seconds') and frame rate ('60fps') are read out of the query and become filters, shown as chips under the search box.",
      },
      {
        q: "What does a length like '10s' do?",
        a: "A single length means 'at least that long', so the image can cover a shot of that length. Use a range ('5-15s') or the duration filter for a maximum.",
      },
      {
        q: "Why do some images have no resolution or length?",
        a: "Some sources only report frame size and duration on the image's own page. Such images stay in the results, ranked below images that are known to match. Opening a image reads its full details; the API's strict=true drops unknowns when you filter on them.",
      },
      {
        q: "Why is there no hover preview on some cards?",
        a: "Internet Archive search results carry no playable file until the item's file list is read, and some NASA visualisation pages publish no poster. Those cards show a placeholder; open the image to load its player and files.",
      },
      {
        q: "Does it find vertical video for Reels, TikTok and Shorts?",
        a: "Yes. Set Orientation to Vertical, or type 'vertical' or '9:16'. Some NASA visualisations come in vertical cuts. For landscape-only footage, the sequence builder and its ffmpeg script crop to 9:16 for you, and say so in the shot notes.",
      },
    ],
  },
  {
    title: "Licences",
    id: "licences",
    items: [
      {
        q: "What does 'editorial' mean on a image?",
        a: "Identifiable people, logos, insignia or brands appear without model or property releases. The footage can be fine to use in news, documentary and education, but not in advertising or anything that suggests endorsement. All NASA footage is flagged this way because NASA forbids implying endorsement and using its insignia, and historic newsreels often show people who never signed a release.",
      },
      {
        q: "Is NASA footage public domain?",
        a: "NASA media is generally not copyrighted in the US. NASA asks for credit, forbids using its insignia or implying endorsement, and requires permission for identifiable astronauts or staff in ads. Some items are copyrighted by a partner such as a launch company; those carry an 'Unclear: check the terms' verdict.",
      },
      {
        q: "Can I trust public-domain marks on the Internet Archive?",
        a: "Not blindly. Licences on Internet Archive items are set by whoever uploaded them, and some modern films carry a false public-domain mark. Uploader-asserted licences are therefore capped at 'Unclear: check the terms'. The Prelinger Archives are the exception: the archive that holds those films states their status.",
      },
      {
        q: "What is the difference between CC BY and CC BY-SA for video?",
        a: "CC BY lets you use the image commercially with a credit line. CC BY-SA adds share-alike: a video that includes the image must itself be released under the same CC licence, which rules out most client and broadcast work, so it is marked Restricted.",
      },
      {
        q: "Is the verdict legal advice?",
        a: "No. It is a consistent reading of the licence the source states, decided the same way for every image. Check the source page for anything unusual, and remember that trademark, privacy and publicity rights can apply even to public-domain footage.",
      },
    ],
  },
  {
    title: "Downloads and credits",
    id: "downloads",
    items: [
      {
        q: "Which file should I download?",
        a: "The detail view lists every rendition the source offers (original master, transcodes, previews) with frame size, container, codec and file size. For a 1080p edit, take the smallest file at or above 1080p; the 4K master is often several gigabytes. The API's download endpoint does this with ?height=1080.",
      },
      {
        q: "Why are Wikimedia Commons files WebM instead of MP4?",
        a: "Commons stores video in open formats (WebM, Ogg Theora) and transcodes to VP9 WebM. Every modern browser and editor such as DaVinci Resolve reads WebM; if yours doesn't, convert with ffmpeg: ffmpeg -i image.webm -c:v libx264 -crf 18 image.mp4.",
      },
      {
        q: "Where do I get the credit line?",
        a: "Every image that needs one shows a ready-to-paste credit line with a Copy button, and the API returns it as `attribution`. /v1/images/{id}/credits gives ATTRIBUTION.md, credits.json, or both in a zip, and the sequence builder writes one ATTRIBUTION.md for the whole edit.",
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
        q: "Can the MCP server download video to my disk?",
        a: `Not the hosted one: it never writes to its own disk, so it returns download links instead (agents with a shell fetch them with curl -L). Run it locally with npx -y image-asset-server mcp to get download_video and build_sequence with download=true, which save images into ./footage with ATTRIBUTION.md.`,
      },
      {
        q: "Can I run my own copy?",
        a: "Yes. docker run -p 8787:8787 ghcr.io/arielshad/image-asset-server starts the website, API and MCP server on port 8787. No source needs an API key. See the self-hosting docs for every setting.",
      },
    ],
  },
];

export const FAQ_ALL = FAQ_GROUPS.flatMap((g) => g.items);
