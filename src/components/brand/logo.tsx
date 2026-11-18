import { cn } from "@/lib/ui";

/**
 * Beehive Home logo: a pyramid of three honeycomb cells + "BEEHIVE · HOME" wordmark,
 * optionally with the "PANAMPILLY NAGAR, KOCHI" line. Source artwork:
 * public/brand/beehive-home-logo.jpg. Cells use the honey token (--tag1); the wordmark
 * uses currentColor so it reads on light and dark grounds.
 */

/** Points of a pointy-top hexagon. */
export function hexPoints(cx: number, cy: number, r: number): string {
  const w = r * 0.8660254;
  return [
    [cx, cy - r],
    [cx + w, cy - r / 2],
    [cx + w, cy + r / 2],
    [cx, cy + r],
    [cx - w, cy + r / 2],
    [cx - w, cy - r / 2],
  ]
    .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
}

// Three cells: one on top, two below (r = 10, gap = 2.4) in a 38 × 36 box.
const R = 10;
const W = R * 0.8660254;
const GAP = 2.4;
export const HONEYCOMB_CELLS: Array<[number, number]> = [
  [19, 10.5],
  [19 - W - GAP / 2, 10.5 + 1.5 * R + GAP * 0.866],
  [19 + W + GAP / 2, 10.5 + 1.5 * R + GAP * 0.866],
];

export function HoneycombMark({ size = 28, className, color = "var(--tag1)" }: { size?: number; className?: string; color?: string }) {
  return (
    <svg width={size} height={(size * 36) / 38} viewBox="0 0 38 36" className={cn("flex-none", className)} aria-hidden>
      {HONEYCOMB_CELLS.map(([x, y], i) => (
        <polygon key={i} points={hexPoints(x, y, R)} fill={color} strokeLinejoin="round" />
      ))}
    </svg>
  );
}

export function Logo({
  size = 18,
  tagline = false,
  className,
}: {
  /** Wordmark font size in px; the mark and tagline scale with it. */
  size?: number;
  tagline?: boolean;
  className?: string;
}) {
  return (
    <span role="img" aria-label="Beehive Home, Panampilly Nagar, Kochi" className={cn("inline-flex flex-col items-center", className)}>
      <span className="inline-flex items-center" style={{ gap: size * 0.4 }}>
        <HoneycombMark size={size * 1.55} />
        <span
          aria-hidden
          className="inline-flex items-center font-display font-extrabold uppercase leading-none"
          style={{ fontSize: size, letterSpacing: "-0.01em", gap: size * 0.28 }}
        >
          <span>Beehive</span>
          <svg width={size * 0.42} height={size * 0.42} viewBox="0 0 20 20" aria-hidden className="flex-none">
            <polygon points={hexPoints(10, 10, 10)} fill="var(--tag1)" />
          </svg>
          <span>Home</span>
        </span>
      </span>
      {tagline ? (
        <span aria-hidden className="mt-[0.45em] inline-flex w-full items-center" style={{ fontSize: size * 0.42, gap: size * 0.5 }}>
          <span className="h-[1.5px] flex-1 bg-tag1" />
          <span className="whitespace-nowrap font-bold uppercase tracking-[0.12em]">Panampilly Nagar, Kochi</span>
          <span className="h-[1.5px] flex-1 bg-tag1" />
        </span>
      ) : null}
    </span>
  );
}

