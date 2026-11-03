---
layout: ../../layouts/DocsLayout.astro
title: Image licences explained
crumb: Image licences explained
description: What CC0, public domain, CC BY, BY-SA, NC and ND, museum open access, NASA media, icon-set licences and editorial images mean for commercial use.
---

# Image licences explained

Every image Image Asset Server returns carries a **licence**, a **verdict** that answers "can this go into something I publish commercially?", and an **editorial** flag when people, insignia or brands appear without releases. This page explains the licences you will meet, how the verdict is decided, and what to do with each. It is practical guidance, not legal advice.

"Commercial use" here means anything that earns money or promotes something: an ad, a product page or packaging, a client website, a book or magazine you sell, merchandise, a paid course.

## The verdicts

| Verdict | API value | What you can do |
| --- | --- | --- |
| Commercial use OK | `yes` | Use it anywhere, including ads, products and client work. No credit needed. |
| Commercial use OK with credit | `yes-with-credit` | Same, as long as you credit the source with the `attribution` line. |
| Restricted: read the conditions | `restricted` | Allowed only under conditions that rule out most projects (share-alike). |
| Needs a paid licence or releases | `clearance-required` | Paid stock: license it per use or by subscription before publishing. |
| Unclear: check the terms | `check-terms` | Nobody verified the rights, or a third party may own the image. |
| Non-commercial only | `no` | Study, teaching and personal projects only. |

The **Commercial-safe** switch (`commercial=true` in the API, `commercial_only` in MCP, on by default for agents) keeps only the first two.

## The editorial flag

A licence covers the copyright in the picture. It does not cover the **people** in it, the **brands and logos** in it, or an organisation's **insignia**. When those appear without model or property releases, an image is fine for editorial use (articles, books, education, commentary) but not for advertising, packaging or anything that implies endorsement.

NASA images always carry the flag: NASA forbids using its insignia and logotype, implying endorsement, or showing identifiable astronauts and staff in ads without permission.

## Licences you will meet

### CC0 and public domain → `yes`

No conditions: copy, crop, recolour, print and sell. **Museum open access** belongs here: the Met, the Art Institute of Chicago and the Cleveland Museum of Art release photographs of their public-domain works as CC0, and US government works (most NASA images) are not copyrighted in the US. A credit is still good manners.

### CC BY → `yes-with-credit`

Use it for anything, with a credit: title, author, source and licence, linked where you can, and a note if you changed it. Put it in a caption, next to the image, or on a credits page readers can find. See [How to credit CC BY images](/guides/credit-cc-by-images).

### CC BY-SA → `restricted`

Share-alike: an adapted version of the image (cropped, recoloured, composited) must be released under the same licence. Showing it unchanged in a larger work is fine with credit, but most commercial designs edit their images, so this is marked restricted.

### CC BY-ND → `no`

No derivatives: you may show the image only as it is. Cropping, retouching, adding text on top or compositing it all make a derivative, which is not allowed. Since that rules out most real use, ND is marked non-commercial-only here.

### CC BY-NC (and NC-SA, NC-ND) → `no`

Non-commercial use only, whatever you credit.

### Icon-set licences: MIT, Apache 2.0, ISC → `yes-with-credit`; SIL OFL → `yes`

Open-source icon sets (through Iconify) use software licences. All allow commercial use and modification. MIT, Apache 2.0 and ISC ask you to keep the copyright and licence notice with copies you distribute: for a website or app, list the set in your third-party notices; no visible credit next to each icon is needed. The SIL Open Font License allows any use but forbids selling the icons on their own.

### NASA media → `yes-with-credit`, editorial

Generally not copyrighted in the US; credit NASA as the image does (for example *NASA/JPL-Caltech*). Images credited to partners (ESA, the Canadian Space Agency, universities, companies) may be copyrighted by them and are marked `check-terms`. See [Using NASA images](/guides/nasa-image-rules).

### Library rights statements → `yes` or `check-terms`

The Library of Congress gives each item a rights statement. *No known restrictions on publication* is shown as `yes` (credit the collection as a courtesy). *Rights status not evaluated* and *Publication may be restricted* are `check-terms`.

### Free stock licences (Unsplash, Pexels, Pixabay) → `yes`

Free for commercial use, no credit required, but you may not sell the photos unaltered or build a competing service from them. These sites are linked, not searched.

### Paid stock → `clearance-required`

Shutterstock, Adobe Stock, Getty Images, iStock and Alamy: buy a licence before publishing.

## How the verdict is decided

1. The source's own licence data is read per image (Wikimedia's file metadata, Openverse's licence fields, Iconify's set licences, the museums' public-domain flags, the Library of Congress rights statement, NASA's credit line).
2. It is mapped to an SPDX id where one exists (`CC0-1.0`, `CC-BY-4.0`, `MIT`…) and the verdict follows the rules above.
3. A licence stated only by an anonymous uploader is capped at `check-terms`.
4. The editorial flag is added for NASA images and wherever the source signals unreleased people or insignia.

## What this page is not

Verdicts summarise licences so you can filter quickly. They are not legal advice. For anything important (a national ad campaign, packaging, a book cover), read the licence linked on the image and, when in doubt, ask the rights holder.
