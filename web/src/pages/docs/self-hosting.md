---
layout: ../../layouts/DocsLayout.astro
title: Self-hosting
crumb: Self-hosting
description: Run your own Image Asset Server with Docker or Node.js, protect it with an API key, let the MCP server download to disk, and expose Prometheus metrics.
---

# Self-hosting Image Asset Server

Image Asset Server is open source (Apache-2.0). Run your own copy to put it behind an API key, let the MCP server write images to a shared disk, pick which sources it searches, or keep searches on your own network. No source needs an API key.

## Docker

```bash
docker run -p 8787:8787 ghcr.io/arielshad/image-asset-server
```

Open http://localhost:8787 for the website, `/v1/*` for the API and `/mcp` for MCP. Behind a TLS proxy, set `IMAGE_SERVER_PUBLIC_URL=https://images.example.com` so the links handed to MCP clients and share links use your public address.

## Node.js

```bash
git clone https://github.com/arielshad/image-asset-server
cd image-asset-server
npm ci && npm --prefix web ci && npm run build
npm start
```

Node 20 or newer (the Docker image uses Node 22).

## No image bytes through the server

The server is light because it never handles image files: it searches the sources, reads their metadata, decides licence verdicts and writes credit files. The website's thumbnails, previews and detail view load straight from the sources, and `/v1/images/{id}/download` answers with a `302` to the file on the source. Bandwidth and CPU stay low whatever people look at; only the MCP `download_image` tool and the CLI's `download` and `set --download` fetch files, and they write to the disk of whoever runs them.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` / `HOST` | `8787` / `0.0.0.0` | HTTP bind address. |
| `IMAGE_SERVER_API_KEY` | none | Require `Authorization: Bearer <key>` or `x-api-key` on `/v1/*` and `/mcp`. Keys are accepted in headers only, never in the URL. The website asks for it and sends it as a header. |
| `IMAGE_SERVER_PUBLIC_URL` | request origin | Base URL used in links handed to MCP clients and in share links. Set it behind a TLS proxy. |
| `IMAGE_SERVER_PROVIDERS` | all | Comma list to enable only some sources (e.g. `nasa,met,wikimediacommons`). |
| `IMAGE_DOWNLOAD_DIR` | `./images` | Where MCP and CLI downloads go (`<dir>/<category>/…`, with `ATTRIBUTION.md` and `credits.json`). |
| `IMAGE_SERVER_HTTP_DOWNLOADS` | `false` | Expose `download_image` on the HTTP MCP endpoint (writes to the server's disk). |
| `IMAGE_SERVER_HTTP_MCP` | `true` | Set to `false` to turn off MCP over HTTP at `/mcp`. The website and `/v1` API keep working, and the stdio MCP server is unaffected. |
| `IMAGE_SERVER_PROVIDER_TIMEOUT_MS` | `12000` | Per-source search timeout. |
| `IMAGE_SERVER_HTTP_TIMEOUT_MS` | `15000` | Timeout for each request to a source. |
| `IMAGE_SERVER_CACHE_TTL_MS` | `600000` | How long source responses are cached in memory (10 minutes). |
| `IMAGE_SERVER_MAX_DOWNLOAD_BYTES` | 8 GiB | Cap for one local download. |
| `IMAGE_SERVER_DOWNLOAD_IDLE_MS` | `30000` | Abort a local download when no bytes arrive for this long. |
| `IMAGE_SERVER_USER_AGENT` | built in | The User-Agent sent to sources. Keep it descriptive with contact details: Wikimedia limits clients without one to about 10 requests a minute. |
| `IMAGE_SERVER_RATE_LIMIT` | `120` | Requests per client per window on `/v1/*` and `/mcp`, with RateLimit headers and `429` + `Retry-After` beyond it. `0` turns it off. |
| `IMAGE_SERVER_RATE_LIMIT_WINDOW` | `60` | Rate-limit window in seconds. |
| `METRICS_PORT` | off | Serve Prometheus metrics on this separate port at `/metrics`, and log one JSON line per search, download and tool call. |
| `PROMETHEUS_URL` | off | Prometheus that scrapes `METRICS_PORT`. `/v1/stats` and the `/stats` page then show the last 24 hours and 7 days; without it they count since the server started. |
| `MAXMIND_ACCOUNT_ID`, `MAXMIND_LICENSE_KEY` | off | With `METRICS_PORT`: download MaxMind's free GeoLite2-ASN database (refreshed weekly) to label MCP callers by network (ISP, AWS, Google Cloud, Azure, other hosting). |
| `IMAGE_SERVER_ASN_DB` | none | Path to a GeoLite2-ASN `.mmdb` file to use instead of downloading one. |
| `IMAGE_SERVER_SESSION_SECRET` | random | Signs the MCP session IDs that carry each client's declared name. Set it so sessions keep their label across restarts. |
| `IMAGE_SERVER_TELEMETRY` | off | `1` to send anonymous usage counts to the maintainers (also needs `IMAGE_SERVER_TELEMETRY_WEBSITE_ID`; see [Privacy](/privacy)). `DO_NOT_TRACK=1` always turns it off. |
| `UMAMI_WEBSITE_ID`, `UMAMI_HOST` | off | Add your own self-hosted Umami tracker to the website pages (cookieless page views). |

## Analytics

With `METRICS_PORT` set, the server exports Prometheus metrics with bounded labels only (surface, client family, source, status, tool):

- `image_server_searches_total`, `image_server_search_duration_seconds`, `image_server_search_results`
- `image_server_provider_requests_total` and `image_server_provider_duration_seconds` for each source's health and latency
- `image_server_image_views_total`, `image_server_downloads_total`
- `image_server_mcp_tool_calls_total` and `image_server_mcp_tool_duration_seconds` by tool, client family (Claude Code, Cursor, VS Code, …), network and consistency (whether the declared client, User-Agent and network agree)
- `image_server_mcp_connects_total` and `image_server_mcp_new_callers_total` (first tool call of the day per caller, counted from a hash with a daily salt)
- `image_server_http_requests_total`, `image_server_http_request_duration_seconds`, `image_server_page_views_total`

The [/stats](/stats) page and `GET /v1/stats` read these counters back: from Prometheus when `PROMETHEUS_URL` is set, otherwise from this process since it started.

Each search also logs a JSON line (`{"event":"search","query":…,"results":…}`) for top-query and zero-result analysis. Nothing personal is recorded with it: no IP addresses, keys or cookies.

## Stdio MCP

```bash
node dist/cli.js mcp      # or: npx -y image-asset-server mcp
```

Runs the MCP server over stdio with `download_image` and `build_image_set` downloads (`download=true`) enabled, for desktop clients that launch a local process. Downloads go to `IMAGE_DOWNLOAD_DIR`.

## Content Security Policy

The website ships with a strict Content-Security-Policy (no inline scripts or styles except by hash or per-request nonce). Thumbnails and previews load from the sources, so `img-src` allows `https:`; keep that in mind if you put a proxy in front that rewrites headers.
