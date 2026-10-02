import { useMemo, type ReactNode } from "react";
import { Link } from "react-router";
import { accentStyle, Poster, ProgressBar, SearchIcon, SectionLabel, TitleMeta, WatchToggle } from "../../components/ui";
import { AdSlot } from "../../components/AdSlot";
import { FollowButton } from "../../components/FollowButton";
import { useFranchiseView } from "../../hooks/useFranchiseView";
import { franchiseMetaById, franchiseMetas, useCatalog, useCatalogForTitles, useCatalogStore, withReferences, type FranchiseMeta } from "../../lib/catalog";
import { effectiveHidden } from "../../lib/filters";
import { useLang } from "../../lib/i18n";
import { summarizeEntries, todayIso } from "../../lib/progress";
import { setTitleStatus, setUnitWatched } from "../../lib/actions";
import { effectiveEpisodes, totalEpisodes, watchedEpisodes } from "../../lib/episodes";
import { nextUp } from "../../lib/orders";
import { useProgressStore, type ProgressDoc } from "../../lib/progressStore";
import { useIsDropped, useIsWatched, useManifestIsWatched } from "../../lib/watched";
import { routeUnits } from "../../lib/prep";
import { routeProgress } from "../../lib/routes";
import { useSettings } from "../../lib/settings";
import type { Franchise, Title } from "../../lib/types";

type FranchiseLabel = Pick<Franchise, "id" | "name" | "accentColor">;
import { upcomingUrl, useRemote, type UpcomingApiItem } from "../../lib/api";
import { upcomingReleases } from "../../lib/upcoming";
import { isWrappedSeason } from "../../lib/wrapped";

