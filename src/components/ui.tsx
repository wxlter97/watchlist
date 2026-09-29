import type { CSSProperties, ReactNode } from "react";
import { posterUrl, type PosterSize } from "../lib/tmdb";
import { useLang } from "../lib/i18n";
import { splitRuntime } from "../lib/progress";
import type { Importance, Title } from "../lib/types";

export function accentStyle(color: string): CSSProperties {
  return { "--accent": color } as CSSProperties;
}

export function Poster({
  title,
  size,
  className = "",
}: {
  title: Title;
  size: PosterSize;
  className?: string;
}) {
  const src = posterUrl(title.posterPath, size);
  return (
    <div className={`relative shrink-0 overflow-hidden rounded-md bg-surface-2 ring-1 ring-white/5 ${className}`}>
      {src ? (
        <img key={src} src={src} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
      ) : (
        <div className="grid size-full place-items-center p-1 text-center text-[10px] leading-tight text-faint">
          {title.title}
        </div>
      )}
    </div>
  );
}

const importanceColor: Record<Importance, string> = {
  essential: "text-essential",
  recommended: "text-recommended",
  optional: "text-optional",
  skippable: "text-skippable",
};

export function ImportanceBadge({ importance }: { importance: Importance }) {
  const { t } = useLang();
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${importanceColor[importance]}`}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {t(`importance.${importance}`)}
    </span>
  );
}

export function ProgressBar({ ratio, label }: { ratio: number; label: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(ratio * 100)}
      className="h-1.5 overflow-hidden rounded-full bg-white/10"
    >
      <div className="h-full rounded-full bg-(--accent) transition-[width] duration-300" style={{ width: `${ratio * 100}%` }} />
    </div>
  );
}

export function WatchToggle({ watched, label, onToggle }: { watched: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={watched}
      aria-label={label}
      onClick={onToggle}
      className={`grid size-11 shrink-0 place-items-center rounded-full border transition-colors ${
        watched
          ? "border-transparent bg-(--accent) text-white"
          : "border-line text-faint hover:border-muted hover:text-muted"
      }`}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden>
        <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

/** "2008 · Película · 2 h 6 min" o "2021 · Serie · 2 temporadas". */
export function TitleMeta({ title }: { title: Title }) {
  const { t } = useLang();
  const parts: ReactNode[] = [title.releaseDate.slice(0, 4), t(`kind.${title.kind}`)];
  if (title.seasons?.length) {
    parts.push(t("title.seasons", { count: title.seasons.length }));
  } else if (title.runtimeMin) {
    parts.push(formatRuntime(title.runtimeMin, t));
  }
  return <span className="text-xs text-muted">{parts.join(" · ")}</span>;
}

export function formatRuntime(min: number, t: ReturnType<typeof useLang>["t"]): string {
  const { h, m } = splitRuntime(min);
  return h ? t("title.hours", { h, m }) : t("title.minutes", { m });
}

export function PostCreditsIcon({ mid, end }: { mid: number; end: number }) {
  const { t } = useLang();
  const count = mid + end;
  if (!count) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted" title={t("postCredits.detail", { mid, end })}>
      <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
        <rect x="2" y="3" width="12" height="10" rx="1.5" />
        <path d="M5 6.5h6M5 9.5h4" strokeLinecap="round" />
      </svg>
      {t("postCredits.short", { count })}
    </span>
  );
}
