/** Minimal typed client for the server's REST API (same origin). Shapes follow src/core/types.ts. */

export interface License {
  id: string;
  name: string;
  url?: string;
  commercialUse?: boolean;
  attributionRequired?: boolean;
  shareAlike?: boolean;
  redistribution?: boolean;
  /** People, insignia or brands without releases: articles/education, not ads. */
  editorial?: boolean;
  assertedBy?: "source" | "site" | "uploader";
  verdict: string;
  note?: string;
}
export interface Price { free: boolean; amount?: number; currency?: string }
export interface ImageAsset {
  id: string;
  provider: string;
  nativeId?: string;
  title: string;
  description?: string;
  url: string;
  author?: string;
  authorUrl?: string;
  tags: string[];
  category: string;
  styles?: string[];
  orientation?: "landscape" | "portrait" | "square";
  width?: number;
  height?: number;
  /** Scalable vector art (SVG): any size. */
  vector?: boolean;
  /** Transparent background (icons, SVGs, PNG cut-outs). */
  transparent?: boolean;
  year?: number;
  /** Small version for grids, loaded by the browser straight from the source. */
  thumbnailUrl?: string;
  /** Display-size version (≈800–1600 px), straight from the source. */
  previewUrl?: string;
  formats?: string[];
  license?: License;
  attribution?: string;
  price?: Price;
  requiresAccount?: boolean;
  downloadable: boolean;
  score?: number;
}
export interface ImageFile {
  url: string;
  filename: string;
  format: string;
  mime?: string;
  role: "original" | "rendition" | "thumbnail";
  width?: number;
  height?: number;
  sizeBytes?: number;
  requiresAuth?: boolean;
}
export interface ImageDetails extends ImageAsset {
  files: ImageFile[];
  /** The file a browser should show in a detail view, straight from the source. */
  display?: { url: string; type?: string; width?: number; height?: number };
  shareUrl?: string;
}
export interface ProviderReport {
  provider: string;
  name: string;
  status: "ok" | "error" | "timeout" | "skipped" | "link";
  count: number;
  total?: number;
  searchUrl?: string;
  error?: string;
  filteredLocally?: string[];
  tookMs: number;
}
/** The filters in force after the server parsed the query ("4k vertical png"). */
export interface ParsedFilters {
  categories?: string[];
  styles?: string[];
  orientations?: string[];
  minResolution?: number;
  transparent?: boolean;
  formats?: string[];
  commercialOnly?: boolean;
  freeOnly?: boolean;
}
export interface SearchResponse { query: string; filters?: ParsedFilters; results: ImageAsset[]; providers: ProviderReport[] }
export interface Provider { id: string; name: string; description: string; supportsDownload: boolean; access?: string; categories?: string[] }

const KEY_STORE = "image-asset-server-key";
export class UnauthorizedError extends Error {}

export function getKey(): string {
  try {
    return localStorage.getItem(KEY_STORE) ?? "";
  } catch {
    return "";
  }
}
export function setKey(k: string): void {
  try {
    localStorage.setItem(KEY_STORE, k);
  } catch {
    /* private mode */
  }
}

/** Headers for every same-origin API call. The key travels only as a header, never in a URL. */
export function apiHeaders(extra: Record<string, string> = {}): Record<string, string> {
  // x-image-client lets the server's analytics tell website traffic from other API users.
  const headers: Record<string, string> = { "x-image-client": "web", ...extra };
  const key = getKey();
  if (key) headers["x-api-key"] = key;
  return headers;
}

export async function api<T>(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? "GET",
    headers: apiHeaders(init.body !== undefined ? { "content-type": "application/json", accept: "application/json" } : { accept: "application/json" }),
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: init.signal,
  });
  if (res.status === 401) throw new UnauthorizedError("This server needs an API key.");
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
  return body;
}

/** `/v1/images/<id>`: ids hold ":", spaces and slashes, so they are always encoded. */
export const imageBase = (id: string) => `/v1/images/${encodeURIComponent(id)}`;

export function formatBytes(n?: number): string {
  if (n == null) return "";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i > 1 ? 1 : 0)} ${u[i]}`;
}

/** Only ever put https/http URLs into href/src: results come from third-party sites. */
export function safeUrl(u?: string): string | undefined {
  if (!u) return undefined;
  try {
    const p = new URL(u, typeof window === "undefined" ? "https://localhost" : window.location.href);
    return p.protocol === "https:" || p.protocol === "http:" ? p.href : undefined;
  } catch {
    return undefined;
  }
}

/** A filesystem-friendly name: "Crab Nebula 01" -> "crab-nebula-01". */
export const slugName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "image";

/** Save text as a file from the browser (image set exports). */
export function saveText(filename: string, text: string, type = "text/plain"): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
}
