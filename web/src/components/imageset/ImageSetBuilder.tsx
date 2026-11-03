import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, CircleCheck, Code2, Copy, Download, FileJson, FileText, Loader2, TerminalSquare, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { categoryPath, STYLES } from "@/lib/vocab";
import { api, saveText, UnauthorizedError, type ImageAsset, type Provider } from "@/components/search/api";
import { Segmented } from "@/components/search/Filters";
import { ImageMedia } from "@/components/search/ResultCard";
import { VerdictBadge } from "@/components/search/VerdictBadge";

/** POST /v1/sets response (src/core/imageset.ts). */
interface Slot {
  index: number;
  description: string;
  width: number;
  image?: ImageAsset;
  file?: { url: string; filename: string; format: string; width?: number; height?: number; sizeBytes?: number };
  alt?: string;
  alternatives: ImageAsset[];
  note?: string;
}
interface Plan {
  slots: Slot[];
  commercialSafe: boolean;
}
type ExportName = "images.json" | "credits.html" | "download.sh" | "ATTRIBUTION.md" | "credits.json";
interface SetResponse {
  plan: Plan;
  exports: Record<ExportName, string>;
}

export const EXAMPLE_SLOTS = ["Hero: mountain lake at sunrise (1920px)", "3 icons: rocket, shield, chart", "Saturn rings", "Botanical illustration of a rose", "Vintage map of Paris"].join("\n");

const EXPORTS: { name: ExportName; type: string; icon: typeof FileText; hint: string }[] = [
  { name: "images.json", type: "application/json", icon: FileJson, hint: "The picks: file URL, size, alt text, licence and credit per slot" },
  { name: "credits.html", type: "text/html", icon: Code2, hint: "<figure> snippets with each image's credit in the caption" },
  { name: "download.sh", type: "text/x-shellscript", icon: TerminalSquare, hint: "curl every pick into ./images, straight from the sources" },
  { name: "ATTRIBUTION.md", type: "text/markdown", icon: FileText, hint: "Credits for every image, with licences and links" },
  { name: "credits.json", type: "application/json", icon: FileJson, hint: "The same credits, machine-readable" },
];

/** Roughly the server's parseSlotList: one slot per line (or ";"), "N icons: a, b, c" becomes N slots. */
function countSlots(text: string): number {
  let n = 0;
  for (const raw of text.split(/\r?\n|;/)) {
    const line = raw.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim();
    if (line.length < 2) continue;
    const multi = /^(\d{1,2})\s+[a-z -]+?s?\s*(?:of|:)\s*(.+)$/i.exec(line);
    n += multi && multi[2]!.includes(",") ? multi[2]!.split(/,|\band\b/).filter((x) => x.trim()).length : 1;
  }
  return n;
}

/** The image's files and credit line live on the search page (`/search?image=<id>`), opened in a new tab. */
const imageHref = (id: string) => `/search?image=${encodeURIComponent(id)}`;

