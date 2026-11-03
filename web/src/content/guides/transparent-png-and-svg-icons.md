---
title: "Free SVG icons and transparent PNGs: finding and using them"
seoTitle: "Free SVG icons and transparent PNGs"
description: "Find free SVG icons and transparent cut-outs, check their licences (MIT, Apache, OFL, CC BY), and use them on any background, in any colour and size."
answer: "Search for the subject plus 'icon', 'svg' or 'transparent' (for example 'rocket icon' or 'coffee cup transparent png'): those words become filters. Icons come from open-source sets through Iconify, as SVGs that scale to any size and recolour with CSS. Their licences (MIT, Apache 2.0, ISC, OFL) allow commercial use; keep the set's licence notice. Transparent results sit on a checkerboard so you can see the edges."
section: Production
kind: howto
steps:
  - name: "Search with the right words"
    text: "Add 'icon', 'svg', 'vector' or 'transparent' to the query, or pick Icon, Vector or Transparent in the filters. 'svg' keeps only vector files; 'transparent' keeps images with a transparent background."
  - name: "Check the set's licence"
    text: "Each icon shows its set's licence. MIT, Apache 2.0, ISC and OFL allow commercial use without a visible credit; CC BY sets need one."
  - name: "Download the SVG"
    text: "SVG files scale to any size. Download from the detail view, or copy the file URL into your build: Iconify serves every icon as a plain SVG."
  - name: "Recolour and size it"
    text: "Iconify icons use currentColor: set color in CSS and they follow your text colour. Set width and height, or use 1em to match the font size."
faq:
  - q: "Do I need to credit MIT-licensed icons?"
    a: "Not next to the icon. MIT asks you to include the copyright and licence notice with copies you distribute: list the icon set in your app's or site's open-source notices."
  - q: "Can I use an icon as my logo?"
    a: "Open-source licences usually allow it, but you can't register someone else's icon as your trademark, and other companies may use the same icon. Design your own logo for a brand."
  - q: "Why does a transparent PNG show a checkerboard?"
    a: "The checkerboard is drawn behind the image on this site so you can see its transparent areas. It is not part of the file."
searches:
  - { label: "Rocket icons", href: "/search?q=rocket+icon" }
  - { label: "SVG drawings on Wikimedia Commons", href: "/search?q=diagram&format=svg" }
collections: [free-svg-icons, paper-textures-backgrounds]
related: [free-images-commercial-use, ai-agent-find-and-license-images]
cites:
  - { name: "Iconify: icon sets and licences", url: "https://icon-sets.iconify.design/" }
  - { name: "MIT License", url: "https://opensource.org/license/mit" }
  - { name: "SIL Open Font License", url: "https://openfontlicense.org/" }
published: 2026-11-03
updated: 2026-11-03
order: 5
---

## SVG or PNG?

**SVG** is a vector format: shapes described as maths, sharp at every size, a few kilobytes, recolourable with CSS. Use it for icons, simple illustrations, diagrams and maps.

**PNG** is a bitmap with optional transparency. Use it for photographic cut-outs (a coffee cup, a person) at the size you will show them.

## Icons in a web page

```html
<img src="https://api.iconify.design/mdi/rocket.svg?color=%237c5cff" width="24" height="24" alt="">
```

Or inline the SVG so it takes the text colour. Decorative icons get an empty `alt`; icons that act as buttons need a label.

## Where the icons come from

Iconify gathers about 200 open-source sets, including Material Symbols, Tabler, Phosphor, Lucide, Remix and Font Awesome Free. Sites such as Flaticon, The Noun Project and SVG Repo can't be searched automatically, so each search also links to the same query there.
