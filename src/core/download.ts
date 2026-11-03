import { createWriteStream } from "node:fs";
import { lookup } from "node:dns/promises";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import { isIP } from "node:net";
import { basename, dirname, extname, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Zip, ZipPassThrough } from "fflate";
import type { ImageDetails, ImageFile, HttpClient } from "./types.js";
import { BROWSER_DISPLAYABLE, IMAGE_MIME } from "./vocab.js";

export interface FileSelection {
  /**
   * Wanted width in pixels (e.g. 1600 for a web hero, 4000 for print). Picks
   * the smallest file at least that wide, else the largest below it. Vector
   * originals (SVG) always qualify.
   */
  width?: number;
  /** Desired format, e.g. "jpg", "png", "svg". */
  format?: string;
  /** Desired role. Default: the original, else the biggest rendition. */
  role?: ImageFile["role"];
  /** Return every file that can be fetched (ignores the smart defaults). */
  all?: boolean;
}

const FULL_ROLES = new Set<ImageFile["role"]>(["original", "rendition"]);
/** Most widely usable format first: jpg/png open everywhere, TIFF is huge. */
const FORMAT_RANK = new Map<string, number>(["jpg", "png", "webp", "svg", "gif", "avif", "tif", "bmp"].map((f, i) => [f, i]));

function formatRank(f: ImageFile): number {
  return FORMAT_RANK.get(f.format) ?? 50;
}

function size(f: ImageFile): number | undefined {
  return f.width;
}

function matchesFormat(f: ImageFile, fmt: string): boolean {
  const want = fmt.toLowerCase().replace(/^\./, "").replace(/^jpeg$/, "jpg").replace(/^tiff$/, "tif");
  return f.format === want;
}

/** Bigger first, then the more usable format, then the bigger file. */
function byQuality(a: ImageFile, b: ImageFile): number {
  return (size(b) ?? 0) - (size(a) ?? 0) || formatRank(a) - formatRank(b) || (b.sizeBytes ?? 0) - (a.sizeBytes ?? 0);
}

/**
 * Pick the file to download for an image.
 * Default: the original, else the biggest rendition. With `width`, the
 * smallest file that is at least that wide (a 1920 px copy rather than a
 * 60 MB TIFF master), else the biggest one below it; an SVG original always
 * fits. Files that need a login and grid thumbnails are never picked unless
 * asked for.
 */
export function selectFiles(image: Pick<ImageDetails, "files">, sel: FileSelection = {}): ImageFile[] {
  let files = image.files.filter((f) => !f.requiresAuth);
  if (sel.all) return files;
  files = sel.role ? files.filter((f) => f.role === sel.role) : files.filter((f) => FULL_ROLES.has(f.role));
  if (sel.format) files = files.filter((f) => matchesFormat(f, sel.format!));
  if (!files.length && !sel.role && !sel.format) files = image.files.filter((f) => !f.requiresAuth && f.role === "thumbnail");
  if (files.length <= 1) return files;

  if (sel.width) {
    const vector = files.find((f) => f.role === "original" && f.format === "svg");
    if (vector) return [vector];
    const target = sel.width * 0.97;
    const above = files.filter((f) => (size(f) ?? (f.role === "original" ? Infinity : 0)) >= target);
    if (above.length) {
      above.sort((a, b) => (size(a) ?? Infinity) - (size(b) ?? Infinity) || formatRank(a) - formatRank(b));
      return [above[0]!];
    }
    return [[...files].sort(byQuality)[0]!];
  }

  for (const role of ["original", "rendition"] as const) {
    const hit = files.filter((f) => f.role === role);
    if (hit.length) return [hit.sort(byQuality)[0]!];
  }
  return [[...files].sort(byQuality)[0]!];
}

/**
 * The file the browser should show in the detail view, straight from the
 * source: a format every browser displays, as close to 1280 px wide as
 * possible (sharp on a laptop, small enough to load fast).
 */
