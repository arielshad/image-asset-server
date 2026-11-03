import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowUpRight, Bot, Check, Code2, Copy, Download, FileImage, FileText, Info, Loader2, Lock, Share2, Terminal, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CopyButton } from "@/components/home/AgentSetup";
import { MCP_NAME } from "@/lib/site";
import { cn } from "@/lib/utils";
import {
  EDITORIAL_MEANING,
  VERDICT_MEANING,
  categoryPath,
  megapixelText,
  orientationLabel,
  resolutionLabel,
  styleLabel,
  verdictTone,
  type Verdict,
} from "@/lib/vocab";
import { api, imageBase, formatBytes, getKey, safeUrl, slugName, type ImageAsset, type ImageDetails, type ImageFile } from "./api";
import { CHECKER } from "./ResultCard";
import { TONE_CLASS, VerdictBadge } from "./VerdictBadge";

const ROLE_LABEL: Record<ImageFile["role"], string> = { original: "Original", rendition: "Resized", thumbnail: "Thumbnail" };
const ROLE_ORDER: Record<string, number> = { original: 0, rendition: 1, thumbnail: 2 };

/**
 * The image itself, at display size (`display` from /v1/images/{id}, else
 * the search preview or thumbnail), loaded straight from the source: never
 * through this server. Transparent images and SVGs sit on a checkerboard.
 * When the source refuses it, a message links to the source page instead.
 */
function Viewer({ image, details, providerName }: { image: ImageAsset; details: ImageDetails | null; providerName: string }) {
  const thumb = safeUrl(image.thumbnailUrl);
  const src = safeUrl(details?.display?.url ?? image.previewUrl ?? image.thumbnailUrl);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [src]);
  const clear = image.transparent || image.vector;
  const icon = image.styles?.includes("icon");
  const source = safeUrl(image.url);
  return (
    <figure className={cn("overflow-hidden rounded-xl border", clear ? CHECKER : "bg-zinc-950")}>
      <div className="relative flex min-h-48 w-full items-center justify-center">
        {src && !failed ? (
          <>
            {!loaded && thumb && thumb !== src && <img src={thumb} alt="" aria-hidden="true" referrerPolicy="no-referrer" className="absolute inset-0 size-full object-contain opacity-60 blur-sm" />}
            <img
              key={src}
              src={src}
              alt={image.title}
              referrerPolicy="no-referrer"
              onLoad={() => setLoaded(true)}
              onError={() => (thumb && src !== thumb ? undefined : setFailed(true))}
              className={cn("relative max-h-[65vh] w-auto max-w-full object-contain transition-opacity", icon && "size-48 p-6 dark:invert", loaded ? "opacity-100" : "opacity-0")}
            />
            {!loaded && <Loader2 className="absolute size-6 animate-spin text-zinc-300" aria-label="Loading the image" />}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 p-6 text-center text-sm text-zinc-300">
            {!details && !src ? (
              <Loader2 className="size-6 animate-spin" aria-label="Loading the image" />
            ) : (
              <span className="max-w-sm">
                {failed ? "This image can't be shown here: the source refused it." : "This source has no image the browser can show."}{" "}
                {source && (
                  <a href={source} target="_blank" rel="noopener noreferrer" className="font-medium text-white underline underline-offset-2">
                    See it on {providerName} ↗
                  </a>
                )}
              </span>
            )}
          </div>
        )}
      </div>
      {src && !failed && (
        <figcaption className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-zinc-950 px-3 py-1.5 text-[11px] text-zinc-400">
          <span>
            Loaded from {new URL(src).hostname}
            {details?.display?.width ? ` · ${details.display.width}×${details.display.height}` : ""}
          </span>
          <span>Nothing passes through this server</span>
        </figcaption>
      )}
    </figure>
  );
}

function LightCopy({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() =>
        void navigator.clipboard.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        })
      }
    >
      {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {done ? "Copied" : label}
    </Button>
  );
}

/**
 * Where a file's Download button points: the server's download endpoint (a
 * 302 to the same file on the source, so it is counted and gets licence
 * headers), or the file itself when a role/format/width can't single it out
 * or the server needs an API key (a redirect can't carry the key header).
 */
