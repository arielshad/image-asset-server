---
layout: ../layouts/PageLayout.astro
title: Contact
description: How to reach the Image Asset Server maintainers for support, bug reports, security issues, source and licence questions, and requests from image sites.
schemaType: ContactPage
---

# Contact

Image Asset Server is maintained in the open on GitHub. There is no support email or phone line: GitHub is the fastest way to reach the people who run it.

## Support and bug reports

Open an issue at [github.com/arielshad/image-asset-server/issues](https://github.com/arielshad/image-asset-server/issues). Helpful details: the search query or image id (for example `nasa:PIA03606`), the URL or MCP tool you called, what you expected and what happened. For API problems, include the response status and body. For an image that won't load, say which browser you used.

## Security

Please do not open a public issue for a vulnerability. Report it privately through GitHub's security advisories at [github.com/arielshad/image-asset-server/security/advisories/new](https://github.com/arielshad/image-asset-server/security/advisories/new). You will get an acknowledgement, and fixes are released as soon as they are ready.

## Image sites and licences

If you run one of the sites the service searches or links to and want your source changed, rate-limited further or removed, or if a licence or verdict is shown incorrectly, open an issue with the image id or source name. Requests from site owners are handled first. Images are never hosted here, so questions about using a specific image go to its creator on the source site.

If you are a creator and believe a image of yours appears under the wrong licence on a source site, contact that site first: Image Asset Server shows what the source states, and will mark or hide the result once the source corrects it.

## Partnerships and integrations

Building something on top of the API or the MCP server, or want your image library added as a source? Open an issue describing the integration. Sources are searched directly only when their terms allow automated search and the integration passes the test suite against the live site; the others get deep links.