export function pickDisplay(image: Pick<ImageDetails, "files" | "previewUrl" | "thumbnailUrl">): { url: string; type?: string; width?: number; height?: number } | undefined {
  const shown = image.files.filter((f) => !f.requiresAuth && !f.headers && BROWSER_DISPLAYABLE.has(f.format) && (f.sizeBytes === undefined || f.sizeBytes < 15_000_000));
  if (shown.length) {
    const score = (f: ImageFile): number => {
      if (f.format === "svg") return 0;
      const s = size(f);
      if (s === undefined) return f.role === "thumbnail" ? 4 : 2;
      if (s > 2400) return 2 + s / 100_000; // too heavy to show quickly
      return Math.abs(s - 1280) / 1000 + (f.role === "thumbnail" ? 0.5 : 0);
    };
    const best = [...shown].sort((a, b) => score(a) - score(b))[0]!;
    return { url: best.url, type: best.mime ?? IMAGE_MIME[best.format], width: best.width, height: best.height };
  }
  const url = image.previewUrl ?? image.thumbnailUrl;
  return url ? { url } : undefined;
}

/** True when the selection is only a grid thumbnail. */
export function isPreviewOnly(files: ImageFile[]): boolean {
  return files.length > 0 && files.every((f) => f.role === "thumbnail");
}

export function totalBytes(files: ImageFile[]): number | undefined {
  let sum = 0;
  for (const f of files) {
    if (f.sizeBytes === undefined) return undefined;
    sum += f.sizeBytes;
  }
  return sum;
}

/** Normalise a relative path and refuse anything that escapes its root. */
export function safeRelative(p: string): string {
  const parts = p.replace(/\\/g, "/").split("/").filter((s) => s && s !== ".");
  if (parts.some((s) => s === "..")) throw new Error(`Unsafe path in file list: ${p}`);
  const joined = parts.join("/");
  if (!joined) throw new Error(`Empty path in file list`);
  return joined;
}

/** A file name that is safe on every OS. */
export function safeFilename(name: string, fallback = "image"): string {
  const base = basename(name.replace(/\\/g, "/"));
  const ext = extname(base).toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 8);
  const stem = base
    .slice(0, base.length - extname(base).length)
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
  return `${stem || fallback}${ext}`;
}

// ---------------------------------------------------------------------------
// Outbound URL safety (scraped pages and manifests are untrusted)

const PRIVATE_HOST = /^(localhost|.*\.localhost|.*\.local|.*\.internal|metadata\.google\.internal)$/i;
const PRIVATE_V4 = /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|22[4-9]\.|23\d\.|24\d\.|25[0-5]\.)/;

