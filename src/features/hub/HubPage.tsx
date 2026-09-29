import type { ReactNode } from "react";
import { Link } from "react-router";
import { accentStyle, Poster, ProgressBar, SectionLabel, TitleMeta, WatchToggle } from "../../components/ui";
import { useFranchiseView } from "../../hooks/useFranchiseView";
import { catalog } from "../../lib/catalog";
import { useLang } from "../../lib/i18n";
import { useProgressStore } from "../../lib/progressStore";
import type { Franchise } from "../../lib/types";

export function HubPage() {
  const { t, loc } = useLang();
  const franchises = [...catalog.franchises].sort((a, b) => loc(a.name).localeCompare(loc(b.name)));

  return (
    <div>
      <section className="on-faro -mx-4 border-b-2 border-line bg-faro px-4 pt-8 pb-10 text-tinta">
        <p className="label font-bold">{t("hub.eyebrow")}</p>
        <h1 className="display mt-4 max-w-[15ch] text-[39px] [text-wrap:balance] sm:text-[49px]">{t("app.tagline")}</h1>
      </section>

      <section className="mt-8">
        <SectionLabel>{t("hub.continue")}</SectionLabel>
        <div className="space-y-4">
          {franchises.map((f) => (
            <ContinueCard key={f.id} franchise={f} />
          ))}
        </div>
      </section>

      <section className="mt-10">
        <SectionLabel>{t("hub.franchises")}</SectionLabel>
        <ul className="grid gap-4 sm:grid-cols-2">
          {franchises.map((f) => (
            <li key={f.id}>
              <FranchiseCard franchise={f} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function CardHeader({ children }: { children: ReactNode }) {
  return (
    <div className="label border-b-2 border-line bg-accent px-3.5 py-2.5 font-bold text-on-accent">{children}</div>
  );
}

function ContinueCard({ franchise }: { franchise: Franchise }) {
  const { t, loc, name } = useLang();
  const { next } = useFranchiseView(franchise.id);
  const setStatus = useProgressStore((s) => s.setStatus);

  return (
    <div style={accentStyle(franchise.accentColor)} className="border-2 border-line bg-surface">
      <CardHeader>{loc(franchise.name)}</CardHeader>
      {next ? (
        <div className="flex items-center gap-3 p-3">
          <Link to={`/t/${next.title.id}`} className="group flex min-w-0 flex-1 items-center gap-3">
            <Poster title={next.title} size="w154" className="h-24 w-16" />
            <div className="min-w-0">
              <p className="label text-muted">{t("hub.upNext")}</p>
              <p className="mt-1 truncate font-semibold group-hover:underline group-hover:decoration-2 group-hover:underline-offset-4">
                {name(next.title)}
              </p>
              <TitleMeta title={next.title} />
            </div>
          </Link>
          <WatchToggle
            watched={false}
            label={t("actions.markWatched", { title: name(next.title) })}
            onToggle={() => setStatus(next.title.id, "watched")}
          />
        </div>
      ) : (
        <p className="p-4 text-sm text-fg-soft">{t("hub.allCaughtUp")}</p>
      )}
    </div>
  );
}

function FranchiseCard({ franchise }: { franchise: Franchise }) {
  const { t, loc } = useLang();
  const { summary } = useFranchiseView(franchise.id);

  return (
    <Link
      to={`/f/${franchise.id}`}
      style={accentStyle(franchise.accentColor)}
      className="group flex h-full flex-col border-2 border-line bg-surface"
    >
      <CardHeader>{t("franchise.label")}</CardHeader>
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
  );
}
