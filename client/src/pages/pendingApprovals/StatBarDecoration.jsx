import { HEXAGON_CLIP } from "./constants.js";

/**
 * StatBarDecoration.jsx
 * ----------------------
 * Purely decorative background for the proposals stat bar - layered hexagon
 * accents (echoing the real stat-item icon badges), a couple of thin orbit
 * rings, soft blurred color blobs, and a fine dot texture in both corners.
 * Deliberately built from independent, self-contained shapes rather than a
 * connected illustration: an earlier "flow diagram" version (feedback cards
 * -> a Review/Decision/Outcome stack -> outcome pills) needed every piece
 * positioned exactly right relative to every other piece, and elements
 * butted into each other or drifted under the stat row depending on the
 * card's actual rendered size. None of these shapes depend on any other
 * shape's position, so there's no adjacency to get wrong and it looks right
 * regardless of card size. No data, aria-hidden.
 *
 * Everything here is plain CSS (radial-gradient blobs, clip-path hexagons,
 * a CSS dot-grid background, dashed-border circles), not SVG with a
 * viewBox - sidesteps every scaling/cropping failure mode hit earlier with
 * preserveAspectRatio ("slice" blew content up past its box; "none"
 * stretched a dot pattern into diagonal streaks and ellipse-ified circular
 * rings) since there's nothing here that needs to be mapped into a
 * different coordinate space.
 */

/** One outlined or filled hexagon accent shape - echoes the hexagon icon badges used for the real stat items below. */
function HexAccent({ size, top, right, left, bottom, rotate = 0, fill, stroke, opacity = 1 }) {
  return (
    <div
      className="absolute"
      style={{
        width: size,
        height: size,
        top,
        right,
        left,
        bottom,
        transform: `rotate(${rotate}deg)`,
        clipPath: HEXAGON_CLIP,
        background: fill ?? "transparent",
        boxShadow: stroke ? `inset 0 0 0 1.5px ${stroke}` : "none",
        opacity,
      }}
    />
  );
}

export default function StatBarDecoration() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* ambient color wash, spread across the whole card instead of pooled in one corner */}
      <div
        className="absolute -left-16 -top-20 h-56 w-56 rounded-full opacity-50 blur-3xl"
        style={{ background: "radial-gradient(circle, rgb(var(--lavender-rgb)/0.3), transparent 70%)" }}
      />
      <div
        className="absolute left-1/3 -top-24 h-52 w-52 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, rgb(var(--royal-rgb)/0.2), transparent 70%)" }}
      />
      <div
        className="absolute -right-16 -top-24 h-64 w-64 rounded-full opacity-60 blur-3xl"
        style={{ background: "radial-gradient(circle, rgb(var(--violet-rgb)/0.35), transparent 70%)" }}
      />
      <div
        className="absolute -bottom-24 -left-10 h-56 w-56 rounded-full opacity-50 blur-3xl"
        style={{ background: "radial-gradient(circle, rgb(var(--lavender-rgb)/0.3), transparent 70%)" }}
      />
      <div
        className="absolute right-24 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full opacity-40 blur-2xl"
        style={{ background: "radial-gradient(circle, rgb(var(--success-rgb)/0.25), transparent 70%)" }}
      />

      {/* thin orbit rings, centered on the card rather than tucked in a corner - plain dashed-border circles, always perfectly round regardless of card size */}
      <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-[rgb(var(--violet-rgb)/0.14)]" />
      <div className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-[rgb(var(--violet-rgb)/0.08)]" />

      {/* hexagon accents, echoing the real stat-item icon badges - spread left to right, not clustered */}
      <HexAccent size={110} top="-26px" left="6%" rotate={-10} stroke="rgb(var(--violet-rgb)/0.15)" />
      <HexAccent size={30} top="20px" left="20%" rotate={18} fill="rgb(var(--lavender-rgb)/0.16)" />
      <HexAccent size={22} bottom="16px" left="32%" rotate={-8} fill="rgb(var(--danger-rgb)/0.14)" />
      <HexAccent size={44} top="6px" left="44%" rotate={10} fill="rgb(var(--royal-rgb)/0.08)" />
      <HexAccent size={120} top="-30px" right="60px" rotate={8} stroke="rgb(var(--violet-rgb)/0.16)" />
      <HexAccent size={54} top="18px" right="180px" rotate={-6} fill="rgb(var(--violet-rgb)/0.1)" />
      <HexAccent size={34} bottom="14px" right="90px" rotate={14} fill="rgb(var(--success-rgb)/0.16)" />
      <HexAccent size={26} top="8px" right="20px" rotate={-10} fill="rgb(var(--warning-rgb)/0.18)" />
      <HexAccent size={18} bottom="30px" right="240px" rotate={20} fill="rgb(var(--danger-rgb)/0.16)" />

      {/* dot texture in both corners */}
      <div
        className="absolute left-0 top-0 h-28 w-40 opacity-70"
        style={{
          backgroundImage: "radial-gradient(rgb(var(--navy-rgb)/0.14) 1px, transparent 1.5px)",
          backgroundSize: "14px 14px",
          maskImage: "linear-gradient(to right, black, transparent)",
          WebkitMaskImage: "linear-gradient(to right, black, transparent)",
        }}
      />
      <div
        className="absolute right-0 top-0 h-28 w-48 opacity-70"
        style={{
          backgroundImage: "radial-gradient(rgb(var(--navy-rgb)/0.16) 1px, transparent 1.5px)",
          backgroundSize: "14px 14px",
          maskImage: "linear-gradient(to left, black, transparent)",
          WebkitMaskImage: "linear-gradient(to left, black, transparent)",
        }}
      />
    </div>
  );
}
