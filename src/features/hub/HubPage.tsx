import { Link } from "react-router";
import { accentStyle, Poster, ProgressBar, TitleMeta, WatchToggle } from "../../components/ui";
import { useFranchiseView } from "../../hooks/useFranchiseView";
import { catalog } from "../../lib/catalog";
import { useLang } from "../../lib/i18n";
import { useProgressStore } from "../../lib/progressStore";
import type { Franchise } from "../../lib/types";

export function HubPage() {
  const { t, loc } = useLang();
  const franchises = [...catalog.franchises].sort((a, b) => loc(a.name).localeCompare(loc(b.name)));

  return (
    <div className="space-y-8 pt-2">
      <section>
        <h2 className="mb-3 text-lg font-semibold">{t("hub.continue")}</h2>
        <div className="space-y-3">
          {franchises.map((f) => (
            <ContinueCard key={f.id} franchise={f} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">{t("hub.franchises")}</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
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

function ContinueCard({ franchise }: { franchise: Franchise }) {
  const { t, loc, name } = useLang();
  const { next } = useFranchiseView(franchise.id);
  const setStatus = useProgressStore((s) => s.setStatus);

  return (
    <div style={accentStyle(franchise.accentColor)} className="flex items-center gap-3 rounded-xl bg-surface p-3 ring-1 ring-white/5">
      {next ? (
        <>
          <Link to={`/t/${next.title.id}`} className="flex min-w-0 flex-1 items-center gap-3">
            <Poster title={next.title} size="w154" className="h-24 w-16" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-(--accent)">{loc(franchise.name)}</p>
              <p className="truncate font-medium">{name(next.title)}</p>
              <TitleMeta title={next.title} />
            </div>
          </Link>
          <WatchToggle
            watched={false}
            label={t("actions.markWatched", { title: name(next.title) })}
            onToggle={() => setStatus(next.title.id, "watched")}
          />
        </>
      ) : (
        <p className="px-1 py-2 text-sm text-muted">
          <span className="font-semibold text-(--accent)">{loc(franchise.name)}</span> · {t("hub.allCaughtUp")}
        </p>
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
      className="block rounded-xl bg-surface p-4 ring-1 ring-white/5 transition-colors hover:bg-surface-2"
    >
      <div className="flex items-center gap-2">
        <span aria-hidden className="size-2.5 rounded-full bg-(--accent)" />
        <h3 className="font-semibold">{loc(franchise.name)}</h3>
      </div>
      <p className="mt-1 line-clamp-2 text-sm text-muted">{loc(franchise.description)}</p>
      <div className="mt-3 flex justify-between text-xs text-muted">
        <span className="tabular-nums">{t("progress.count", { watched: summary.watched, total: summary.total })}</span>
        <span className="tabular-nums">{t("progress.percent", { value: Math.round(summary.ratio * 100) })}</span>
      </div>
      <div className="mt-1.5">
        <ProgressBar ratio={summary.ratio} label={loc(franchise.name)} />
      </div>
    </Link>
  );
}
