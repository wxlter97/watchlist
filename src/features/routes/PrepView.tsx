import { useMemo } from "react";
import { Link, useSearchParams } from "react-router";
import { JumpToNext } from "../../components/JumpToNext";
import { useRememberRoute } from "../../hooks/useActiveRoute";
import { nextUp } from "../../lib/orders";
import { useProgressStore } from "../../lib/progressStore";
import { todayIso } from "../../lib/progress";
import { rowId, useScrollToNext } from "../../lib/scroll";
import { FollowButton } from "../../components/FollowButton";
import { ShareLinkButton } from "../../components/ShareLinkButton";
import { TitleRow } from "../../components/TitleRow";
import { accentStyle, formatRuntime, Poster, ProgressBar, SectionLabel, Tabs } from "../../components/ui";
import type { CatalogIndex } from "../../lib/catalogIndex";
import { useLang } from "../../lib/i18n";
import { isPrepLevel, PREP_LEVELS, prepLevelFor, prepUnits, type PrepLevel } from "../../lib/prep";
import { routeProgress } from "../../lib/routes";
import type { Franchise, Route, Title } from "../../lib/types";
import { useIsDropped, useIsWatched } from "../../lib/watched";

/**
 * "Prepárate para…" con niveles (ver prep.ts): la ruta curada si existe (`route`) o una
 * automática para cualquier título. El nivel va en la URL (?nivel=), para compartirlo.
 */
export function PrepView({ franchise, target, route, index }: { franchise: Franchise; target: Title; route?: Route; index: CatalogIndex }) {
  const { t, loc, name, date } = useLang();
  const isWatched = useIsWatched();
  const isDropped = useIsDropped();
  const [params, setParams] = useSearchParams();
  const state = useProgressStore((s) => s.franchiseState[franchise.id]);
  const setFranchiseState = useProgressStore((s) => s.setFranchiseState);
  const param = params.get("nivel");
  // El nivel de la URL (un link compartido) manda; si no, el que se eligió la última vez en este
  // "Prepárate para…"; si no, lo mínimo (con ruta curada) o lo recomendado.
  const level: PrepLevel = isPrepLevel(param) ? param : prepLevelFor(state, target.id, Boolean(route));
  const path = route ? `/f/${franchise.id}/r/${route.id}` : `/f/${franchise.id}/prep/${target.id}`;
  useRememberRoute(franchise.id, path);
  const chooseLevel = (l: PrepLevel) => {
    setParams({ nivel: l }, { replace: true });
    if (state?.prepLevels?.[target.id] !== l) setFranchiseState(franchise.id, { prepLevels: { ...state?.prepLevels, [target.id]: l } });
  };
  const byLevel = useMemo(
    () => Object.fromEntries(PREP_LEVELS.map((l) => [l, prepUnits(franchise, target.id, l, index)])) as Record<PrepLevel, ReturnType<typeof prepUnits>>,
    [franchise, target.id, index],
  );
  const items = byLevel[level];
  const progress = routeProgress(items, isWatched);
  const next = nextUp(items.filter((i) => i.releaseDate <= todayIso()), isWatched, isDropped);
  useScrollToNext(true, next && rowId(next.key), progress.watched > 0 && next?.key !== items[0]?.key);
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

      {/* En desktop: datos y progreso fijos a la izquierda, la lista a la derecha. */}
      <div className="lg:mt-6 lg:grid lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:items-start lg:gap-10">
        <aside className="lg:sticky lg:top-[74px] lg:max-h-[calc(100dvh-90px)] lg:overflow-y-auto lg:pb-4">

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
          layout="grid grid-cols-3 [&>button]:min-w-0 [&>button]:px-1.5 [&>button]:leading-tight [&>button]:whitespace-normal"
          value={level}
          options={PREP_LEVELS.map((l) => ({ value: l, label: `${t(`prep.levels.${l}`)} · ${byLevel[l].length}` }))}
          onChange={chooseLevel}
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
        <div className="mt-3 flex flex-wrap gap-2">
          <FollowButton route={route ? `/f/${franchise.id}/r/${route.id}` : `/f/${franchise.id}/prep/${target.id}`} />
          {route && <ShareLinkButton target={{ kind: "route", franchiseId: franchise.id, refId: route.id }} title={heading} label={t("shareLink.route")} />}
        </div>
        {progress.watched > 0 && <JumpToNext next={next} />}
        {progress.watched < progress.total && (
          <Link
            to={`/plans/new?f=${franchise.id}&type=prep&ref=${target.id}&level=${level}`}
            className="mt-4 inline-flex min-h-11 items-center border-2 border-tinta bg-faro px-5 py-2.5 text-[15px] font-bold text-tinta transition-colors duration-[120ms] ease-out hover:bg-tinta hover:text-faro"
          >
            {t("planner.planRoute")}
          </Link>
        )}
      </section>

        </aside>

        <div className="min-w-0">
      <section className="mt-8">
        <SectionLabel>{t("routes.before")}</SectionLabel>
        {items.length === 0 ? (
          <p className="py-8 text-center text-muted">{t("prep.empty")}</p>
        ) : (
          <ol>
            {items.map((item) => (
              <TitleRow key={item.key} item={item} isNext={item.key === next?.key} />
            ))}
          </ol>
        )}
      </section>
        </div>
      </div>
    </div>
  );
}
