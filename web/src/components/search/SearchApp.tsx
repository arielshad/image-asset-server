import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { setNonce } from "get-nonce";
import { ArrowUpRight, Filter, Loader2, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EXAMPLE_QUERIES } from "@/lib/site";
import { cn } from "@/lib/utils";
import { FORMATS, MIN_RESOLUTIONS, categoryPath, orientationLabel, styleLabel } from "@/lib/vocab";
import { api, getKey, safeUrl, setKey, UnauthorizedError, type ImageAsset, type ParsedFilters, type Provider, type ProviderReport, type SearchResponse } from "./api";
import { ImageDetail } from "./ImageDetail";
import { CategoryChips, Segmented, SourcePicker, StylePicker } from "./Filters";
import { ResultCard } from "./ResultCard";

const PAGE = 24;
const EXAMPLES = EXAMPLE_QUERIES;

// The server sends a per-request CSP nonce; the detail sheet's scroll lock
// injects a <style> tag and must carry it.
if (typeof document !== "undefined") {
  const nonce = document.querySelector<HTMLMetaElement>('meta[property="csp-nonce"]')?.content;
  if (nonce) setNonce(nonce);
}

interface Filters {
  q: string;
  categories: string[];
  styles: string[];
  orientation: string;
  minResolution: string;
  format: string;
  transparent: boolean;
  commercial: boolean;
  free: boolean;
  downloadable: boolean;
  sources: string[] | null;
}
const EMPTY: Filters = { q: "", categories: [], styles: [], orientation: "", minResolution: "", format: "", transparent: false, commercial: false, free: false, downloadable: false, sources: null };

const RES_OPTIONS = [{ value: "", label: "Any size" }, ...MIN_RESOLUTIONS.map((r) => ({ value: String(r.value), label: r.short, title: `At least ${r.label}` }))];
const ORIENTATION_OPTIONS = [
  { value: "", label: "Any shape" },
  { value: "landscape", label: "Landscape", title: "Wider than tall: banners, hero images, slides" },
  { value: "portrait", label: "Vertical", title: "Taller than wide: phone wallpapers, posters, stories" },
  { value: "square", label: "Square", title: "1:1: avatars, social posts" },
];
const FORMAT_OPTIONS = [{ value: "", label: "Any format" }, ...FORMATS.map((f) => ({ value: f.value, label: f.label, title: `Only ${f.label} files` }))];

function readUrl(): Filters {
  const p = new URLSearchParams(window.location.search);
  const list = (k: string) => (p.get(k) ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const res = (p.get("min_resolution") ?? "").toLowerCase();
  return {
    q: p.get("q") ?? "",
    categories: list("category"),
    styles: list("style"),
    orientation: ["landscape", "portrait", "square"].includes(p.get("orientation") ?? "") ? p.get("orientation")! : "",
    minResolution: res === "4k" ? "2160" : res === "hd" ? "720" : res === "large" ? "1440" : /^\d{3,4}$/.test(res) ? res : "",
    format: FORMATS.some((x) => x.value === p.get("format")) ? p.get("format")! : "",
    transparent: p.get("transparent") === "true",
    commercial: p.get("commercial") === "true",
    free: p.get("free") === "true",
    downloadable: p.get("downloadable") === "true",
    sources: p.get("providers") ? list("providers") : null,
  };
}

function toParams(f: Filters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.categories.length) p.set("category", f.categories.join(","));
  if (f.styles.length) p.set("style", f.styles.join(","));
  if (f.orientation) p.set("orientation", f.orientation);
  if (f.minResolution) p.set("min_resolution", f.minResolution);
  if (f.format) p.set("format", f.format);
  if (f.transparent) p.set("transparent", "true");
  if (f.commercial) p.set("commercial", "true");
  if (f.free) p.set("free", "true");
  if (f.downloadable) p.set("downloadable", "true");
  if (f.sources) p.set("providers", f.sources.join(","));
  return p;
}

const searchable = (f: Filters) => Boolean(f.q || f.categories.length || f.styles.length);

function describe(f: Filters): string {
  const bits = [f.q && `“${f.q}”`, ...f.categories.map(categoryPath), ...f.styles.map(styleLabel), f.orientation && orientationLabel(f.orientation), f.minResolution && `${f.minResolution === "2160" ? "4K" : `${f.minResolution} px`}+`, f.format.toUpperCase(), f.transparent && "transparent"].filter(Boolean);
  return bits.join(" · ");
}

