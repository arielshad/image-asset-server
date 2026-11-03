import { memo, useState } from "react";
import { ImageIcon, PenTool, RectangleHorizontal, RectangleVertical, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { categoryLabel, orientationLabel, resolutionBadge } from "@/lib/vocab";
import { safeUrl, type ImageAsset } from "./api";
import { VerdictBadge } from "./VerdictBadge";

const ORIENTATION_ICON = { landscape: RectangleHorizontal, portrait: RectangleVertical, square: Square } as const;

/** Checkerboard behind transparent images and SVGs, so their edges show. */
export const CHECKER = "checker";

/** Shown when an image has no thumbnail or it failed to load. */
function Placeholder({ label }: { label?: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-[radial-gradient(120%_120%_at_0%_0%,color-mix(in_oklch,var(--color-primary)_22%,transparent),transparent_60%),radial-gradient(120%_120%_at_100%_100%,color-mix(in_oklch,var(--color-brand-2)_18%,transparent),transparent_60%)] text-muted-foreground">
      <ImageIcon className="size-7 opacity-60" aria-hidden="true" />
      {label && <span className="px-3 text-center text-[11px] leading-tight">{label}</span>}
    </div>
  );
}

/** Aspect ratio to reserve before the thumbnail loads (clamped so panoramas and tall scrolls stay usable). */
export function aspectOf(image: Pick<ImageAsset, "width" | "height" | "orientation">): number {
  if (image.width && image.height) return Math.min(2.4, Math.max(0.5, image.width / image.height));
  return image.orientation === "portrait" ? 0.75 : image.orientation === "square" ? 1 : 4 / 3;
}

/**
 * The thumbnail of an image at its own shape, loaded straight from the
 * source (this server never proxies image bytes), with size and orientation
 * badges. Icons and transparent images sit on a checkerboard.
 */
export function ImageMedia({ image, eager = false, className, fixed }: { image: ImageAsset; eager?: boolean; className?: string; fixed?: number }) {
  const [failed, setFailed] = useState(false);
  const src = failed ? undefined : safeUrl(image.thumbnailUrl ?? image.previewUrl);
  const icon = image.styles?.includes("icon");
  const clear = image.transparent || image.vector;
  const res = image.vector ? "SVG" : resolutionBadge(image.width, image.height);
  const OIcon = image.orientation && !icon ? ORIENTATION_ICON[image.orientation] : undefined;
  const ratio = fixed ?? (icon ? 1 : aspectOf(image));
  return (
    <div className={cn("relative w-full overflow-hidden", clear ? CHECKER : "bg-muted", className)} style={{ aspectRatio: String(ratio) }}>
      {src ? (
        <img
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailed(true)}
          className={cn("absolute inset-0 size-full transition duration-500 group-hover:scale-[1.03]", icon ? "object-contain p-[18%] dark:invert" : clear || fixed ? "object-contain" : "object-cover")}
        />
      ) : (
        <Placeholder label={failed ? "Thumbnail unavailable: open for details" : undefined} />
      )}
      {(res || OIcon) && (
        <span className="pointer-events-none absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white backdrop-blur-sm">
          {image.vector ? <PenTool className="size-3" aria-hidden="true" /> : OIcon && <OIcon className="size-3" aria-label={orientationLabel(image.orientation)} />}
          {res}
        </span>
      )}
    </div>
  );
}

/** One search result: click or Enter opens the detail sheet. */
export const ResultCard = memo(function ResultCard({ image, providerName, onOpen, eager }: { image: ImageAsset; providerName: string; onOpen: (c: ImageAsset) => void; eager?: boolean }) {
  const meta = [providerName, image.year ? String(image.year) : "", categoryLabel(image.category)].filter(Boolean).join(" · ");
  return (
    <li className="group relative mb-4 break-inside-avoid" data-image={image.id}>
      <button
        type="button"
        onClick={() => onOpen(image)}
        className="flex w-full flex-col overflow-hidden rounded-xl border bg-card/50 text-left transition hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        aria-label={`${image.title}, ${meta}. Open details`}
      >
        <ImageMedia image={image} eager={eager} />
        <span className="flex w-full flex-col gap-1.5 p-3">
          <span className="line-clamp-2 text-sm font-medium leading-snug group-hover:text-primary">{image.title}</span>
          <span className="truncate text-xs text-muted-foreground">{meta}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1">
            <VerdictBadge license={image.license} plain />
            {image.license?.editorial && <span className="inline-flex items-center rounded-full border border-warning/40 px-2 py-0.5 text-[11px] font-medium text-warning" title="People, insignia or brands without releases: not for ads">Editorial</span>}
          </span>
        </span>
      </button>
    </li>
  );
});