function SlotPick({ image, providers }: { image: ImageAsset; providers: Provider[] }) {
  const source = providers.find((p) => p.id === image.provider)?.name ?? image.provider;
  return (
    <div className="grid gap-3 sm:grid-cols-[13rem_1fr]">
      <a
        href={imageHref(image.id)}
        target="_blank"
        rel="noopener"
        aria-label={`${image.title} on ${source}: open the files and credit line in a new tab`}
        className="group block w-full overflow-hidden rounded-lg border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <ImageMedia image={image} fixed={4 / 3} />
      </a>
      <div className="min-w-0">
        <a href={imageHref(image.id)} target="_blank" rel="noopener" className="text-sm font-medium leading-snug hover:text-primary">
          {image.title}
        </a>
        <p className="mt-1 text-xs text-muted-foreground">
          {source} · {categoryPath(image.category)}
          {image.author ? ` · ${image.author}` : ""}
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-1">
          <VerdictBadge license={image.license} />
          {image.license?.editorial && <span className="inline-flex items-center rounded-full border border-warning/40 px-2 py-0.5 text-[11px] font-medium text-warning" title="People, insignia or brands without releases: not for ads">Editorial</span>}
        </p>
        {image.attribution && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground" title={image.attribution}>{image.attribution}</p>}
      </div>
    </div>
  );
}

function CopyText({ text, label }: { text: string; label: string }) {
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

const WIDTHS = ["800", "1200", "1600", "1920", "2400", "3840"];
const KIND_OPTIONS = [{ value: "", label: "Any kind" }, ...STYLES.filter((s) => ["photo", "illustration", "painting", "vector", "icon"].includes(s.id)).map((s) => ({ value: s.id, label: s.label }))];

export default function ImageSetBuilder() {
  const [slots, setSlots] = useState(EXAMPLE_SLOTS);
  const [orientation, setOrientation] = useState<"" | "landscape" | "portrait" | "square">("");
  const [width, setWidth] = useState("1600");
  const [kind, setKind] = useState("");
  const [commercial, setCommercial] = useState(true);
  const [name, setName] = useState("landing-page");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<SetResponse | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const resultsRef = useRef<HTMLDivElement>(null);
  const count = useMemo(() => countSlots(slots), [slots]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const preset = p.get("slots");
    if (preset) setSlots(preset.slice(0, 6000));
    const o = p.get("orientation");
    if (o === "portrait" || o === "square" || o === "landscape") setOrientation(o);
    if (WIDTHS.includes(p.get("width") ?? "")) setWidth(p.get("width")!);
    api<{ providers: Provider[] }>("/v1/providers")
      .then((r) => setProviders(r.providers))
      .catch(() => undefined);
  }, []);

  const build = async () => {
    if (!count) return;
    setBusy(true);
    setError(undefined);
    setResult(null);
    try {
      const body = {
        slots,
        width: Number(width),
        commercialOnly: commercial,
        name: name.trim() || "image-set",
        ...(orientation ? { orientation } : {}),
        ...(kind ? { styles: [kind] } : {}),
      };
      const res = await api<SetResponse>("/v1/sets", { method: "POST", body });
      setResult(res);
      requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (e) {
      setError(e instanceof UnauthorizedError ? "This server needs an API key: set it on the search page first." : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const plan = result?.plan;
  const picked = plan?.slots.filter((s) => s.image).length ?? 0;

  return (
    <TooltipProvider>
      <form
        className="rounded-2xl border bg-card/50 p-4 shadow-xl shadow-primary/5 sm:p-6"
        onSubmit={(e) => {
          e.preventDefault();
          void build();
        }}
      >
        <label htmlFor="slots" className="text-sm font-medium">Images you need</label>
        <p id="slots-hint" className="mt-1 text-xs text-muted-foreground">
          One image per line, described like a search (“vertical”, “png”, “icon”, “4k” work too). End a line with “(1200px)” to set its width; “3 icons: rocket, shield, chart” makes one slot per item. Up to 24.
        </p>
        <textarea
          id="slots"
          value={slots}
          onChange={(e) => setSlots(e.target.value)}
          rows={7}
          maxLength={6000}
          aria-describedby="slots-hint"
          spellCheck={false}
          className="mt-3 w-full resize-y rounded-xl border bg-background/60 p-3 font-mono text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div className="mt-4 flex flex-wrap items-end gap-x-5 gap-y-4">
          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-muted-foreground">Orientation</span>
            <Segmented
              label="Orientation"
              value={orientation}
              onChange={setOrientation}
              options={[
                { value: "", label: "Any", title: "Each slot says, or any shape" },
                { value: "landscape", label: "Landscape", title: "Hero images, banners, slides" },
                { value: "portrait", label: "Vertical", title: "Posters, phone screens, stories" },
                { value: "square", label: "Square", title: "Avatars, social posts" },
              ]}
            />
          </div>
          <label className="space-y-1.5">
            <span className="block text-xs font-medium text-muted-foreground">Width</span>
            <select value={width} onChange={(e) => setWidth(e.target.value)} className="h-7 rounded-full border bg-background px-2.5 text-xs">
              {WIDTHS.map((w) => <option key={w} value={w}>{w} px</option>)}
            </select>
          </label>
          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-muted-foreground">Kind</span>
            <Segmented label="Kind" value={kind} onChange={setKind} options={KIND_OPTIONS} />
          </div>
          <label className="space-y-1.5">
            <span className="block text-xs font-medium text-muted-foreground">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="h-7 w-36 rounded-full border bg-background px-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </label>
          <Switch label="Commercial-safe only" labelClassName="text-xs font-medium text-muted-foreground" checked={commercial} onCheckedChange={setCommercial} title="Only images whose licence allows commercial use" />
          <Button type="submit" className="ml-auto" disabled={busy || !count}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
            {busy ? "Finding images…" : `Pick ${count || ""} ${count === 1 ? "image" : "images"}`}
          </Button>
        </div>
        {error && <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      </form>

      <div ref={resultsRef} className="scroll-mt-20">
        {busy && (
          <ol className="mt-8 space-y-3" aria-busy="true" aria-label="Finding an image for each slot">
            {Array.from({ length: Math.min(count, 24) }).map((_, i) => (
              <li key={i} className="grid gap-3 rounded-xl border bg-card/30 p-3 sm:grid-cols-[2rem_13rem_1fr]">
                <Skeleton className="hidden h-6 w-6 rounded-full sm:block" />
                <Skeleton className="aspect-[4/3] w-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </li>
            ))}
          </ol>
        )}

        {plan && result && (
          <section className="mt-10" aria-labelledby="plan-h">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 id="plan-h" className="text-2xl font-semibold tracking-tight">Your image set</h2>
              <p className="text-sm text-muted-foreground">{picked} of {plan.slots.length} slots filled</p>
            </div>
            <p className={cn("mt-3 flex items-start gap-2 rounded-lg border p-3 text-sm", plan.commercialSafe ? "border-success/40 bg-success/10" : "border-warning/40 bg-warning/10")}>
              {plan.commercialSafe ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />}
              <span>
                {plan.commercialSafe
                  ? "Every pick's licence allows commercial use. Credit the ones that ask for it (credits.html and ATTRIBUTION.md list them), and check editorial-flagged images before using them in an ad."
                  : "Not every pick is cleared for commercial use: check the verdicts below before you publish."}
              </span>
            </p>

            <div className="mt-6 rounded-xl border bg-card/40 p-4">
              <h3 className="text-sm font-medium">Exports</h3>
              <p className="mt-1 text-xs text-muted-foreground">File URLs point at the sources: nothing is re-hosted, and the files are generated in your browser from the plan.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {EXPORTS.map((x) => (
                  <Button key={x.name} variant="outline" size="sm" title={x.hint} onClick={() => saveText(x.name, result.exports[x.name], x.type)}>
                    <Download className="size-3.5" /> {x.name}
                  </Button>
                ))}
                <CopyText text={result.exports["credits.html"]} label="Copy HTML" />
              </div>
              <pre className="mt-3 overflow-x-auto rounded-lg bg-[#0d0d12] p-3 font-mono text-xs text-zinc-200">
                <code>{"sh download.sh   # saves every pick into ./images with curl, straight from the sources"}</code>
              </pre>
            </div>

            <ol className="mt-6 space-y-3">
              {plan.slots.map((s) => (
                <li key={s.index} className="rounded-xl border bg-card/40 p-3 sm:p-4">
                  <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">{s.index}</span>
                    <span className="font-medium">{s.description}</span>
                    <span className="text-xs text-muted-foreground">
                      {s.width} px slot
                      {s.file?.width ? ` · file ${s.file.width}×${s.file.height} ${s.file.format.toUpperCase()}` : s.file ? ` · ${s.file.format.toUpperCase()}` : ""}
                    </span>
                  </div>
                  {s.image ? <SlotPick image={s.image} providers={providers} /> : <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No image for this slot.</p>}
                  {s.note && (
                    <p className="mt-3 flex gap-2 text-xs text-warning">
                      <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                      {s.note}
                    </p>
                  )}
                  {s.alternatives.length > 0 && (
                    <div className="mt-3 text-xs">
                      <span className="text-muted-foreground">Alternatives: </span>
                      <ul className="mt-1 flex flex-wrap gap-1.5">
                        {s.alternatives.map((a) => (
                          <li key={a.id}>
                            <a href={imageHref(a.id)} target="_blank" rel="noopener" className="inline-flex max-w-[16rem] items-center gap-1 rounded-full border px-2.5 py-0.5 hover:border-primary/40" title={`${a.title}: ${a.license?.name ?? "no licence stated"}`}>
                              <span className="truncate">{a.title}</span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </TooltipProvider>
  );
}
