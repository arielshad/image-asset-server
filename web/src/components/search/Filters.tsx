import { useEffect, useState } from "react";
import { ChevronDown, Download, Sparkles, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { STYLES, TOP_CATEGORIES, categoryLabel, depth, styleLabel, subCategories } from "@/lib/vocab";
import type { Provider } from "./api";

const chip = (on: boolean) =>
  cn(
    "inline-flex h-7 items-center rounded-full border text-xs font-medium transition",
    on ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
  );

const inTop = (top: string, c: string) => c === top || c.startsWith(`${top}.`);

/**
 * Top-level category chips; chips with sub-categories open a popover to pick
 * them (Art ▸ Paintings, Drawings & prints…). `value` is the list of selected category ids.
 */
export function CategoryChips({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const tops = TOP_CATEGORIES.filter((t) => t !== "other");
  return (
    <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&>*]:shrink-0" role="group" aria-label="Categories">
      {tops.map((top) => {
        const subs = subCategories(top);
        const picked = value.filter((c) => inTop(top, c));
        const on = picked.length > 0;
        const label = picked.length === 1 && picked[0] !== top ? categoryLabel(picked[0]) : picked.length > 1 ? `${categoryLabel(top)} · ${picked.length}` : categoryLabel(top);
        const toggleTop = () => onChange(on ? value.filter((c) => !inTop(top, c)) : [...value, top]);
        if (!subs.length) {
          return (
            <button key={top} type="button" aria-pressed={on} onClick={toggleTop} className={cn(chip(on), "px-3")}>
              {label}
            </button>
          );
        }
        return (
          <span key={top} className={cn(chip(on), "overflow-hidden")}>
            <button type="button" aria-pressed={on} onClick={toggleTop} className="h-full pl-3 pr-1.5">
              {label}
            </button>
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" aria-label={`${categoryLabel(top)} sub-categories`} className={cn("flex h-full items-center border-l pl-1 pr-2", on ? "border-primary-foreground/30" : "border-border")}>
                  <ChevronDown className="size-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-60 p-2">
                <p className="px-1.5 pb-1.5 text-xs font-medium text-muted-foreground">{categoryLabel(top)}</p>
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-accent">
                  <Checkbox checked={value.includes(top)} onCheckedChange={(v) => onChange(v ? [...value.filter((c) => !inTop(top, c)), top] : value.filter((c) => c !== top))} />
                  All {categoryLabel(top).toLowerCase()}
                </label>
                <div className="max-h-72 overflow-y-auto">
                  {subs.map((sub) => (
                    <label key={sub.id} className={cn("flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-accent", depth(sub.id) > 1 && "pl-6")}>
                      <Checkbox
                        checked={value.includes(sub.id)}
                        onCheckedChange={(v) => onChange(v ? [...value.filter((c) => c !== top), sub.id] : value.filter((c) => c !== sub.id))}
                      />
                      {sub.label}
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </span>
        );
      })}
      {value.length > 0 && (
        <button type="button" onClick={() => onChange([])} className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs text-muted-foreground hover:text-foreground">
          <X className="size-3" /> Clear
        </button>
      )}
    </div>
  );
}

/** A compact segmented control ("Any · Landscape · Vertical · Square"). */
export function Segmented<T extends string>({ label, options, value, onChange }: { label: string; options: { value: T; label: string; title?: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="inline-flex h-7 max-w-full items-center overflow-x-auto rounded-full border p-0.5 text-xs [scrollbar-width:none]">
      {options.map((o) => (
        <button
          key={o.value || "any"}
          type="button"
          aria-pressed={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn("h-full shrink-0 whitespace-nowrap rounded-full px-2.5 font-medium transition", value === o.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Photo, painting, vector, icon, transparent…: several may be picked. */
export function StylePicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const label = value.length === 0 ? "Kind" : value.length === 1 ? styleLabel(value[0]) : `${value.length} kinds`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={cn(chip(value.length > 0), "gap-1 px-3")} aria-label={value.length ? `Kind: ${value.map(styleLabel).join(", ")}` : "Kind: any"}>
          <Sparkles className="size-3.5" /> {label}
          <ChevronDown className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-2">
        <p className="px-1.5 pb-1.5 text-xs font-medium text-muted-foreground">What kind of image, and how it looks</p>
        {STYLES.map((s) => (
          <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-accent">
            <Checkbox checked={value.includes(s.id)} onCheckedChange={(v) => onChange(v ? [...value, s.id] : value.filter((x) => x !== s.id))} />
            {s.label}
          </label>
        ))}
        <p className="mt-1.5 px-1.5 text-[11px] leading-snug text-muted-foreground">Vector and icon only show those. Sources rarely tag the others, so matching images are ranked first rather than the rest dropped.</p>
        {value.length > 0 && (
          <Button variant="ghost" size="sm" className="mt-1 w-full" onClick={() => onChange([])}>
            Any kind
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Choose which sources to search. `value` null = all. */
export function SourcePicker({ providers, value, onApply }: { providers: Provider[]; value: string[] | null; onApply: (v: string[] | null) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[] | null>(value);
  useEffect(() => setDraft(value), [value, open]);
  const label = value ? `${value.length} of ${providers.length} sources` : "All sources";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1.5 rounded-full text-xs">
          <SlidersHorizontal className="size-3.5" /> {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium">Sources</p>
          <span className="flex gap-3">
            <button type="button" className="text-xs text-primary hover:underline" onClick={() => setDraft(null)}>All</button>
            <button type="button" className="text-xs text-primary hover:underline" onClick={() => setDraft([])}>None</button>
          </span>
        </div>
        <div className="grid max-h-72 grid-cols-1 gap-0.5 overflow-y-auto">
          {providers.map((p) => {
            const on = !draft || draft.includes(p.id);
            return (
              <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-accent" title={p.description}>
                <Checkbox
                  checked={on}
                  onCheckedChange={(v) => {
                    const current = draft ?? providers.map((x) => x.id);
                    const next = v ? [...current, p.id] : current.filter((x) => x !== p.id);
                    setDraft(next.length === providers.length ? null : next);
                  }}
                />
                <span className="flex-1">{p.name}</span>
                {p.access === "link" ? (
                  <span className="text-[10px] text-muted-foreground">link</span>
                ) : (
                  p.supportsDownload && <Download className="size-3 text-muted-foreground" aria-label="direct downloads" />
                )}
              </label>
            );
          })}
        </div>
        <Button
          size="sm"
          className="mt-3 w-full"
          disabled={draft !== null && draft.length === 0}
          onClick={() => {
            onApply(draft);
            setOpen(false);
          }}
        >
          Apply
        </Button>
      </PopoverContent>
    </Popover>
  );
}
