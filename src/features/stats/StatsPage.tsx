import { useMemo } from "react";
import { Link } from "react-router";
import { ShareButton } from "../../components/ShareButton";
import { accentStyle, formatRuntime, ProgressBar, SectionLabel } from "../../components/ui";
import { catalogIndex } from "../../lib/catalog";
import { useLang } from "../../lib/i18n";
import { todayIso } from "../../lib/progress";
import { useProgressStore } from "../../lib/progressStore";
import { computeStats } from "../../lib/stats";

export function StatsPage() {
  const { t, loc } = useLang();
  const progress = useProgressStore((s) => s.progress);
  const stats = useMemo(() => computeStats(catalogIndex, progress, todayIso()), [progress]);
  const hours = Math.floor(stats.minutes / 60);
  const nf = new Intl.NumberFormat(t("meta.locale"), { maximumFractionDigits: 1 });

  return (
    <div className="pt-6">
      <h1 className="display text-[39px]">{t("stats.title")}</h1>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <DataCard label={t("stats.hours")} value={nf.format(hours)} sub={t("stats.days", { count: Math.floor(hours / 24) })} wide />
        <DataCard label={t("stats.titles")} value={nf.format(stats.titlesWatched)} />
        <DataCard label={t("stats.episodes")} value={nf.format(stats.episodesWatched)} />
        <DataCard
          label={t("stats.streak")}
          value={t("stats.daysShort", { count: stats.streak.current })}
          sub={t("stats.bestStreak", { count: stats.streak.best })}
        />
        <DataCard
          label={t("stats.rating")}
          value={stats.averageRating === null ? "—" : nf.format(stats.averageRating)}
          sub={t("stats.rated", { count: stats.ratedCount })}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-[2px] border-2 border-line bg-line">
        <Link
          to="/achievements"
          className="label bg-surface px-3 py-3 text-center font-bold transition-colors duration-[120ms] ease-out hover:bg-fg hover:text-bg"
        >
          {t("achievements.title")}
        </Link>
        <Link
          to="/wrapped"
          className="label bg-surface px-3 py-3 text-center font-bold transition-colors duration-[120ms] ease-out hover:bg-fg hover:text-bg"
        >
          {t("wrapped.link", { year: todayIso().slice(0, 4) })}
        </Link>
      </div>

      {stats.titlesWatched > 0 && (
        <div className="mt-3">
          <ShareButton
            card={{
              kind: "stats",
              h: hours,
              t: stats.titlesWatched,
              r: stats.averageRating === null ? undefined : Math.round(stats.averageRating * 10),
              f: stats.topFranchise?.franchise.id,
            }}
            title={t("stats.title")}
            text={t("stats.shareText", { hours })}
            fileName="watch-order-stats"
            label={t("stats.share")}
          />
        </div>
      )}

      {stats.topFranchise && (
        <Link
          to={`/f/${stats.topFranchise.franchise.id}`}
          style={accentStyle(stats.topFranchise.franchise.accentColor)}
          className="mt-3 flex items-center justify-between gap-3 border-2 border-line bg-accent px-4 py-3 text-on-accent"
        >
          <span>
            <span className="label block font-bold">{t("stats.top")}</span>
            <span className="display text-[25px]">{loc(stats.topFranchise.franchise.name)}</span>
          </span>
          <span className="font-mono text-sm font-bold">{formatRuntime(stats.topFranchise.minutes, t)}</span>
        </Link>
      )}

      <section className="mt-10">
        <SectionLabel>{t("stats.byFranchise")}</SectionLabel>
        <ul className="space-y-3">
          {stats.perFranchise.map((f) => (
            <li key={f.franchise.id} style={accentStyle(f.franchise.accentColor)} className="border-2 border-line bg-surface p-3.5">
              <div className="flex items-baseline justify-between gap-3">
                <Link to={`/f/${f.franchise.id}`} className="font-semibold hover:underline hover:decoration-2 hover:underline-offset-4">
                  {loc(f.franchise.name)}
                </Link>
                <span className="font-mono text-[11px] text-muted uppercase">
                  {formatRuntime(f.minutes, t)} · {t("progress.count", { watched: f.watched, total: f.total })}
                </span>
              </div>
              <div className="mt-2">
                <ProgressBar ratio={f.total ? f.watched / f.total : 0} label={loc(f.franchise.name)} />
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-fg-soft">{t("stats.note")}</p>
      </section>
    </div>
  );
}

function DataCard({ label, value, sub, wide = false }: { label: string; value: string; sub?: string; wide?: boolean }) {
  return (
    <div className={`border-2 border-line bg-surface ${wide ? "col-span-2" : ""}`}>
      <div className="on-faro label border-b-2 border-line bg-faro px-3.5 py-2 font-bold text-tinta">{label}</div>
      <div className="px-3.5 py-3">
        <p className={`display tabular-nums ${wide ? "text-[49px]" : "text-[31px]"}`}>{value}</p>
        {sub && <p className="mt-1 font-mono text-[11px] text-muted">{sub}</p>}
      </div>
    </div>
  );
}
