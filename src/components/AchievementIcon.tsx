import { ACHIEVEMENT_ICONS, ICON_STROKE } from "../lib/achievementIcons";

export function AchievementIcon({ icon, className = "size-7" }: { icon: string; className?: string }) {
  const shapes = ACHIEVEMENT_ICONS[icon] ?? ACHIEVEMENT_ICONS.star!;
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      {shapes.map((s, i) => {
        if (s.tag === "rect") return <rect key={i} x={s.x} y={s.y} width={s.width} height={s.height} fill="currentColor" />;
        const paint =
          s.mode === "fill"
            ? { fill: "currentColor" }
            : { fill: "none", stroke: "currentColor", strokeWidth: ICON_STROKE, strokeLinecap: "square" as const };
        return s.tag === "path" ? <path key={i} d={s.d} {...paint} /> : <circle key={i} cx={s.cx} cy={s.cy} r={s.r} {...paint} />;
      })}
    </svg>
  );
}
