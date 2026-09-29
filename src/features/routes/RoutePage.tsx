import { Link, useParams } from "react-router";
import { TitleRow } from "../../components/TitleRow";
import { accentStyle, formatRuntime, Poster, ProgressBar, SectionLabel } from "../../components/ui";
import { catalogIndex } from "../../lib/catalog";
import { useLang } from "../../lib/i18n";
import { useIsWatched } from "../../lib/progressStore";
import { resolveRoute, routeProgress } from "../../lib/routes";

export function RoutePage() {
  const { franchiseId, routeId } = useParams();
  const { t, loc, name, date } = useLang();
  const isWatched = useIsWatched();
  const franchise = franchiseId ? catalogIndex.franchisesById.get(franchiseId) : undefined;
  const route = franchise?.routes.find((r) => r.id === routeId);

  if (!franchise || !route) return <p className="py-16 text-center text-muted">{t("routes.notFound")}</p>;

  const items = resolveRoute(route, franchise, catalogIndex);
  const progress = routeProgress(items, isWatched);
  const target = route.targetTitleId ? catalogIndex.titlesById.get(route.targetTitleId) : undefined;
  const ratio = progress.total ? progress.watched / progress.total : 0;

  return (
    <div style={accentStyle(franchise.accentColor)}>
      <header className="-mx-4 border-b-2 border-line bg-accent px-4 pt-5 pb-8 text-on-accent">
        <Link to={`/f/${franchise.id}`} className="label inline-block border-b-2 border-current pb-0.5 font-bold">
          ← {loc(franchise.name)}
        </Link>
        {/* En "Prepárate para…" el nombre ya lo dice. */}
        {route.kind !== "prep" && <p className="label mt-6 font-bold">{t(`routes.kinds.${route.kind}`)}</p>}
        <h1 className={`display text-[39px] [text-wrap:balance] ${route.kind === "prep" ? "mt-6" : "mt-2"}`}>{loc(route.name)}</h1>
        <p className="mt-3 max-w-[58ch] text-[15px] leading-[1.55]">{loc(route.description)}</p>
      </header>

      {target && (
        <Link to={`/t/${target.id}`} className="group mt-6 flex items-center gap-3 border-2 border-line bg-surface p-3">
          <Poster title={target} size="w92" className="h-[72px] w-12" />
          <div className="min-w-0">
            <p className="label text-muted">{t("routes.target")}</p>
            <p className="truncate font-semibold group-hover:underline group-hover:decoration-2 group-hover:underline-offset-4">
              {name(target)}
            </p>
            <p className="font-mono text-[11px] text-muted uppercase">{date(target.releaseDate)}</p>
          </div>
        </Link>
      )}

      <section className="mt-6 border-2 border-line bg-surface p-4">
        <div className="flex items-end justify-between gap-4">
          <p className="display text-[39px] tabular-nums">
            {progress.watched}/{progress.total}
          </p>
          <p className="text-right font-mono text-[11px] leading-relaxed tracking-[0.06em] text-muted uppercase">
            {progress.watched === progress.total
              ? t("routes.done")
              : t("routes.remaining", { time: formatRuntime(progress.remainingMin, t) })}
          </p>
        </div>
        <div className="mt-3">
          <ProgressBar ratio={ratio} label={loc(route.name)} />
        </div>
      </section>

      <section className="mt-8">
        <SectionLabel>{target ? t("routes.before") : t("routes.titles")}</SectionLabel>
        <ol>
          {items.map((item) => (
            <TitleRow key={item.title.id} item={item} />
          ))}
        </ol>
      </section>
    </div>
  );
}
