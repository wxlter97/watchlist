import { useMemo } from "react";
import { Link, useParams } from "react-router";
import { FollowButton } from "../../components/FollowButton";
import { ShareLinkButton } from "../../components/ShareLinkButton";
import { JumpToNext } from "../../components/JumpToNext";
import { TitleRow } from "../../components/TitleRow";
import { useRememberRoute } from "../../hooks/useActiveRoute";
import { accentStyle, formatRuntime, Poster, ProgressBar, SectionLabel } from "../../components/ui";
import { useCatalog, withReferences } from "../../lib/catalog";
import { useLang } from "../../lib/i18n";
import { useIsDropped, useIsWatched } from "../../lib/watched";
import { nextUp } from "../../lib/orders";
import { todayIso } from "../../lib/progress";
import { rowId, useScrollToNext } from "../../lib/scroll";
import { resolveRoute, routeProgress } from "../../lib/routes";
import { PrepView } from "./PrepView";

export function RoutePage() {
  const { franchiseId, routeId } = useParams();
  const { t, loc, name, date } = useLang();
  const isWatched = useIsWatched();
  const isDropped = useIsDropped();
  const { index, ready } = useCatalog(withReferences(franchiseId));
  const franchise = franchiseId ? index.franchisesById.get(franchiseId) : undefined;
  const route = franchise?.routes.find((r) => r.id === routeId);
  const items = useMemo(() => (franchise && route ? resolveRoute(route, franchise, index) : []), [franchise, route, index]);
  const next = nextUp(items.filter((i) => i.releaseDate <= todayIso()), isWatched, isDropped);
  // Un "Prepárate para…" lo resuelve PrepView (con sus niveles): ahí se recuerda y se hace scroll.
  const isPrep = route?.kind === "prep" && Boolean(route.targetTitleId && index.titlesById.has(route.targetTitleId));
  useRememberRoute(franchise && route && !isPrep ? franchise.id : undefined, `/f/${franchiseId}/r/${routeId}`);
  useScrollToNext(
    ready && !isPrep,
    next && rowId(next.key),
    items.length > 0 && next?.key !== items[0]?.key && items.some((i) => isWatched(i.title.id, i.season)),
  );

  if (!ready) return <p className="py-16 text-center text-muted">…</p>;
  if (!franchise || !route) return <p className="py-16 text-center text-muted">{t("routes.notFound")}</p>;

  // "Prepárate para…": con niveles (lo mínimo es esta ruta).
  const prepTarget = route.kind === "prep" && route.targetTitleId ? index.titlesById.get(route.targetTitleId) : undefined;
  if (prepTarget) return <PrepView franchise={franchise} target={prepTarget} route={route} index={index} />;

  const progress = routeProgress(items, isWatched);
  const target = route.targetTitleId ? index.titlesById.get(route.targetTitleId) : undefined;
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
        <div className="mt-3 flex flex-wrap gap-2">
          <FollowButton route={`/f/${franchise.id}/r/${route.id}`} />
          <ShareLinkButton
            target={{ kind: "route", franchiseId: franchise.id, refId: route.id }}
            title={loc(route.name)}
            label={t("shareLink.route")}
          />
        </div>
        {progress.watched > 0 && <JumpToNext next={next} />}
        {progress.watched < progress.total && (
          <Link
            to={`/plans/new?f=${franchise.id}&type=route&ref=${route.id}`}
            className="mt-4 inline-flex min-h-11 items-center border-2 border-tinta bg-faro px-5 py-2.5 text-[15px] font-bold text-tinta transition-colors duration-[120ms] ease-out hover:bg-tinta hover:text-faro"
          >
            {t("planner.planRoute")}
          </Link>
        )}
      </section>

      <section className="mt-8">
        <SectionLabel>{target ? t("routes.before") : t("routes.titles")}</SectionLabel>
        <ol>
          {items.map((item) => (
            <TitleRow key={item.key} item={item} isNext={item.key === next?.key} />
          ))}
        </ol>
      </section>
    </div>
  );
}