function downloadHref(image: ImageAsset, f: ImageFile, files: ImageFile[]): string | undefined {
  const direct = safeUrl(f.url);
  if (getKey() || f.requiresAuth) return direct;
  const w = f.width;
  const same = files.filter((x) => x.role === f.role && x.format === f.format);
  // The server picks the smallest file of this role and format at least `width` wide: make sure that is this one.
  const unique = w === undefined ? same.length === 1 : same.filter((x) => (x.width ?? 0) >= w * 0.97 && (x.width ?? Infinity) <= w).length === 1;
  if (!unique) return direct;
  const p = new URLSearchParams({ role: f.role, format: f.format });
  if (w && f.format !== "svg") p.set("width", String(w));
  return `${imageBase(image.id)}/download?${p}`;
}

export function ImageDetail({ image, providerName }: { image: ImageAsset; providerName: string }) {
  const [full, setFull] = useState<ImageDetails | null>(null);
  const [failed, setFailed] = useState<string>();

  useEffect(() => {
    setFull(null);
    setFailed(undefined);
    const ctrl = new AbortController();
    api<ImageDetails>(imageBase(image.id), { signal: ctrl.signal })
      .then(setFull)
      .catch((e: Error) => !ctrl.signal.aborted && setFailed(e.message));
    return () => ctrl.abort();
  }, [image.id]);

  const c: ImageAsset = full ?? image;
  const files = full?.files ?? [];
  const list = useMemo(
    () =>
      files
        .filter((f) => f.role !== "thumbnail")
        .sort((a, b) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9) || (b.width ?? 0) - (a.width ?? 0)),
    [files],
  );
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const base = imageBase(image.id);
  const shareUrl = full?.shareUrl ?? `${origin}/search?image=${encodeURIComponent(image.id)}`;
  const source = safeUrl(c.url);
  const verdict = (c.license?.verdict ?? "check-terms") as Verdict;
  const tone = verdictTone(verdict);
  const name = slugName(c.title);
  const best = list.find((f) => !f.requiresAuth);
  const ext = best?.format ?? "jpg";
  const want = c.vector ? undefined : Math.min(1920, c.width ?? 1920);
  const curl = `curl -L -o "${name}.${ext}" "${origin}${base}/download${want ? `?width=${want}` : ""}"`;
  const displayUrl = full?.display?.url ?? c.previewUrl ?? c.thumbnailUrl;
  const html = `<figure>\n  <img src="${displayUrl ?? `${origin}${base}/download`}" alt="${c.title.replace(/"/g, "&quot;")}" loading="lazy">\n  <figcaption>${c.attribution ? c.attribution.replace(/</g, "&lt;") : `${c.title} (${providerName})`}</figcaption>\n</figure>`;
  const prompt = `Use the ${MCP_NAME} MCP server: get_image("${image.id}"), check its licence verdict${c.license?.editorial ? " and the editorial flag" : ""}, download ${c.vector ? "the SVG" : `a ${want}px-wide copy`} into ./images (download_image locally, or curl its selection.downloadUrl) and add the credit line to CREDITS.md if one is needed.`;
  const credit = c.attribution;

  const facts: [string, React.ReactNode][] = [
    ["Size", c.vector ? "Vector (SVG): any size" : c.width && c.height ? `${c.width}×${c.height}${megapixelText(c.width, c.height) ? ` · ${megapixelText(c.width, c.height)}` : ""}${resolutionLabel(c.width, c.height) ? ` (${resolutionLabel(c.width, c.height)})` : ""}` : undefined],
    ["Orientation", orientationLabel(c.orientation) || undefined],
    ["Background", c.transparent ? "Transparent" : undefined],
    ["Year", c.year ? String(c.year) : undefined],
    ["Category", categoryPath(c.category)],
    ["Kind", c.styles?.length ? c.styles.map(styleLabel).join(", ") : undefined],
    ["Formats", c.formats?.length ? c.formats.join(", ").toUpperCase() : undefined],
    ["Source", source ? <a className="text-primary hover:underline" href={source} target="_blank" rel="noopener noreferrer">{providerName}</a> : providerName],
    [
      "Author",
      c.author ? (
        safeUrl(c.authorUrl) ? (
          <a className="text-primary hover:underline" href={safeUrl(c.authorUrl)} target="_blank" rel="noopener noreferrer">{c.author}</a>
        ) : (
          c.author
        )
      ) : undefined,
    ],
    ["Image id", <code className="break-all font-mono text-xs">{c.id}</code>],
  ];

  return (
    <div className="space-y-6 px-4 pb-10 sm:px-6">
      <Viewer image={c} details={full} providerName={providerName} />

      <dl className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-1.5 text-sm">
        {facts
          .filter(([, v]) => v !== undefined && v !== "")
          .map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="min-w-0">{v}</dd>
            </div>
          ))}
      </dl>

      {/* Licence */}
      <section aria-labelledby="licence-h" className={cn("rounded-xl border p-4", TONE_CLASS[tone].replace(/text-\S+/, ""))}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="licence-h" className="font-medium">Can I use it commercially?</h3>
          <VerdictBadge license={c.license} size="lg" />
        </div>
        <p className="mt-2 text-sm leading-relaxed">{VERDICT_MEANING[verdict] ?? ""}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Licence:{" "}
          {c.license ? (
            safeUrl(c.license.url) ? (
              <a className="text-primary hover:underline" href={safeUrl(c.license.url)} target="_blank" rel="noopener noreferrer">{c.license.name}</a>
            ) : (
              c.license.name
            )
          ) : (
            "not stated by the source"
          )}
          {c.license?.redistribution === false && " · don't re-upload or sell the image itself"}
        </p>
        {c.license?.note && <p className="mt-1 text-sm text-muted-foreground">{c.license.note}</p>}
        {c.license?.editorial && (
          <p className="mt-3 flex gap-2 rounded-lg border border-warning/40 bg-warning/10 p-2.5 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            <span>
              <strong className="font-medium">Editorial use.</strong> {EDITORIAL_MEANING}
            </span>
          </p>
        )}
        {c.license?.assertedBy === "uploader" && (
          <p className="mt-3 flex gap-2 rounded-lg border border-warning/40 bg-warning/10 p-2.5 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            <span>The licence was stated by whoever uploaded it, and {providerName} does not check it. Uploads sometimes carry a licence the uploader had no right to give: treat it as unverified.</span>
          </p>
        )}
        {c.license?.assertedBy === "site" && <p className="mt-2 text-xs text-muted-foreground">{providerName} applies one licence to all its images.</p>}
        <p className="mt-3 text-xs">
          <a href="/docs/licences" className="text-primary hover:underline">How licence verdicts work</a>
        </p>
      </section>

      {/* Credit line */}
      <section aria-labelledby="credit-h" className="space-y-2">
        <h3 id="credit-h" className="flex items-center gap-2 font-medium"><UserRound className="size-4 text-primary" /> Credit line</h3>
        {credit ? (
          <>
            <p className="rounded-lg border bg-muted/40 p-3 text-sm leading-relaxed">{credit}</p>
            <div className="flex flex-wrap items-center gap-2">
              <LightCopy text={credit} label="Copy credit" />
              <span className="text-xs text-muted-foreground">Put it in a caption, next to the image, or on a credits page.</span>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {c.license?.attributionRequired === false ? "No credit is required. Crediting the source is still a nice thing to do." : "The source gives no credit line. If you use it, credit the author and link the source page."}
          </p>
        )}
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <a href={`${base}/credits`} className="inline-flex items-center gap-1 text-primary hover:underline" target="_blank" rel="noopener"><FileText className="size-3.5" /> ATTRIBUTION.md</a>
          <a href={`${base}/credits?format=json`} className="text-primary hover:underline" target="_blank" rel="noopener">credits.json</a>
          <a href={`${base}/credits?format=zip`} className="text-primary hover:underline">Both as a zip</a>
        </p>
      </section>

      {c.requiresAccount && (
        <p className="flex gap-2 rounded-lg border p-3 text-sm">
          <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>
            The full-quality file needs an account on {providerName}.{" "}
            {source ? <a className="text-primary hover:underline" href={source} target="_blank" rel="noopener noreferrer">Open its page</a> : null}
          </span>
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {source && (
          <Button variant="outline" asChild>
            <a href={source} target="_blank" rel="noopener noreferrer">Open on {providerName} <ArrowUpRight className="size-4" /></a>
          </Button>
        )}
        <ShareButton title={c.title} url={shareUrl} />
      </div>

      <Separator />

      {/* Renditions */}
      <section aria-labelledby="files-h" className="space-y-3">
        <h3 id="files-h" className="flex items-center gap-2 font-medium"><FileImage className="size-4 text-primary" /> Download a size</h3>
        {!full && !failed && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading files…</p>}
        {failed && <p className="text-sm text-destructive">Could not load the details: {failed}</p>}
        {full && !list.length && (
          <p className="text-sm text-muted-foreground">
            No direct files from this source. {source ? <a href={source} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Get it on {providerName}</a> : null}
          </p>
        )}
        {list.length > 0 && (
          <>
            <ul className="divide-y overflow-hidden rounded-lg border">
              {list.slice(0, 30).map((f) => {
                const href = downloadHref(c, f, list);
                const size = f.width && f.height ? `${f.width}×${f.height}` : "";
                return (
                  <li key={f.url + f.filename} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs">
                    <span className="w-[4.5rem] shrink-0 font-medium">{ROLE_LABEL[f.role] ?? f.role}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        {size && <span className="tabular-nums">{size}</span>}
                        {resolutionLabel(f.width, f.height) && <span className="text-muted-foreground">{resolutionLabel(f.width, f.height)}</span>}
                        <span className="rounded bg-muted px-1 py-px text-[10px] font-semibold uppercase">{f.format}</span>
                        {f.sizeBytes != null && <span className="tabular-nums text-muted-foreground">{formatBytes(f.sizeBytes)}</span>}
                      </span>
                      <span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground" title={f.filename}>{f.filename}</span>
                    </span>
                    {f.requiresAuth ? (
                      <span className="inline-flex items-center gap-1 text-muted-foreground"><Lock className="size-3" /> account</span>
                    ) : href ? (
                      <Button variant="outline" size="sm" className="h-7 px-2 text-xs" asChild>
                        <a href={href} target="_blank" rel="noopener" aria-label={`Download ${ROLE_LABEL[f.role] ?? f.role} ${size} ${f.format}`}>
                          <Download className="size-3.5" /> Download
                        </a>
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-muted-foreground">
              Every download comes straight from {providerName}'s servers. For the web, a 1600–1920 px copy is plenty; originals (especially TIFF) can be tens of megabytes.
            </p>
          </>
        )}
      </section>

      <section aria-labelledby="code-h" className="space-y-3">
        <h3 id="code-h" className="flex items-center gap-2 font-medium"><Terminal className="size-4 text-primary" /> From a terminal or an agent</h3>
        <Snippet icon={<Terminal className="size-3.5" />} label="curl (follows the redirect to the source)" text={curl} />
        <Snippet icon={<Code2 className="size-3.5" />} label="HTML with the credit in the caption" text={html} />
        <Snippet icon={<Bot className="size-3.5" />} label="Ask your agent" text={prompt} />
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" /> Agents connect with <code className="font-mono">claude mcp add --transport http {MCP_NAME} {origin}/mcp</code>. <a href="/docs/mcp" className="text-primary hover:underline">Setup</a>
        </p>
      </section>

      {c.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {c.tags.slice(0, 16).map((t) => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
        </div>
      )}
      {c.description && <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{c.description.slice(0, 900)}</p>}
    </div>
  );
}

function Snippet({ icon, label, text }: { icon: React.ReactNode; label: string; text: string }) {
  return (
    <div className="rounded-lg bg-[#0d0d12] p-3 text-zinc-100">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] text-zinc-400">{icon}{label}</span>
        <CopyButton text={text} />
      </div>
      <pre className="whitespace-pre-wrap break-all font-mono text-[12px] leading-relaxed">{text}</pre>
    </div>
  );
}

/** Share link to this image (`/search?image=<id>`, which unfurls with its own preview card). */
function ShareButton({ title, url }: { title: string; url: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    if (typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
      await navigator.share({ title, url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <Button variant="outline" onClick={() => void share()}>
      {copied ? <Check className="size-4" /> : <Share2 className="size-4" />}
      {copied ? "Link copied" : "Share"}
    </Button>
  );
}