export function HubPage() {
  const { t, loc } = useLang();
  const followedIds = useSettings((s) => s.followedFranchises);
  const followedRoutes = useSettings((s) => s.followedRoutes);
  const progress = useProgressStore((s) => s.progress);

  // Todo lo del Hub sale del manifiesto: solo "continuar viendo" carga sus franquicias.
  const titlesById = useCatalogStore((s) => s.index.titlesById);
  const byName = (a: FranchiseMeta, b: FranchiseMeta) => loc(a.name).localeCompare(loc(b.name));
  const followed = franchiseMetas.filter((f) => followedIds.includes(f.id)).sort(byName);
  const others = franchiseMetas.filter((f) => !followedIds.includes(f.id)).sort(byName);
  // Sin franquicias seguidas, "continuar viendo" usa las que ya tienen algo visto.
  const continuing = followed.length
    ? followed
    : franchiseMetas.filter((f) => f.titles.some((e) => progress[e.titleId]?.status === "watched")).sort(byName);
  const upcomingIds = (followed.length ? followed : franchiseMetas).map((f) => f.id);
  const remote = useRemote<{ items: UpcomingApiItem[] }>(upcomingUrl(upcomingIds));
  // La API suma temporadas nuevas de series en curso; sin conexión, se usa el catálogo. Los
  // títulos próximos y en emisión vienen en el manifiesto.
  const upcoming: UpcomingRowData[] = (
    remote.state === "ok"
      ? remote.data.items.flatMap((i) => {
          const title = titlesById.get(i.titleId);
          const franchise = franchiseMetaById.get(i.franchiseId);
          return title && franchise ? [{ title, franchise, date: i.date, season: i.kind === "release" ? undefined : i.season, episode: i.kind === "episode" ? i.episode : undefined }] : [];
        })
      : upcomingReleases(franchiseMetaById, titlesById, upcomingIds, todayIso()).map((u) => ({ ...u, date: u.title.releaseDate }))
  ).slice(0, 8);

  return (
    <div>
      <section className="on-faro -mx-4 border-b-2 border-line bg-faro px-4 pt-8 pb-10 text-tinta lg:pt-14 lg:pb-16">
        <p className="label font-bold">{t("hub.eyebrow")}</p>
        <h1 className="display mt-4 max-w-[15ch] text-[39px] [text-wrap:balance] sm:text-[49px] lg:max-w-[20ch] lg:text-[72px]">{t("app.tagline")}</h1>
        <Link
          to="/search"
          className="mt-6 flex min-h-12 max-w-md items-center lg:mt-10 lg:min-h-14 lg:max-w-xl gap-3 border-2 border-tinta bg-white px-3 font-mono text-sm text-tinta/60 transition-colors duration-[120ms] ease-out hover:text-tinta"
        >
          <SearchIcon />
          {t("search.placeholder")}
        </Link>
      </section>

      {isWrappedSeason(todayIso()) && Object.values(progress).some((d) => d.status === "watched") && (
        <Link
          to="/wrapped"
          className="group mt-6 flex items-center justify-between gap-4 border-2 border-line bg-tinta px-4 py-4 text-[#EDEDE7] transition-colors duration-[120ms] ease-out hover:bg-faro hover:text-tinta"
        >
          <span>
            <span className="label block font-bold text-faro group-hover:text-tinta">{t("wrapped.eyebrow")}</span>
            <span className="display mt-1 block text-[25px]">{t("wrapped.intro", { year: todayIso().slice(0, 4) })}</span>
          </span>
          <span aria-hidden className="display text-[31px]">→</span>
        </Link>
      )}

      {continuing.length > 0 && (
        <Section label={t("hub.continue")}>
          <div className="grid gap-4 lg:grid-cols-2">
            {continuing.map((f) => (
              <ContinueCard key={f.id} franchise={f} />
            ))}
          </div>
        </Section>
      )}

      <StatusSections />

      {followedRoutes.length > 0 && (
        <Section label={t("hub.routes")}>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {followedRoutes.map((path) => (
              <li key={path}>
                <FollowedRouteCard path={path} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {followed.length > 0 && (
        <Section label={t("hub.following")}>
          <FranchiseGrid franchises={followed} />
        </Section>
      )}

      {upcoming.length > 0 && (
        <Section label={t("hub.upcoming")}>
          <ul className="border-2 border-line bg-surface">
            {upcoming.map((u) => (
              <UpcomingRow key={`${u.title.id}-${u.date}`} item={u} />
            ))}
          </ul>
        </Section>
      )}

      <Section label={followed.length ? t("hub.explore") : t("hub.franchises")}>
        {!followed.length && <p className="mb-4 max-w-[58ch] text-sm leading-[1.55] text-fg-soft">{t("hub.followHint")}</p>}
        <FranchiseGrid franchises={others} />
      </Section>

      <AdSlot slot={import.meta.env.VITE_ADS_SLOT_HUB ?? ""} />

      <Section label={t("hub.tools")}>
        <ul className="grid gap-[2px] border-2 border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {[
            { to: "/plans", title: t("planner.title"), body: t("hub.plannerBody") },
            { to: "/map", title: t("graph.title"), body: t("hub.mapBody") },
            { to: "/achievements", title: t("achievements.title"), body: t("hub.achievementsBody") },
            { to: "/groups", title: t("groups.title"), body: t("hub.groupsBody") },
            { to: "/compare", title: t("compare.title"), body: t("hub.compareBody") },
            { to: "/wrapped", title: t("wrapped.title"), body: t("hub.wrappedBody") },
          ].map((tool) => (
            <li key={tool.to}>
              <Link to={tool.to} className="group block h-full bg-surface p-4 transition-colors duration-[120ms] ease-out hover:bg-fg hover:text-bg">
                <p className="display text-[22px]">{tool.title} →</p>
                <p className="mt-1.5 text-sm leading-[1.5] text-fg-soft group-hover:text-bg">{tool.body}</p>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <SectionLabel>{label}</SectionLabel>
      {children}
    </section>
  );
}

function FranchiseGrid({ franchises }: { franchises: FranchiseMeta[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {franchises.map((f) => (
        <li key={f.id}>
          <FranchiseCard franchise={f} />
        </li>
      ))}
    </ul>
  );
}

function CardHeader({ children }: { children: ReactNode }) {
  return (
    <div className="label flex min-h-10 items-center justify-between gap-2 border-b-2 border-line bg-accent px-3.5 py-2 font-bold text-on-accent">
      {children}
    </div>
  );
}

function ContinueCard({ franchise }: { franchise: FranchiseMeta }) {
  const { t, loc, name, unitName } = useLang();
  const view = useFranchiseView(franchise.id);
  const isDropped = useIsDropped();

  // "Continuar viendo" sigue la última ruta que se abrió en la franquicia (con el nivel elegido);
  // si no hay, o ya se completó, el orden activo.
  const route = useMemo(
    () => (view.franchise && view.state?.activeRoute ? routeUnits(view.state.activeRoute, view.franchise, view.index, view.state) : undefined),
    [view.franchise, view.index, view.state],
  );
  const today = todayIso();
  const routeNext = route && nextUp(route.items.filter((i) => i.releaseDate <= today), view.isWatched, isDropped);
  const routeDone = route && !routeNext && route.items.length > 0 && route.items.every((i) => view.isWatched(i.title.id, i.season));
  const next = routeNext ?? view.next;

  let context: string | undefined;
  if (view.ready && view.order) {
    const heading = route && (route.route ? loc(route.route.name) : route.target ? t("prep.title", { title: name(route.target) }) : undefined);
    context = routeNext
      ? [heading, route.level && t(`prep.levels.${route.level}`)].filter(Boolean).join(" · ")
      : routeDone
        ? t("hub.routeDone")
        : t("hub.inOrder", { name: view.order.type === "custom" ? t("customOrder.name") : loc(view.order.name) });
  }

  return (
    <div style={accentStyle(franchise.accentColor)} className="border-2 border-line bg-surface">
      <CardHeader>
        <Link to={`/f/${franchise.id}`} className="hover:underline hover:decoration-2 hover:underline-offset-4">
          {loc(franchise.name)}
        </Link>
      </CardHeader>
      {!view.ready ? (
        <div aria-busy="true" className="h-[120px]" />
      ) : next ? (
        <div>
          {context && (
            <p className="truncate border-b-2 border-line-soft px-3 py-2 font-mono text-[11px] tracking-[0.06em] text-muted uppercase">
              {routeNext && view.state?.activeRoute ? (
                <Link to={view.state.activeRoute} className="hover:text-fg hover:underline">
                  {context}
                </Link>
              ) : (
                context
              )}
            </p>
          )}
          <div className="flex items-center gap-3 p-3">
            <Link to={`/t/${next.title.id}`} className="group flex min-w-0 flex-1 items-center gap-3">
              <Poster title={next.title} size="w154" className="h-24 w-16" />
              <div className="min-w-0">
                <p className="label text-muted">{t("hub.upNext")}</p>
                <p className="mt-1 truncate font-semibold group-hover:underline group-hover:decoration-2 group-hover:underline-offset-4">
                  {unitName(next.title, next.season)}
                </p>
                <TitleMeta title={next.title} season={next.season} />
              </div>
            </Link>
            <WatchToggle
              watched={false}
              label={t("actions.markWatched", { title: unitName(next.title, next.season) })}
              onToggle={() => setUnitWatched(next.title, next.season, true)}
            />
          </div>
        </div>
      ) : (
        <p className="p-4 text-sm text-fg-soft">{t("hub.allCaughtUp")}</p>
      )}
    </div>
  );
}

/**
 * Lo que está empezado y lo que se dejó a medias. "Viendo ahora" es lo que el perfil marcó
 * como "viendo" (o una serie con episodios vistos); "Abandonadas" se retoman con un toque.
 */
function StatusSections() {
  const { t } = useLang();
  const progress = useProgressStore((s) => s.progress);
  const byRecent = ([, a]: [string, ProgressDoc], [, b]: [string, ProgressDoc]) => (b.startedAt ?? b.updatedAt).localeCompare(a.startedAt ?? a.updatedAt);
  const watching = Object.entries(progress).filter(([, d]) => d.status === "watching").sort(byRecent);
  const dropped = Object.entries(progress).filter(([, d]) => d.status === "dropped").sort(byRecent);
  const { index } = useCatalogForTitles([...watching, ...dropped].map(([id]) => id));
  const rows = (list: [string, ProgressDoc][]) => list.flatMap(([id, doc]) => (index.titlesById.get(id) ? [{ title: index.titlesById.get(id)!, doc }] : []));
  const watchingRows = rows(watching);
  const droppedRows = rows(dropped);

  return (
    <>
      {watchingRows.length > 0 && (
        <Section label={t("hub.watching")}>
          <ul className="border-2 border-line bg-surface">
            {watchingRows.map(({ title, doc }) => (
              <StatusRow key={title.id} title={title} doc={doc} />
            ))}
          </ul>
        </Section>
      )}
      {droppedRows.length > 0 && (
        <Section label={t("hub.dropped")}>
          <p className="mb-3 text-sm text-fg-soft">{t("hub.droppedHint")}</p>
          <ul className="border-2 border-line bg-surface">
            {droppedRows.map(({ title, doc }) => (
              <StatusRow key={title.id} title={title} doc={doc} />
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}

function StatusRow({ title, doc }: { title: Title; doc: ProgressDoc }) {
  const { t, unitName, date } = useLang();
  const dropped = doc.status === "dropped";
  const total = totalEpisodes(title);
  const seen = watchedEpisodes(effectiveEpisodes(title, doc));
  const since = dropped ? t("hub.droppedOn", { date: date(doc.updatedAt) }) : t("hub.started", { date: date(doc.startedAt ?? doc.updatedAt) });
  const name = unitName(title);

  return (
    <li className="border-b-2 border-line-soft last:border-b-0">
      <div className="flex items-center gap-3 p-3">
        <Link to={`/t/${title.id}`} className="group flex min-w-0 flex-1 items-center gap-3">
          <Poster title={title} size="w92" className="h-[60px] w-10" />
          <div className="min-w-0">
            <p className="truncate font-semibold group-hover:underline group-hover:decoration-2 group-hover:underline-offset-4">{name}</p>
            <p className="font-mono text-[11px] tracking-[0.04em] text-muted uppercase">
              {[total > 0 && t("episodes.progress", { seen, total }), since].filter(Boolean).join(" · ")}
            </p>
          </div>
        </Link>
        {dropped ? (
          <button
            type="button"
            onClick={() => setTitleStatus(title, "watching")}
            className="min-h-11 shrink-0 border-2 border-tinta bg-faro px-3 font-mono text-xs font-bold text-tinta uppercase transition-colors duration-[120ms] ease-out hover:bg-tinta hover:text-faro"
          >
            {t("hub.resume")}
          </button>
        ) : (
          <WatchToggle watched={false} label={t("actions.markWatched", { title: name })} onToggle={() => setTitleStatus(title, "watched")} />
        )}
      </div>
    </li>
  );
}

interface UpcomingRowData {
  title: Title;
  franchise: FranchiseLabel;
  date: string;
  season?: number;
  episode?: number;
}

function UpcomingRow({ item }: { item: UpcomingRowData }) {
  const { t, name, loc, date } = useLang();
  const { title, franchise } = item;
  const detail =
    item.episode !== undefined
      ? t("upcoming.episode", { season: item.season, episode: item.episode })
      : item.season !== undefined
        ? t("upcoming.season", { season: item.season })
        : null;
  return (
    <li className="border-b-2 border-line-soft last:border-b-0" style={accentStyle(franchise.accentColor)}>
      <Link to={`/t/${title.id}`} className="group flex items-center gap-3 p-3 transition-colors duration-[120ms] ease-out hover:bg-surface-muted">
        <Poster title={title} size="w92" className="h-[60px] w-10" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold group-hover:underline group-hover:decoration-2 group-hover:underline-offset-4">{name(title)}</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="label inline-block bg-accent px-1.5 py-0.5 text-[10px] font-bold text-on-accent">{loc(franchise.name)}</span>
            {detail && <span className="font-mono text-[11px] text-muted">{detail}</span>}
          </div>
        </div>
        <span className="shrink-0 text-right font-mono text-[11px] font-bold uppercase">{date(item.date)}</span>
      </Link>
    </li>
  );
}

function FranchiseCard({ franchise }: { franchise: FranchiseMeta }) {
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

/** Una ruta seguida: `/f/{franquicia}/r/{ruta}` o la automática `/f/{franquicia}/prep/{título}`. */
function FollowedRouteCard({ path }: { path: string }) {
  const { t, loc, name, unitName } = useLang();
  const isWatched = useIsWatched();
  const isDropped = useIsDropped();
  const [, , franchiseId] = path.split("/");
  const { index, ready } = useCatalog(withReferences(franchiseId));
  const state = useProgressStore((s) => (franchiseId ? s.franchiseState[franchiseId] : undefined));
  const franchise = franchiseId ? index.franchisesById.get(franchiseId) : undefined;
  if (!franchise || !ready) return <div aria-busy="true" className="h-[120px] border-2 border-line bg-surface" />;

  // Con el nivel que se eligió en esa ruta (no siempre "recomendado").
  const units = routeUnits(path, franchise, index, state);
  if (!units) return null;
  const progress = routeProgress(units.items, isWatched);
  const heading = units.route ? loc(units.route.name) : t("prep.title", { title: name(units.target!) });
  const next = nextUp(units.items.filter((i) => i.releaseDate <= todayIso()), isWatched, isDropped);

  return (
    <div style={accentStyle(franchise.accentColor)} className="flex h-full flex-col border-2 border-line bg-surface">
      <CardHeader>
        <span className="truncate">{loc(franchise.name)}</span>
        <FollowButton route={path} compact />
      </CardHeader>
      <Link to={path} className="group flex flex-1 flex-col gap-3 p-4">
        <h3 className="display text-[22px] group-hover:underline group-hover:decoration-2 group-hover:underline-offset-4">{heading}</h3>
        {units.level && <p className="label -mt-1.5 text-muted">{t(`prep.levels.${units.level}`)}</p>}
        {next && (
          <p className="truncate text-sm">
            <span className="label mr-1.5 text-muted">{t("hub.upNext")}</span>
            <span className="font-semibold">{unitName(next.title, next.season)}</span>
          </p>
        )}
        <div className="mt-auto flex items-end justify-between">
          <span className="font-mono text-[11px] tracking-[0.06em] text-muted uppercase">
            {progress.watched === progress.total ? t("routes.done") : t("progress.count", { watched: progress.watched, total: progress.total })}
          </span>
        </div>
        <ProgressBar ratio={progress.total ? progress.watched / progress.total : 0} label={heading} />
      </Link>
    </div>
  );
}
