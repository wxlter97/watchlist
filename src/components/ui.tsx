import { useId, type ButtonHTMLAttributes, type CSSProperties, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { onColor } from "../lib/color";
import { posterUrl, type PosterSize } from "../lib/tmdb";
import { useLang } from "../lib/i18n";
import { splitRuntime } from "../lib/progress";
import type { Importance, Title } from "../lib/types";

// Componentes base del design system wxlter: borde 2px, radio 0, sin sombras,
// hover por inversión de color (≤120ms).

export function accentStyle(color: string): CSSProperties {
  return { "--accent": color, "--on-accent": onColor(color) } as CSSProperties;
}

/** Ícono de la app: la "O" de Order sobre Faro (siguiente paso de la serie de íconos). */
export function AppMark({ size = 32 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center bg-faro font-display text-tinta"
      style={{ width: size, height: size, fontSize: size * 0.55, lineHeight: 1, letterSpacing: "-0.04em" }}
    >
      O
    </span>
  );
}

/** Símbolo W monocromo de la marca madre (trazo 17 por ser < 32px). */
export function WxlterSymbol({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden className="shrink-0">
      <polyline
        points="14,24 32,76 50,44 68,76 86,24"
        fill="none"
        stroke="currentColor"
        strokeWidth={17}
        strokeLinejoin="miter"
      />
    </svg>
  );
}

export function SectionLabel({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2 id={id} className="label mb-2 text-muted">
      {children}
    </h2>
  );
}

export function Poster({ title, size, className = "" }: { title: Title; size: PosterSize; className?: string }) {
  const src = posterUrl(title.posterPath, size);
  return (
    <div className={`relative shrink-0 overflow-hidden border-2 border-line bg-surface-muted ${className}`}>
      {src ? (
        <img key={src} src={src} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
      ) : (
        <div className="label grid size-full place-items-center p-1 text-center text-[9px] text-muted">{title.title}</div>
      )}
    </div>
  );
}

const importanceClass: Record<Importance, string> = {
  essential: "bg-faro text-tinta border-tinta",
  recommended: "bg-tinta text-faro border-tinta dark:border-faro",
  optional: "border-line-soft text-muted",
  skippable: "border-dashed border-line-soft text-muted",
};

export function ImportanceBadge({ importance }: { importance: Importance }) {
  const { t } = useLang();
  return (
    <span className={`inline-block border-2 px-1.5 py-px font-mono text-[10px] font-bold tracking-[0.1em] uppercase ${importanceClass[importance]}`}>
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
      className="h-3 border-2 border-line bg-surface"
    >
      <div className="h-full bg-accent" style={{ width: `${ratio * 100}%` }} />
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
      className={`grid size-11 shrink-0 place-items-center border-2 border-line transition-colors duration-[120ms] ease-out ${
        watched ? "bg-accent text-on-accent" : "bg-surface text-muted hover:bg-fg hover:text-bg"
      }`}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden>
        <path d="M4.5 12.5l5 5L19.5 7" strokeLinecap="square" strokeLinejoin="miter" />
      </svg>
    </button>
  );
}

/**
 * Tabs de la marca: borde exterior de 2px y separadores de 2px (el hueco del grid deja ver
 * el color de línea), la activa con fondo de acento. `layout`: flex (por defecto) o un grid.
 */
export function Tabs<T extends string>({
  label,
  value,
  options,
  onChange,
  size = "md",
  layout = "flex",
}: {
  label: string;
  value: T | undefined;
  options: { value: T; label: string; disabled?: boolean }[];
  onChange: (value: T) => void;
  size?: "sm" | "md";
  layout?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={`gap-[2px] border-2 border-line bg-line ${layout}`}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={`flex-auto font-mono tracking-[0.08em] whitespace-nowrap uppercase transition-colors duration-[120ms] ease-out disabled:cursor-not-allowed disabled:text-muted disabled:line-through disabled:decoration-1 ${
              size === "sm" ? "px-2 py-1 text-[11px]" : "min-h-11 px-3 py-2 text-xs"
            } ${active ? "bg-accent font-bold text-on-accent" : "bg-surface text-fg enabled:hover:bg-fg enabled:hover:text-bg"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Toggle cuadrado de la marca: 52×28, Faro cuando está activo. */
export function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      onClick={() => onChange(!checked)}
      className={`flex h-7 w-[52px] shrink-0 border-2 border-line p-0.5 ${checked ? "justify-end bg-faro" : "justify-start bg-surface"}`}
    >
      <span className={`size-5 ${checked ? "bg-tinta" : "bg-fg"}`} />
    </button>
  );
}

/** Aviso: borde 2px con barra izquierda de 10px; en error, todo en Alerta. */
export function Notice({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "error" }) {
  const color = tone === "error" ? "border-alerta" : "border-line border-l-faro";
  return <div className={`border-2 border-l-[10px] bg-surface px-3.5 py-3 text-sm ${color}`}>{children}</div>;
}

const buttonVariants = {
  primary: "border-tinta bg-faro text-tinta hover:bg-tinta hover:text-faro",
  secondary: "border-line bg-surface text-fg hover:bg-fg hover:text-bg",
  danger: "border-alerta bg-surface text-alerta hover:bg-alerta hover:text-white",
} as const;

export function Button({
  variant = "secondary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof buttonVariants }) {
  return (
    <button
      type="button"
      {...props}
      className={`min-h-11 border-2 px-5 py-2.5 text-[15px] font-bold transition-colors duration-[120ms] ease-out disabled:border-line-soft disabled:bg-surface-muted disabled:text-muted ${buttonVariants[variant]} ${className}`}
    />
  );
}

/** Chip seleccionable (filtros de selección múltiple). */
export function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`min-h-9 border-2 px-2.5 py-1 font-mono text-[11px] tracking-[0.08em] uppercase transition-colors duration-[120ms] ease-out ${
        selected ? "border-line bg-accent font-bold text-on-accent" : "border-line-soft bg-surface text-fg hover:border-line"
      }`}
    >
      {children}
    </button>
  );
}

export function SelectField({
  label,
  options,
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: { value: string; label: string }[] }) {
  const id = useId();
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="label text-fg-soft">
        {label}
      </label>
      <select
        id={id}
        {...props}
        className="min-h-11 border-2 border-line bg-surface px-3 py-2 font-mono text-sm text-fg"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function TextField({
  label,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const id = useId();
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="label text-fg-soft">
        {label}
      </label>
      <input
        id={id}
        {...props}
        className="min-h-11 border-2 border-line bg-surface px-3 py-2.5 font-mono text-sm text-fg placeholder:text-muted"
      />
    </div>
  );
}

/** "2008 · PELÍCULA · 2 H 6 MIN" o "2021 · SERIE · 2 TEMPORADAS". */
export function TitleMeta({ title, season }: { title: Title; season?: number }) {
  const { t } = useLang();
  if (season !== undefined) {
    // Una temporada: su año y sus episodios.
    const s = title.seasons?.find((x) => x.number === season);
    const year = (s?.airDate ?? title.releaseDate).slice(0, 4);
    const parts = [year, t(`kind.${title.kind}`), ...(s ? [t("title.episodes", { count: s.episodes })] : [])];
    return <span className="font-mono text-[11px] tracking-[0.06em] text-muted uppercase">{parts.join(" · ")}</span>;
  }
  const parts: string[] = [title.releaseDate.slice(0, 4), t(`kind.${title.kind}`)];
  if (title.seasons?.length) parts.push(t("title.seasons", { count: title.seasons.length }));
  else if (title.runtimeMin) parts.push(formatRuntime(title.runtimeMin, t));
  return <span className="font-mono text-[11px] tracking-[0.06em] text-muted uppercase">{parts.join(" · ")}</span>;
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
    <span className="font-mono text-[11px] text-muted" title={t("postCredits.detail", { mid, end })}>
      {t("postCredits.short", { count })}
    </span>
  );
}

export function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5L21 21" strokeLinecap="square" />
    </svg>
  );
}