function isPrivateAddress(addr: string): boolean {
  const a = addr.replace(/^\[|\]$/g, "").toLowerCase();
  if (isIP(a) === 4) return PRIVATE_V4.test(a);
  if (isIP(a) === 6) {
    if (a === "::1" || a === "::") return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(a);
    if (mapped) return PRIVATE_V4.test(mapped[1]!);
    // URL parsing rewrites ::ffff:10.0.0.1 as ::ffff:a00:1.
    const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(a);
    if (hex) {
      const hi = parseInt(hex[1]!, 16);
      const lo = parseInt(hex[2]!, 16);
      return PRIVATE_V4.test(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    return /^(f[cd]|fe[89ab])/.test(a);
  }
  return false;
}

/** Refuse non-http(s) URLs and obvious internal targets, by name and literal address. */
export function assertPublicUrl(url: string): URL {
  const u = new URL(url);
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error(`Refusing non-HTTP URL: ${url}`);
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (PRIVATE_HOST.test(host)) throw new Error(`Refusing internal host: ${host}`);
  if (isPrivateAddress(host)) throw new Error(`Refusing private address: ${host}`);
  return u;
}

type HostResolver = (host: string) => Promise<string[]>;
let resolveHost: HostResolver = async (host) => (await lookup(host, { all: true, verbatim: true })).map((r) => r.address);

/** Tests swap the DNS resolver. */
export function setHostResolver(fn: HostResolver): void {
  resolveHost = fn;
}

/**
 * Like assertPublicUrl, and also resolves the host and refuses names that
 * point at private addresses. A name that doesn't resolve locally (e.g. behind
 * an egress proxy) is allowed: the fetch itself fails if it is unreachable.
 */
export async function assertPublicHost(url: string): Promise<URL> {
  const u = assertPublicUrl(url);
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) return u;
  let addrs: string[] = [];
  try {
    addrs = await resolveHost(host);
  } catch {
    return u;
  }
  if (addrs.some(isPrivateAddress)) throw new Error(`Refusing ${host}: it resolves to a private address`);
  return u;
}

const MAX_REDIRECTS = 5;
export const DOWNLOAD_IDLE_TIMEOUT_MS = Number(process.env.IMAGE_SERVER_DOWNLOAD_IDLE_MS ?? 30_000);

/** GET a file, re-checking every redirect hop; the body is watched for stalls, not capped in time. */
export async function fetchFile(http: HttpClient, url: string, headers: Record<string, string> = {}, signal?: AbortSignal): Promise<Response> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(current);
    const res = await http.raw(current, {
      headers: { accept: "*/*", ...headers },
      redirect: "manual",
      idleTimeoutMs: DOWNLOAD_IDLE_TIMEOUT_MS,
      signal,
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      await res.body?.cancel().catch(() => undefined);
      if (!loc) throw new Error(`Redirect without Location from ${current}`);
      current = new URL(loc, current).toString();
      // Credentials stay with the host they were meant for.
      if (new URL(current).host !== new URL(url).host) headers = withoutAuth(headers);
      continue;
    }
    return res;
  }
  throw new Error(`Too many redirects for ${url}`);
}

function withoutAuth(h: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(h).filter(([k]) => k.toLowerCase() !== "authorization"));
}

// ---------------------------------------------------------------------------
// Local downloads (stdio MCP / CLI)

export interface DownloadOptions {
  /** Abort when the download exceeds this many bytes. */
  maxBytes?: number;
  overwrite?: boolean;
  signal?: AbortSignal;
}

export interface DownloadedFile {
  path: string;
  bytes: number;
  role: ImageFile["role"];
}

export interface DownloadResult {
  directory: string;
  files: DownloadedFile[];
  bytes: number;
  /** True when only a small thumbnail could be fetched. */
  previewOnly: boolean;
}

export const DEFAULT_MAX_DOWNLOAD_BYTES = Number(process.env.IMAGE_SERVER_MAX_DOWNLOAD_BYTES ?? 1024 ** 3);

/**
 * Where one image goes inside the download folder, filed by category so a
 * project's images folder stays browsable:
 * `nature/ocean/wikimediacommons-Waves_at_dusk Waves at dusk (1920w).jpg`.
 */
export function imageFilePath(image: Pick<ImageDetails, "provider" | "nativeId" | "title" | "category">, file: ImageFile): string {
  const slug = safeFilename(`${image.provider}-${shortId(image.nativeId)} ${image.title}`.slice(0, 90)).replace(/\.[^.]*$/, "");
  const ext = file.format ? `.${file.format}` : extname(file.filename);
  const dir = image.category.split(".").slice(0, 2).join("/");
  const suffix = file.role === "thumbnail" ? " (thumbnail)" : file.format === "svg" ? "" : file.width ? ` (${file.width}w)` : "";
  return `${dir}/${slug}${suffix}${ext}`;
}

function shortId(id: string): string {
  const s = id.replace(/[^\w-]+/g, "_");
  return s.length > 24 ? s.slice(-24) : s;
}

