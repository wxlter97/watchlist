import type { ReactNode } from "react";
import { Link } from "react-router";
import { accentStyle, ProgressBar } from "./ui";
import { FollowButton } from "./FollowButton";
import type { FranchiseMeta } from "../lib/catalog";
import { effectiveHidden } from "../lib/filters";
import { useLang } from "../lib/i18n";
import { summarizeEntries } from "../lib/progress";
import { useProgressStore } from "../lib/progressStore";
import { useManifestIsWatched } from "../lib/watched";

export function CardHeader({ children }: { children: ReactNode }) {
  return (
    <div className="label flex min-h-10 items-center justify-between gap-2 border-b-2 border-line bg-accent px-3.5 py-2 font-bold text-on-accent">
      {children}
    </div>
  );
}

/** La tarjeta de una franquicia con su progreso: la del Hub y la de los resultados de búsqueda. */
export function FranchiseCard({ franchise }: { franchise: FranchiseMeta }) {
  const { t, loc } = useLang();
  const state = useProgressStore((s) => s.franchiseState[franchise.id]);
  const isWatched = useManifestIsWatched();
  const summary = summarizeEntries(franchise.titles, effectiveHidden(franchise, state?.hiddenContinuities, state?.shownContinuities), isWatched);

  return (
    <div style={accentStyle(franchise.accentColor)} className="flex h-full flex-col border-2 border-line bg-surface">
      <CardHeader>
        <span>{t("franchise.label")}</span>
        <FollowButton franchiseId={franchise.id} compact />
      </CardHeader>
      <Link to={`/f/${franchise.id}`} className="group flex flex-1 flex-col">
        <div className="flex flex-1 flex-col gap-3 p-4">
          <h3 className="display text-[31px]">{loc(franchise.name)}</h3>
          <p className="line-clamp-2 text-sm leading-[1.55] text-fg-soft">{loc(franchise.description)}</p>
          <div className="mt-auto flex items-end justify-between">
            <span className="display text-[31px] tabular-nums">
              {t("progress.percent", { value: Math.round(summary.ratio * 100) })}
            </span>
            <span className="font-mono text-[11px] tracking-[0.06em] text-muted uppercase">
              {t("progress.count", { watched: summary.watched, total: summary.total })}
            </span>
          </div>
          <ProgressBar ratio={summary.ratio} label={loc(franchise.name)} />
        </div>
        <span className="border-t-2 border-line px-4 py-2.5 font-mono text-xs font-bold transition-colors duration-[120ms] ease-out group-hover:bg-faro group-hover:text-tinta">
          {t("hub.open")} →
        </span>
      </Link>
    </div>
  );
}
