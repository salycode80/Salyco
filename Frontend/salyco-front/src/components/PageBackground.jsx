/**
 * PageBackground — warm ambient backdrop shared by all pages.
 *
 * Replaces the old cold "checkered blue grid + fading blue" overlay. Instead of
 * a rigid grid it lays down two soft wheat/wood radial glows over a warm
 * off-white base, so pages feel warm and less monotonous while the navy brand
 * color still lives in the navbar, footer and cards.
 *
 * Render it as the first child of a `relative` section; page content should sit
 * in a sibling wrapped with `relative` so it stacks above.
 */
export default function PageBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* warm wood glow, top-right */}
      <div
        className="absolute -top-24 right-0 h-96 w-2/3"
        style={{
          background:
            "radial-gradient(ellipse at top right, rgba(193,154,107,0.28) 0%, transparent 60%)",
        }}
      />
      {/* soft wheat glow, bottom-left */}
      <div
        className="absolute bottom-0 left-0 h-80 w-2/3"
        style={{
          background:
            "radial-gradient(ellipse at bottom left, rgba(210,180,140,0.22) 0%, transparent 60%)",
        }}
      />
      {/* faint navy tie-in so the brand color still whispers through */}
      <div
        className="absolute top-1/3 left-1/4 h-72 w-1/2"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,26,92,0.05) 0%, transparent 70%)",
        }}
      />
    </div>
  );
}
