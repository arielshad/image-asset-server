---
title: "How to credit CC BY images on websites, slides and print"
seoTitle: "How to credit CC BY images (with examples)"
description: "The credit line a CC BY image needs (title, author, source, licence, changes) and where to put it on a web page, a slide, a social post or in print."
answer: "Name the image, its author, where it came from and its licence with a link, and say if you changed it, for example: “Lake Louise at sunrise” by Jane Doe (Wikimedia Commons), CC BY 4.0, cropped. Put it next to the image (a caption or overlay), or on a credits page or slide that readers can find. Image Asset Server writes this line for every image that needs one."
section: Licensing
kind: howto
steps:
  - name: "Collect the facts when you download"
    text: "Note the image's title, the author's name, the URL of its page and the exact licence with its version. The attribution field, credits.json and ATTRIBUTION.md contain all four."
  - name: "Write one line per image"
    text: "Use the TASL pattern: Title, Author, Source, Licence. Link the source page and the licence, and add a word about changes such as 'cropped', 'colour-adjusted' or 'background removed'."
  - name: "Put the credit where readers look"
    text: "On a web page, in a <figcaption> or a small line under the image. In slides, on the slide or a final credits slide. On social posts, in the caption. In print, next to the image or in a picture-credits section."
  - name: "Keep the record"
    text: "Store the credit lines with the project. If a client or a rights holder asks where a picture came from, you can answer in a minute."
faq:
  - q: "Do I have to credit CC0 or public-domain images?"
    a: "No. A short credit such as 'Image: The Met (CC0)' is a courtesy many publishers include anyway, and it helps readers find the original."
  - q: "Can I put all the credits on one page?"
    a: "Yes. CC BY allows any reasonable manner based on the medium. A credits page linked from every page that uses the images is common on websites."
  - q: "What if the author's real name isn't given?"
    a: "Use the name or username they publish under. CC BY asks you to credit the creator in the way they requested, if they did."
  - q: "Is a credit enough for CC BY-SA or CC BY-NC images?"
    a: "No. A credit satisfies CC BY. Share-alike adds the obligation to license an edited version the same way, and non-commercial forbids commercial use whatever you credit."
searches:
  - { label: "CC BY photos with ready credit lines", href: "/search?q=lighthouse&providers=wikimediacommons&commercial=true" }
  - { label: "NASA images (credit NASA)", href: "/search?q=saturn&providers=nasa" }
collections: [free-4k-nature-photos, vintage-maps, hubble-space-images]
related: [free-images-commercial-use, nasa-image-rules, ai-agent-find-and-license-images]
cites:
  - { name: "CC BY 4.0 legal code, section 3(a): attribution", url: "https://creativecommons.org/licenses/by/4.0/legalcode.en#s3a" }
  - { name: "Creative Commons: recommended practices for attribution", url: "https://wiki.creativecommons.org/wiki/Recommended_practices_for_attribution" }
  - { name: "Wikimedia Commons: reusing content outside Wikimedia", url: "https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia" }
published: 2026-11-03
updated: 2026-11-03
order: 2
---

## What CC BY asks for

CC BY lets you copy, edit and use an image for anything, commercial use included, on one condition: credit. The licence asks for the creator's name, a copyright notice if there is one, a link to the licence, a link to the source, and an indication if you changed the image.

## A good credit line

> “Lake Louise at sunrise” by Jane Doe (Wikimedia Commons, https://commons.wikimedia.org/wiki/File:…), CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/), cropped.

Shorter forms work where space is tight, as long as the links are reachable: *Photo: Jane Doe / Wikimedia Commons, CC BY 4.0*, linked to the file page.

## On a web page

The most natural place is a caption:

```html
<figure>
  <img src="lake-louise.jpg" alt="Lake Louise at sunrise" width="1920" height="1280">
  <figcaption><a href="https://commons.wikimedia.org/wiki/File:…">Lake Louise at sunrise</a> by Jane Doe, <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a></figcaption>
</figure>
```

The [image set builder](/build) writes exactly this in `credits.html` for every pick.

## Icons

Most open-source icon sets use MIT, Apache 2.0, ISC or the SIL Open Font License. They don't ask for a visible credit next to each icon: keep the set's licence notice with your app's or site's third-party notices. A few icon sets are CC BY and do need a visible credit.
