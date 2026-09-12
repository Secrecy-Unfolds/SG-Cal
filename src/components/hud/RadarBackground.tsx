// Ambient HUD backdrop — a faint radar scope sitting behind page content.
// Positioned fixed + very low z-index, so the sidebar/topbar's own opaque
// backgrounds naturally mask it there without any width/offset math, and
// opaque cards in the page content mask it too; it only ever shows through
// in the whitespace/gaps of a page. `blips` renders one pulsing "contact"
// dot per currently-present employee (see AppShell's presentCount prop).
export default function RadarBackground({ blips = 0 }: { blips?: number }) {
  const dots = Array.from({ length: Math.max(0, blips) }, (_, i) => {
    // Golden-angle spacing gives an even, non-overlapping scatter without
    // needing real randomness (and stays stable across server/client render).
    const angle = (i * 137.508) % 360;
    const radiusPct = 18 + ((i * 53) % 78); // 18%-96% out from center
    const rad = (angle * Math.PI) / 180;
    return {
      key: i,
      left: 50 + (radiusPct / 2) * Math.cos(rad),
      top: 50 + (radiusPct / 2) * Math.sin(rad),
      delay: (i % 6) * 0.4,
    };
  });

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute left-1/2 top-1/2 h-[130vmax] w-[130vmax] -translate-x-1/2 -translate-y-1/2">
        {/* Scope (rings/crosshair/sweep) stays very faint — pure ambient texture. */}
        <div className="absolute inset-0 opacity-[0.08] dark:opacity-[0.14]">
          <div className="absolute inset-0 rounded-full border border-radar" />
          <div className="absolute inset-[12.5%] rounded-full border border-radar" />
          <div className="absolute inset-[25%] rounded-full border border-radar" />
          <div className="absolute inset-[37.5%] rounded-full border border-radar" />
          <div className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-radar" />
          <div className="absolute top-1/2 left-0 right-0 h-px -translate-y-1/2 bg-radar" />
          <div className="radar-sweep absolute inset-0 rounded-full" />
        </div>

        {/* Blips ("contacts") sit above the faint scope, with their own
            opacity, so they actually read as detected points. */}
        {dots.map((d) => (
          <span
            key={d.key}
            className="radar-blip absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-radar"
            style={{ left: `${d.left}%`, top: `${d.top}%`, animationDelay: `${d.delay}s` }}
          />
        ))}
      </div>
    </div>
  );
}
