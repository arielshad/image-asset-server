/**
 * The glossary (/glossary, /glossary.md): footage, video file and licence
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

export const GLOSSARY_GROUPS = ["Footage", "Video files", "Licences and rights", "Editing and tools"] as const;

export const GLOSSARY: Term[] = [
  // Footage
  { id: "stock-footage", term: "Stock footage", aliases: ["stock video"], group: "Footage", definition: "Video shot once and licensed many times, so editors don't have to film everything themselves. It ranges from free public-domain archives to paid libraries that license each image per use.", see: [{ label: "Search stock footage", href: "/search" }, { label: "Free stock footage for commercial use", href: "/guides/free-stock-footage-commercial-use" }] },
  { id: "b-roll", term: "B-roll", aliases: ["cutaway", "cutaways"], group: "Footage", definition: "Supporting footage cut over or between the main shots (the interview, the presenter, the A-roll) to show what is being talked about, cover edits and set the mood. Most stock footage is used as B-roll.", see: [{ label: "Build a b-roll sequence", href: "/guides/b-roll-sequence-from-shot-list" }, { label: "Sequence builder", href: "/sequence" }] },
  { id: "archive-footage", term: "Archive footage", aliases: ["archival footage", "found footage"], group: "Footage", definition: "Footage filmed in the past and reused today: newsreels, educational and industrial films, home movies. Much of it is in the public domain, but the people and brands in frame can still need clearance for advertising.", see: [{ label: "Public-domain archive films", href: "/guides/prelinger-public-domain-films" }, { label: "Newsreels", href: "/footage/public-domain-newsreels" }] },
  { id: "newsreel", term: "Newsreel", group: "Footage", definition: "A short documentary news film shown in cinemas from the 1910s to the 1960s. Newsreels from US government sources and some newsreel companies are public domain; others are still owned by their producers or their successors.", see: [{ label: "Public-domain newsreels", href: "/footage/public-domain-newsreels" }] },
  { id: "timelapse", term: "Timelapse", aliases: ["time-lapse", "hyperlapse"], group: "Footage", definition: "Footage recorded at a low frame rate and played back at normal speed, so clouds race, cities pulse and plants grow. A hyperlapse moves the camera between frames.", see: [{ label: "Timelapse videos", href: "/footage/free-timelapse-videos" }, { label: "Cloud timelapses", href: "/footage/free-cloud-timelapses" }] },
  { id: "slow-motion", term: "Slow motion", aliases: ["slow-mo", "high frame rate"], group: "Footage", definition: "Footage shot at a high frame rate (60, 120 fps or more) and played back at a normal rate, so movement is stretched out. A 60 fps image can be slowed to 50% in a 30 fps edit without repeating frames.", see: [{ label: "Slow motion footage", href: "/footage/free-slow-motion-footage" }] },
  { id: "motion-background", term: "Motion background", aliases: ["background loop"], group: "Footage", definition: "Abstract or atmospheric moving footage (particles, gradients, data visualisations, slow skies) placed behind titles, presenters or slides. The best ones loop seamlessly.", see: [{ label: "Motion backgrounds", href: "/footage/free-motion-backgrounds" }] },
  { id: "seamless-loop", term: "Seamless loop", group: "Footage", definition: "A image whose last frame flows into its first, so it can repeat forever without a visible jump. Used for website hero videos, backgrounds and stage screens." },
  { id: "data-visualization", term: "Data visualisation", aliases: ["scientific visualisation"], group: "Footage", definition: "Animation rendered from measured or simulated data: ocean currents, hurricanes, the Sun's surface, the Moon's terrain. NASA's Scientific Visualization Studio publishes about ten thousand of them, mostly in 1080p and 4K.", see: [{ label: "NASA data visualisations", href: "/footage/nasa-data-visualizations" }] },
  { id: "aerial-footage", term: "Aerial footage", aliases: ["drone footage", "drone shot"], group: "Footage", definition: "Footage filmed from above, by drone, helicopter, plane or satellite. Drone flights over people or property can be restricted by local law, which is the filmmaker's concern, not yours, but recognisable private property can still need a release for ads.", see: [{ label: "Drone footage", href: "/footage/free-drone-footage" }] },
  { id: "green-screen", term: "Green screen", aliases: ["chroma key", "keyable"], group: "Footage", definition: "Footage shot against a uniform green (or blue) background so the background can be removed in editing and replaced with something else." },
  { id: "overlay", term: "Overlay", aliases: ["light leak", "film grain"], group: "Footage", definition: "Footage laid over another image with a blend mode, such as light leaks, film grain, dust, smoke or particles. Overlays are usually shot or rendered on black." },

  // Video files
  { id: "resolution", term: "Resolution", aliases: ["frame size"], group: "Video files", definition: "The frame's width and height in pixels. Image Asset Server groups images by the short side, so a vertical 1080×1920 image counts as 1080p, the same as a landscape 1920×1080 one.", see: [{ label: "Picking the right file", href: "/guides/video-resolution-codecs-containers" }] },
  { id: "4k", term: "4K (UHD)", aliases: ["2160p", "UHD"], group: "Video files", definition: "3840×2160 pixels (UHD), or 4096×2160 in cinema DCI 4K: four times the pixels of 1080p. A 4K source lets you crop, reframe or punch in on a 1080p timeline without losing sharpness.", see: [{ label: "4K nature footage", href: "/footage/free-4k-nature-footage" }] },
  { id: "1080p", term: "1080p (Full HD)", aliases: ["Full HD", "FHD"], group: "Video files", definition: "1920×1080 pixels, the standard size for web video, YouTube and most social platforms. 720p (1280×720) is HD; anything smaller is SD." },
  { id: "aspect-ratio", term: "Aspect ratio", aliases: ["16:9", "9:16", "1:1"], group: "Video files", definition: "The frame's width divided by its height. 16:9 is landscape (YouTube, TV), 9:16 vertical (Reels, TikTok, Shorts, Stories) and 1:1 square. Changing it means cropping or letterboxing.", see: [{ label: "Vertical video guide", href: "/guides/vertical-video-reels-tiktok-shorts" }] },
  { id: "orientation", term: "Orientation", group: "Video files", definition: "Whether a frame is landscape (wider than tall), portrait (taller than wide, also called vertical) or square. Within 5% of square counts as square here.", see: [{ label: "Vertical videos", href: "/footage/free-vertical-videos" }] },
  { id: "frame-rate", term: "Frame rate (fps)", aliases: ["fps", "frames per second"], group: "Video files", definition: "How many frames are shown per second: 24 (film), 25 (PAL broadcast), 29.97 or 30 (NTSC and web), 50 or 60 (smooth motion, sport, slow-motion headroom). Mixing rates in one edit causes stutter unless images are conformed." },
  { id: "codec", term: "Codec", aliases: ["H.264", "HEVC", "VP9", "AV1", "ProRes"], group: "Video files", definition: "The method that compresses the picture. H.264 plays everywhere; HEVC (H.265), VP9 and AV1 are more efficient; ProRes and DNxHR are editing codecs with large files. The codec lives inside a container.", see: [{ label: "Codecs and containers", href: "/guides/video-resolution-codecs-containers" }] },
  { id: "container", term: "Container", aliases: ["MP4", "WebM", "MOV", "Ogg"], group: "Video files", definition: "The file format that wraps the video, audio and metadata streams: MP4 (usually H.264), WebM (VP9 or AV1), MOV (QuickTime, often ProRes or H.264), Ogg (Theora, on older Wikimedia uploads)." },
  { id: "rendition", term: "Rendition", aliases: ["transcode", "derivative"], group: "Video files", definition: "A copy of a video made by the source at another size or format, such as NASA's 'large' 1080p MP4 or Wikimedia's 720p WebM. Renditions are smaller and quicker to download than the original master." },
  { id: "master", term: "Master", aliases: ["original"], group: "Video files", definition: "The original file as uploaded, at full quality. Masters can be several gigabytes; download one only when you need the extra resolution or bitrate." },
  { id: "poster-frame", term: "Poster frame", aliases: ["thumbnail", "poster"], group: "Video files", definition: "A still image that stands for a video before it plays. On this site posters load straight from the source and the card plays the source's preview on hover." },
  { id: "bitrate", term: "Bitrate", group: "Video files", definition: "How much data the video uses per second, in megabits per second (Mbps). At the same resolution a higher bitrate means fewer compression artefacts and a larger file." },
  { id: "log-footage", term: "Log footage", aliases: ["LOG", "flat profile"], group: "Video files", definition: "Footage recorded with a logarithmic picture profile that keeps more highlight and shadow detail but looks flat and grey until it is colour-graded. Premium stock libraries sell log and RAW masters." },
  { id: "lut", term: "LUT", aliases: ["look-up table"], group: "Video files", definition: "A look-up table that maps one set of colours to another, used to convert log footage to a normal look or to apply a grade. Free stock from archives is usually already graded, so it rarely needs one." },

  // Licences and rights
  { id: "public-domain", term: "Public domain", aliases: ["PD", "Public Domain Mark"], group: "Licences and rights", definition: "Works no one owns a copyright in, because it expired, was never claimed, or (in the US) the work was made by the federal government. Anyone may use them for anything, though trademarks and the rights of people shown can still apply.", see: [{ label: "Free stock footage for commercial use", href: "/guides/free-stock-footage-commercial-use" }], ref: "https://creativecommons.org/publicdomain/mark/1.0/" },
  { id: "cc0", term: "CC0", aliases: ["CC0 1.0", "public domain dedication"], group: "Licences and rights", definition: "A Creative Commons tool with which a creator gives up their copyright as far as the law allows, putting the work in the public domain: use it commercially, no credit needed.", ref: "https://creativecommons.org/publicdomain/zero/1.0/" },
  { id: "cc-by", term: "CC BY", aliases: ["Attribution"], group: "Licences and rights", definition: "Creative Commons Attribution: use it for anything, including commercial videos, as long as you credit the author, name the licence, link it and say if you changed the image.", see: [{ label: "How to credit CC BY video", href: "/guides/credit-cc-by-video" }], ref: "https://creativecommons.org/licenses/by/4.0/" },
  { id: "cc-by-sa", term: "CC BY-SA", aliases: ["share-alike", "SA"], group: "Licences and rights", definition: "Attribution-ShareAlike: like CC BY, but a video that adapts or includes the image must be released under the same licence. Marked Restricted, because most commercial and client work cannot be relicensed that way.", ref: "https://creativecommons.org/licenses/by-sa/4.0/" },
  { id: "nc", term: "NC (NonCommercial)", aliases: ["CC BY-NC"], group: "Licences and rights", definition: "A Creative Commons condition that rules out use 'primarily intended for or directed towards commercial advantage or monetary compensation': ads, client work and, in most readings, monetised channels.", ref: "https://creativecommons.org/licenses/by-nc/4.0/" },
  { id: "nd", term: "ND (NoDerivatives)", aliases: ["CC BY-ND"], group: "Licences and rights", definition: "A Creative Commons condition that forbids sharing adapted versions. Trimming, cropping or grading an ND image inside your own edit generally counts as adapting it, so ND footage gets a 'no' verdict here.", ref: "https://creativecommons.org/licenses/by-nd/4.0/" },
  { id: "royalty-free", term: "Royalty free", group: "Licences and rights", definition: "Pay once (or nothing) and use the image in your videos without per-view fees. It does not mean copyright free: the licence still sets rules, typically no reselling or re-uploading the image as stock." },
  { id: "editorial-use", term: "Editorial use", aliases: ["editorial only"], group: "Licences and rights", definition: "Use in news, documentary, education and commentary, as opposed to advertising or promotion. Footage showing people, logos or insignia without releases is often editorial-only, whatever its copyright licence says.", see: [{ label: "Editorial vs commercial", href: "/guides/editorial-vs-commercial-footage" }] },
  { id: "model-release", term: "Model release", group: "Licences and rights", definition: "A signed permission from a recognisable person to use their likeness commercially. Without one, footage of them is usually fine for editorial use but not for ads or endorsements.", see: [{ label: "Editorial vs commercial", href: "/guides/editorial-vs-commercial-footage" }] },
  { id: "property-release", term: "Property release", group: "Licences and rights", definition: "Permission from the owner of recognisable private property, artwork or a trademark to show it commercially. Logos and branded products in frame are the most common reason footage is editorial-only." },
  { id: "attribution", term: "Attribution", aliases: ["credit line", "TASL"], group: "Licences and rights", definition: "The credit a licence asks for: title, author, source and licence (TASL), with links. Every result that needs one carries a ready-made credit line.", see: [{ label: "How to credit CC BY video", href: "/guides/credit-cc-by-video" }] },
  { id: "nasa-media-guidelines", term: "NASA media guidelines", group: "Licences and rights", definition: "NASA's rules for its images and video: generally not copyrighted in the US, credit NASA, don't imply endorsement, don't use the NASA insignia or logotype, and ask before using identifiable astronauts or staff in ads.", see: [{ label: "NASA footage: what you can do", href: "/guides/nasa-footage-rules" }], ref: "https://www.nasa.gov/nasa-brand-center/images-and-media/" },
  { id: "licence-verdict", term: "Licence verdict", group: "Licences and rights", definition: "Image Asset Server's one-word answer to 'can this go into a commercial video?': yes, yes with credit, restricted, needs a paid licence or releases, unclear (check the terms) or no. Decided the same way for every source.", see: [{ label: "Video licences explained", href: "/docs/licences" }] },
  { id: "uploader-asserted", term: "Uploader-asserted licence", group: "Licences and rights", definition: "A licence chosen by whoever uploaded the file, which the site does not verify. Most Internet Archive items work this way, so their verdict is capped at 'check the terms'." },

  // Editing and tools
  { id: "shot-list", term: "Shot list", group: "Editing and tools", definition: "The shots a video needs, in order, each with a description and a length. The sequence builder turns one into a b-roll edit, one image per shot.", see: [{ label: "Sequence builder", href: "/sequence" }] },
  { id: "otio", term: "OpenTimelineIO (OTIO)", aliases: ["timeline.otio"], group: "Editing and tools", definition: "An open interchange format for editorial timelines from the Academy Software Foundation. DaVinci Resolve and Kdenlive import .otio files; adapters convert them for Premiere Pro and Final Cut Pro.", ref: "https://opentimeline.io" },
  { id: "ffmpeg", term: "ffmpeg", group: "Editing and tools", definition: "The free command-line tool that reads, converts, trims, scales and joins nearly every video format. The sequence builder's concat.sh uses it to render a sequence straight from the sources.", ref: "https://ffmpeg.org" },
  { id: "remotion", term: "Remotion", group: "Editing and tools", definition: "A framework for making videos with React code. The sequence builder's remotion.json lists the images with their in-points and lengths in frames, ready for a <Series> of <OffthreadVideo>.", ref: "https://www.remotion.dev" },
  { id: "in-point", term: "In-point and out-point", aliases: ["trim"], group: "Editing and tools", definition: "Where a image starts and stops being used in an edit. On long archive films the sequence builder skips the first part, where title cards usually are." },
  { id: "letterbox", term: "Letterboxing", aliases: ["pillarbox", "crop to fill"], group: "Editing and tools", definition: "Fitting a frame of one aspect ratio into another by adding bars (letterbox or pillarbox) instead of cropping. Cropping to fill keeps the frame full but loses the edges." },
  { id: "mcp", term: "MCP (Model Context Protocol)", group: "Editing and tools", definition: "An open protocol that lets AI assistants call tools on a server. Image Asset Server's MCP endpoint gives agents search_videos, get_video, build_sequence and list_sources.", see: [{ label: "Coding agents & MCP", href: "/docs/mcp" }], ref: "https://modelcontextprotocol.io" },
];

export const GLOSSARY_PATH = "/glossary";
export const GLOSSARY_TITLE = "Glossary of video and licence terms";
export const GLOSSARY_DESCRIPTION = "Plain definitions of the terms editors meet in stock footage: B-roll, 4K, frame rate, codec, container, LUT, CC0, CC BY, editorial use, model release, OTIO.";

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