/** Chips for what the server understood ("4K+", "Vertical", "PNG", "Transparent"), including words it parsed out of the query. */
function parsedChips(p: ParsedFilters | undefined): string[] {
  if (!p) return [];
  const out: string[] = [];
  for (const c of p.categories ?? []) out.push(categoryPath(c));
  for (const s of p.styles ?? []) out.push(styleLabel(s));
  for (const o of p.orientations ?? []) out.push(orientationLabel(o));
  if (p.minResolution) out.push(p.minResolution >= 2160 ? "4K+" : `${p.minResolution} px+`);
  for (const f of p.formats ?? []) out.push(f.toUpperCase());
  if (p.transparent) out.push("Transparent");
  return out;
}

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

export default function SearchApp() {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [draft, setDraft] = useState("");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [results, setResults] = useState<ImageAsset[]>([]);
  const [reports, setReports] = useState<ProviderReport[]>([]);
  const [parsed, setParsed] = useState<ParsedFilters>();
  /** The free text left after the server parsed out size, orientation, format and transparency words. */
  const [understood, setUnderstood] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [needKey, setNeedKey] = useState(false);
  const [canMore, setCanMore] = useState(false);
  const [searched, setSearched] = useState(false);
  const [open, setOpen] = useState<ImageAsset | null>(null);
  const offset = useRef(0);
  const seen = useRef(new Set<string>());
  const inputRef = useRef<HTMLInputElement>(null);
  const request = useRef(0);
  // The server already sends a unique <title> for the URL the page loaded with;
  // only searches the user runs afterwards update it.
  const firstRun = useRef(true);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const providerName = useCallback((id: string) => providers.find((p) => p.id === id)?.name ?? id, [providers]);

  const writeUrl = useCallback((f: Filters, image?: string | null) => {
    const qs = toParams(f);
    const s = image === undefined ? new URLSearchParams(window.location.search).get("image") : image;
    if (s) qs.set("image", s);
    const str = qs.toString();
    window.history.replaceState(null, "", `/search${str ? `?${str}` : ""}`);
  }, []);

  const run = useCallback(
    async (f: Filters, append: boolean) => {
      const mine = ++request.current;
      if (!append) {
        offset.current = 0;
        seen.current = new Set();
        setResults([]);
        setReports([]);
        setParsed(undefined);
      }
      writeUrl(f);
      if (!searchable(f)) {
        setSearched(false);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(undefined);
      setSearched(true);
      if (!firstRun.current) document.title = `${describe(f) || "Search"}: free images · Image Asset Server`;
      firstRun.current = false;
      try {
        const params = toParams(f);
        params.set("limit", String(PAGE));
        if (offset.current) params.set("offset", String(offset.current));
        const res = await api<SearchResponse>(`/v1/search?${params.toString()}`);
        if (mine !== request.current) return;
        const fresh = res.results.filter((a) => !seen.current.has(a.id) && seen.current.add(a.id));
        setResults((prev) => (append ? [...prev, ...fresh] : fresh));
        setReports(res.providers);
        if (!append) {
          setParsed(res.filters);
          setUnderstood(res.query);
        }
        setCanMore(fresh.length > 0 && res.providers.some((r) => r.status === "ok" && r.count > 0 && (r.total === undefined || r.total > offset.current + r.count)));
        offset.current += PAGE;
      } catch (e) {
        if (mine !== request.current) return;
        if (e instanceof UnauthorizedError) setNeedKey(true);
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (mine === request.current) setLoading(false);
      }
    },
    [writeUrl],
  );

  /** Open (or close) the detail sheet and keep `?image=` in the URL, so the address bar is a share link. */
  const openImage = useCallback(
    (c: ImageAsset | null) => {
      setOpen(c);
      writeUrl(filtersRef.current, c ? c.id : null);
    },
    [writeUrl],
  );

  useEffect(() => {
    const f = readUrl();
    setFilters(f);
    setDraft(f.q);
    const shared = new URLSearchParams(window.location.search).get("image");
    api<{ providers: Provider[] }>("/v1/providers")
      .then((r) => setProviders(r.providers))
      .catch((e) => e instanceof UnauthorizedError && setNeedKey(true));
    if (searchable(f)) void run(f, false);
    else if (!shared) inputRef.current?.focus();
    if (shared) {
      api<ImageAsset>(`/v1/images/${encodeURIComponent(shared)}`)
        .then((c) => openImage(c))
        .catch(() => undefined);
    }
  }, [run, openImage]);

  const update = (patch: Partial<Filters>, rerun = true) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    if (rerun) void run(next, false);
  };

  // "/" focuses the search box.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (open || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/" && !isTyping(e.target)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const okReports = useMemo(() => reports.filter((r) => r.status !== "skipped"), [reports]);
  const linkReports = okReports.filter((r) => r.status === "link");
  const searchedReports = okReports.filter((r) => r.status !== "link");
  const chips = parsedChips(parsed);

  return (
    <TooltipProvider>
      <div className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <div className="z-30 -mx-4 border-b border-border/60 bg-background/85 px-4 pb-3 pt-4 backdrop-blur-xl sm:-mx-6 sm:px-6 md:sticky md:top-14">
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              update({ q: draft.trim() });
            }}
            className="flex items-center gap-2"
          >
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={inputRef}
                type="search"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="mountain lake at sunrise, van gogh sunflowers, rocket icon…"
                aria-label="Search free images"
                className="h-11 rounded-xl pl-10 text-base"
              />
            </div>
            <Button type="submit" size="lg" className="h-11 rounded-xl px-5" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  <span className="sr-only">Searching…</span>
                </>
              ) : (
                "Search"
              )}
            </Button>
          </form>

          <div className="mt-3">
            <CategoryChips value={filters.categories} onChange={(categories) => update({ categories })} />
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
            <StylePicker value={filters.styles} onChange={(styles) => update({ styles })} />
            <Segmented label="Orientation" options={ORIENTATION_OPTIONS} value={filters.orientation} onChange={(orientation) => update({ orientation })} />
            <Segmented label="Minimum resolution" options={RES_OPTIONS} value={filters.minResolution} onChange={(minResolution) => update({ minResolution })} />
            <Segmented label="Format" options={FORMAT_OPTIONS} value={filters.format} onChange={(format) => update({ format })} />
            <Switch label="Transparent" labelClassName="text-xs font-medium text-muted-foreground" checked={filters.transparent} onCheckedChange={(v) => update({ transparent: v })} title="Only icons, SVGs and PNG cut-outs with a transparent background" />
            <Switch label="Commercial-safe" labelClassName="text-xs font-medium text-muted-foreground" checked={filters.commercial} onCheckedChange={(v) => update({ commercial: v })} title="Only images whose licence allows commercial use (green verdicts)" />
            <Switch label="Free only" labelClassName="text-xs font-medium text-muted-foreground" checked={filters.free} onCheckedChange={(v) => update({ free: v })} />
            <Switch label="Direct download" labelClassName="text-xs font-medium text-muted-foreground" checked={filters.downloadable} onCheckedChange={(v) => update({ downloadable: v })} />
            <span className="sm:ml-auto">
              <SourcePicker providers={providers} value={filters.sources} onApply={(sources) => update({ sources })} />
            </span>
          </div>

          {needKey && (
            <form
              className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 p-2 text-sm"
              onSubmit={(e) => {
                e.preventDefault();
                const v = new FormData(e.currentTarget).get("key");
                setKey(String(v ?? ""));
                setNeedKey(false);
                void run(filters, false);
              }}
            >
              <span>This server needs an API key.</span>
              <Input name="key" type="password" defaultValue={getKey()} className="h-8 w-56" placeholder="API key" aria-label="API key" />
              <Button size="sm" type="submit">Save</Button>
            </form>
          )}
        </div>

        {chips.length > 0 && (
          <p className="mt-4 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground" aria-label="Filters in force">
            <span>Searching for</span>
            {understood && <b className="font-medium text-foreground">“{understood}”</b>}
            {understood && <span>with</span>}
            {chips.map((c) => (
              <span key={c} className="inline-flex items-center rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 font-medium text-primary">{c}</span>
            ))}
          </p>
        )}

        {searchedReports.length > 0 && (
          <div className="-mx-4 mt-3 flex items-center gap-1.5 overflow-x-auto px-4 pb-1 text-xs [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0" aria-label="Sources searched">
            {searchedReports.map((r) => {
              const failed = r.status === "error" || r.status === "timeout";
              const url = safeUrl(r.searchUrl);
              const cls = cn("inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5", failed ? "border-destructive/30 text-destructive" : "text-muted-foreground");
              const body = (
                <>
                  {r.name}
                  {failed ? ` ${r.status === "timeout" ? "timed out" : "unavailable"}` : <b className="font-semibold text-foreground">{r.count}{r.total !== undefined && r.total > r.count ? <span className="font-normal text-muted-foreground">/{r.total.toLocaleString("en")}</span> : null}</b>}
                </>
              );
              const title = r.error ?? `${r.count} results in ${r.tookMs} ms${r.filteredLocally?.length ? ` (filtered here: ${r.filteredLocally.join(", ")})` : ""}${url ? `. Open this search on ${r.name}` : ""}`;
              return url ? (
                <a key={r.provider} href={url} target="_blank" rel="noopener noreferrer" className={cn(cls, "hover:border-primary/40")} title={title}>{body}</a>
              ) : (
                <span key={r.provider} className={cls} title={title}>{body}</span>
              );
            })}
          </div>
        )}
        {linkReports.length > 0 && (
          <p className="-mx-4 mt-2 flex items-center gap-1.5 overflow-x-auto px-4 pb-1 text-xs text-muted-foreground [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            <span className="shrink-0">Also search on:</span>
            {linkReports.map((r) => {
              const url = safeUrl(r.searchUrl);
              return url ? (
                <a key={r.provider} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded-md border border-primary/30 px-2 py-0.5 text-primary hover:bg-primary/10">
                  {r.name} <ArrowUpRight className="size-3" />
                </a>
              ) : null;
            })}
          </p>
        )}

        {error && <p className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</p>}

        {(results.length > 0 || loading) && (
          <ul aria-label="Results" aria-busy={loading} className="mt-5 columns-1 gap-4 min-[480px]:columns-2 lg:columns-3 xl:columns-4">
            {results.map((c, i) => (
              <ResultCard key={c.id} image={c} providerName={providerName(c.provider)} onOpen={openImage} eager={i < 6} />
            ))}
            {loading &&
              Array.from({ length: results.length ? 4 : 8 }).map((_, i) => (
                <li key={`s${i}`} className="mb-4 break-inside-avoid overflow-hidden rounded-xl border bg-card/30" aria-hidden="true">
                  <Skeleton className={cn("w-full rounded-none", i % 3 === 0 ? "aspect-[3/4]" : i % 3 === 1 ? "aspect-[4/3]" : "aspect-square")} />
                  <div className="space-y-2 p-3">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-5 w-24 rounded-full" />
                  </div>
                </li>
              ))}
          </ul>
        )}
        {results.length > 0 && (
          <p className="mt-3 hidden text-xs text-muted-foreground md:block">
            Thumbnails load straight from each source · <kbd className="rounded border px-1">Enter</kbd> opens the full image, its sizes and credit line · <kbd className="rounded border px-1">/</kbd> search
          </p>
        )}

        {!loading && !error && searched && results.length === 0 && (
          <div className="mt-16 text-center text-muted-foreground">
            <Filter className="mx-auto size-8 opacity-50" />
            <p className="mt-3">
              No results. Try fewer or more general words, drop the size or format filters{filters.commercial ? ", turn off Commercial-safe" : ""}, or open the image sites linked above.
            </p>
          </div>
        )}
        {!searched && (
          <div className="mt-16 text-center text-muted-foreground">
            <Sparkles className="mx-auto size-8 text-primary/70" />
            <p className="mt-3">Search {providers.length ? `${providers.length} image sites` : "every image site"} at once. Try:</p>
            <p className="mt-3 flex flex-wrap justify-center gap-2 text-sm">
              {EXAMPLES.map((x) => (
                <button
                  key={x}
                  type="button"
                  onClick={() => {
                    setDraft(x);
                    update({ q: x });
                  }}
                  className="rounded-full border px-3 py-0.5 transition hover:border-primary/40 hover:text-foreground"
                >
                  {x}
                </button>
              ))}
            </p>
          </div>
        )}
        {canMore && !loading && (
          <div className="mt-8 text-center">
            <Button variant="outline" onClick={() => void run(filters, true)}>Load more</Button>
          </div>
        )}

        <Sheet open={Boolean(open)} onOpenChange={(o) => !o && openImage(null)}>
          <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
            {open && (
              <>
                <SheetHeader className="px-4 pt-6 sm:px-6">
                  <SheetDescription>
                    {providerName(open.provider)} · {categoryPath(open.category)}
                    {open.year ? ` · ${open.year}` : ""}
                  </SheetDescription>
                  <SheetTitle className="pr-8 text-xl">{open.title}</SheetTitle>
                </SheetHeader>
                <ImageDetail image={open} providerName={providerName(open.provider)} />
              </>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  );
}
