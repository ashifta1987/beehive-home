/**
 * The Beehive Home app icon for next/og ImageResponse: a mango key tag with a
 * punched hole and a bold "B", on the ink ground. Brand colours are literal here
 * because this renders to a PNG, not to themed UI.
 */
const INK = "#15171C";
const MANGO = "#FFC542";
const GROUND = "#ECEEF2";

// Geometric bold "B" in a 100 × 120 box (outer shape + two counters, even-odd fill).
const B_PATH =
  "M8 0H58C80 0 93 12 93 30C93 42 87 50 77 55C91 59 99 70 99 86C99 107 84 120 60 120H8Z" +
  "M33 21V48H55C65 48 70 43 70 34.5C70 26 65 21 55 21Z" +
  "M33 68V99H58C69 99 75 93 75 83.5C75 74 69 68 58 68Z";

export function BrandIcon({ size, variant }: { size: number; variant: "rounded" | "full" | "maskable" }) {
  // Maskable icons keep the art inside the central 80 % safe zone.
  const tagW = size * (variant === "maskable" ? 0.44 : 0.54);
  const tagH = tagW * 1.22;
  const hole = tagW * 0.24;
  const letterW = tagW * 0.46;
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
      <div
        style={{
          width: tagW,
          height: tagH,
          background: MANGO,
          borderRadius: tagW * 0.24,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: tagH * 0.09,
          transform: "rotate(-6deg)",
        }}
      >
        <div
          style={{
            width: hole,
            height: hole,
            borderRadius: hole,
            background: GROUND,
            border: `${Math.max(2, tagW * 0.05)}px solid ${INK}`,
          }}
        />
        <svg width={letterW} height={letterW * 1.2} viewBox="0 0 100 120" style={{ marginTop: tagH * 0.1 }}>
          <path d={B_PATH} fill={INK} fillRule="evenodd" />
        </svg>
      </div>
    </div>
  );
}
