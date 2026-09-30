import { useMemo } from "react";
import { Link, useSearchParams } from "react-router";
import { ShareLinkButton } from "../../components/ShareLinkButton";
import { TitleRow } from "../../components/TitleRow";
import { accentStyle, formatRuntime, Poster, ProgressBar, SectionLabel, Tabs } from "../../components/ui";
import type { CatalogIndex } from "../../lib/catalogIndex";
import { useLang } from "../../lib/i18n";
import { isPrepLevel, PREP_LEVELS, prepUnits, type PrepLevel } from "../../lib/prep";
import { routeProgress } from "../../lib/routes";
import type { Franchise, Route, Title } from "../../lib/types";
import { useIsWatched } from "../../lib/watched";

/**
 * "Prepárate para…" con niveles (ver prep.ts): la ruta curada si existe (`route`) o una
 * automática para cualquier título. El nivel va en la URL (?nivel=), para compartirlo.
 */
export function PrepView({ franchise, target, route, index }: { franchise: Franchise; target: Title; route?: Route; index: CatalogIndex }) {
  const { t, loc, name, date } = useLang();
  const isWatched = useIsWatched();
  const [params, setParams] = useSearchParams();
  const param = params.get("nivel");
  // Con ruta curada se empieza por lo mínimo (la selección); sin ella, por lo recomendado.
  const level: PrepLevel = isPrepLevel(param) ? param : route ? "minimum" : "recommended";
  const byLevel = useMemo(
    () => Object.fromEntries(PREP_LEVELS.map((l) => [l, prepUnits(franchise, target.id, l, index)])) as Record<PrepLevel, ReturnType<typeof prepUnits>>,
    [franchise, target.id, index],
  );
  const items = byLevel[level];
  const progress = routeProgress(items, isWatched);
  const ratio = progress.total ? progress.watched / progress.total : 0;
  const heading = route ? loc(route.name) : t("prep.title", { title: name(target) });
  const hint = t(`prep.hints.${level === "minimum" && !route ? "minimumAuto" : level}`);

  return (
    <div style={accentStyle(franchise.accentColor)}>
      <header className="-mx-4 border-b-2 border-line bg-accent px-4 pt-5 pb-8 text-on-accent">
        <Link to={`/f/${franchise.id}`} className="label inline-block border-b-2 border-current pb-0.5 font-bold">
          ← {loc(franchise.name)}
        </Link>
        <h1 className="display mt-6 text-[39px] [text-wrap:balance]">{heading}</h1>
        <p className="mt-3 max-w-[58ch] text-[15px] leading-[1.55]">
          {route ? loc(route.description) : t("prep.auto", { title: name(target) })}
        </p>
      </header>

      <Link to={`/t/${target.id}`} className="group mt-6 flex items-center gap-3 border-2 border-line bg-surface p-3">
        <Poster title={target} size="w92" className="h-[72px] w-12" />
        <div className="min-w-0">
          <p className="label text-muted">{t("routes.target")}</p>
          <p className="truncate font-semibold group-hover:underline group-hover:decoration-2 group-hover:underline-offset-4">{name(target)}</p>
          <p className="font-mono text-[11px] text-muted uppercase">{date(target.releaseDate)}</p>
        </div>
      </Link>

      <section className="mt-6">
        <Tabs
          label={t("prep.level")}
          layout="grid grid-cols-3"
          value={level}
          options={PREP_LEVELS.map((l) => ({ value: l, label: `${t(`prep.levels.${l}`)} · ${byLevel[l].length}` }))}
          onChange={(l) => setParams({ nivel: l }, { replace: true })}
        />
        <p className="mt-2 text-sm text-fg-soft">{hint}</p>
      </section>

      <section className="mt-6 border-2 border-line bg-surface p-4">
        <div className="flex items-end justify-between gap-4">
          <p className="display text-[39px] tabular-nums">
            {progress.watched}/{progress.total}
          </p>
          <p className="text-right font-mono text-[11px] leading-relaxed tracking-[0.06em] text-muted uppercase">
            {progress.watched === progress.total ? t("routes.done") : t("routes.remaining", { time: formatRuntime(progress.remainingMin, t) })}
          </p>
        </div>
        <div className="mt-3">
          <ProgressBar ratio={ratio} label={heading} />
        </div>
        {route && (
          <div className="mt-3">
            <ShareLinkButton target={{ kind: "route", franchiseId: franchise.id, refId: route.id }} title={heading} label={t("shareLink.route")} />
          </div>
        )}
        {progress.watched < progress.total && (
          <Link
            to={`/plans/new?f=${franchise.id}&type=prep&ref=${target.id}&level=${level}`}
            className="mt-4 inline-flex min-h-11 items-center border-2 border-tinta bg-faro px-5 py-2.5 text-[15px] font-bold text-tinta transition-colors duration-[120ms] ease-out hover:bg-tinta hover:text-faro"
          >
            {t("planner.planRoute")}
          </Link>
        )}
      </section>

      <section className="mt-8">
        <SectionLabel>{t("routes.before")}</SectionLabel>
        {items.length === 0 ? (
          <p className="py-8 text-center text-muted">{t("prep.empty")}</p>
        ) : (
          <ol>
            {items.map((item) => (
              <TitleRow key={item.key} item={item} />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