/** Download the chosen files of one image into `destDir` (local mode only: never on the hosted server). */
export async function downloadImage(
  http: HttpClient,
  image: ImageDetails,
  files: ImageFile[],
  destDir: string,
  opts: DownloadOptions = {},
): Promise<DownloadResult> {
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_DOWNLOAD_BYTES;
  const known = totalBytes(files);
  if (known !== undefined && known > maxBytes) {
    throw new Error(`Selection is ${formatBytes(known)}, above the ${formatBytes(maxBytes)} limit.`);
  }
  const root = resolve(destDir);
  await mkdir(root, { recursive: true });
  const written: DownloadedFile[] = [];
  let bytes = 0;

  for (const file of files) {
    const rel = safeRelative(imageFilePath(image, file));
    const target = resolve(root, rel);
    if (target !== root && !target.startsWith(root + sep)) throw new Error(`Unsafe path: ${rel}`);
    if (!opts.overwrite && (await exists(target))) {
      written.push({ path: target, bytes: (await stat(target)).size, role: file.role });
      continue;
    }
    await mkdir(dirname(target), { recursive: true });
    const res = await fetchFile(http, file.url, file.headers, opts.signal);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${file.url}`);
    if (!res.body) throw new Error(`Empty response for ${file.url}`);
    let received = 0;
    const counter = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, ctrl) {
        received += chunk.byteLength;
        if (bytes + received > maxBytes) ctrl.error(new Error(`Download exceeded ${formatBytes(maxBytes)} limit`));
        else ctrl.enqueue(chunk);
      },
    });
    // Write to a temp name and rename, so an interrupted download never looks complete.
    const partial = `${target}.part`;
    try {
      await pipeline(Readable.fromWeb(res.body.pipeThrough(counter) as never), createWriteStream(partial));
      await rename(partial, target);
    } catch (e) {
      await rm(partial, { force: true });
      throw e;
    }
    bytes += received;
    written.push({ path: target, bytes: received, role: file.role });
  }
  return { directory: root, files: written, bytes, previewOnly: isPreviewOnly(files) };
}

// ---------------------------------------------------------------------------
// One zip for the browser (HTTP API)

export interface BundleEntry {
  path: string;
  url: string;
  headers?: Record<string, string>;
}

/**
 * Stream files as a single zip (no recompression: JPEG and PNG don't compress).
 * The hosted server uses it for the credits bundle only (no image entries);
 * local callers may add files,
 * plus small generated entries (ATTRIBUTION.md, credits.json). Stops with an
 * error once `maxBytes` of source data have been streamed.
 */
export function zipStream(
  http: HttpClient,
  entries: BundleEntry[],
  folder: string,
  opts: { extra?: { path: string; content: string }[]; maxBytes?: number; signal?: AbortSignal } = {},
): ReadableStream<Uint8Array> {
  const prefix = safeRelative(folder);
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_DOWNLOAD_BYTES;
  let zip: Zip | undefined;
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      zip = new Zip((err, chunk, final) => {
        if (err) return controller.error(err);
        controller.enqueue(chunk);
        if (final) controller.close();
      });
      let total = 0;
      try {
        for (const x of opts.extra ?? []) {
          const entry = new ZipPassThrough(`${prefix}/${safeRelative(x.path)}`);
          zip.add(entry);
          entry.push(new TextEncoder().encode(x.content), true);
        }
        const used = new Set<string>();
        for (const item of entries) {
          let path = safeRelative(item.path);
          for (let n = 2; used.has(path); n++) path = path.replace(/(\.[^./]*)?$/, ` (${n})$1`);
          used.add(path);
          const res = await fetchFile(http, item.url, item.headers, opts.signal);
          const entry = new ZipPassThrough(`${prefix}/${path}`);
          zip.add(entry);
          const reader = res.body!.getReader();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            total += value.byteLength;
            if (total > maxBytes) {
              await reader.cancel();
              throw new Error(`Bundle exceeded ${formatBytes(maxBytes)} limit`);
            }
            entry.push(value);
          }
          entry.push(new Uint8Array(0), true);
        }
        zip.end();
      } catch (e) {
        zip.terminate();
        controller.error(e);
      }
    },
    cancel() {
      zip?.terminate();
    },
  });
}

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

export function formatBytes(n: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i ? 1 : 0)} ${units[i]}`;
}

/** Folder name for a image bundle: `<provider>-<slug>`. */
export function imageFolderName(image: { provider: string; nativeId: string }): string {
  const slug = image.nativeId.replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "").slice(-80) || "image";
  return `${image.provider}-${slug}`;
}
