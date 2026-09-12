import type { ButtonHTMLAttributes, FormHTMLAttributes, HTMLAttributes } from "react";

type Corners = "all" | "tl-br";

const CORNER_BASE = "absolute w-3.5 h-3.5 border-accent pointer-events-none";
const CORNER_POS: Record<"tl" | "tr" | "bl" | "br", string> = {
  tl: "top-0 left-0 -mt-px -ml-px border-t-2 border-l-2",
  tr: "top-0 right-0 -mt-px -mr-px border-t-2 border-r-2",
  bl: "bottom-0 left-0 -mb-px -ml-px border-b-2 border-l-2",
  br: "bottom-0 right-0 -mb-px -mr-px border-b-2 border-r-2",
};

function Corners({ corners }: { corners: Corners }) {
  const positions = corners === "all" ? (["tl", "tr", "bl", "br"] as const) : (["tl", "br"] as const);
  return (
    <>
      {positions.map((p) => (
        // margin: 0 is load-bearing, not decorative — these spans are
        // rendered as trailing siblings of `children` inside whatever
        // container the caller passes `className` to. If that className
        // includes `space-y-*`, Tailwind's `> :not([hidden]) ~ :not([hidden])`
        // selector matches these spans too (they're non-first children) and
        // adds an unwanted margin-top, pushing the top-anchored corners down.
        // Inline style wins the specificity fight against any such utility.
        <span key={p} aria-hidden="true" className={`${CORNER_BASE} ${CORNER_POS[p]}`} style={{ margin: 0 }} />
      ))}
    </>
  );
}

// Bracket-cornered "HUD" panel framing, matching the Seaguard marketing
// site's card style. Renders on top of whatever background/border/padding
// classes the caller passes in — it only adds the corner accents.
export function HudFrame({
  children,
  corners = "all",
  className = "",
  ...rest
}: { corners?: Corners } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`relative ${className}`} {...rest}>
      {children}
      <Corners corners={corners} />
    </div>
  );
}

// Same as HudFrame but rendered as a <button> — for the many places a
// "card" is actually a clickable element (e.g. list-item cards that open
// an edit modal).
export function HudFrameButton({
  children,
  corners = "all",
  className = "",
  ...rest
}: { corners?: Corners } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`relative ${className}`} {...rest}>
      {children}
      <Corners corners={corners} />
    </button>
  );
}

// Same as HudFrame but rendered as a <form> (e.g. the login card).
export function HudFrameForm({
  children,
  corners = "all",
  className = "",
  ...rest
}: { corners?: Corners } & FormHTMLAttributes<HTMLFormElement>) {
  return (
    <form className={`relative ${className}`} {...rest}>
      {children}
      <Corners corners={corners} />
    </form>
  );
}
