import { HONEYCOMB_CELLS, hexPoints } from "@/components/brand/logo";

/**
 * The Beehive Home app icon for next/og ImageResponse: the three honeycomb cells of the
 * logo on the ink ground. Brand colours are literal here because this renders to a PNG,
 * not to themed UI.
 */
const INK = "#15171C";
const HONEY = "#FFC542";

export function BrandIcon({ size, variant }: { size: number; variant: "rounded" | "full" | "maskable" }) {
  // Maskable icons keep the art inside the central 80 % safe zone.
  const markW = size * (variant === "maskable" ? 0.5 : 0.62);
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: INK,
        borderRadius: variant === "rounded" ? size * 0.22 : 0,
      }}
    >
      <svg width={markW} height={(markW * 36) / 38} viewBox="0 0 38 36">
        {HONEYCOMB_CELLS.map(([x, y], i) => (
          <polygon key={i} points={hexPoints(x, y, 10)} fill={HONEY} />
        ))}
      </svg>
    </div>
  );
}
