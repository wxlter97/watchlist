import type { ReactNode } from "react";
import { Link } from "react-router";
import { accentStyle, Poster, ProgressBar, SearchIcon, SectionLabel, TitleMeta, WatchToggle } from "../../components/ui";
import { FollowButton } from "../../components/FollowButton";
import { useFranchiseView } from "../../hooks/useFranchiseView";
import { catalog, catalogIndex } from "../../lib/catalog";
import { useLang } from "../../lib/i18n";
import { todayIso } from "../../lib/progress";
import { setTitleStatus } from "../../lib/actions";
import { useProgressStore } from "../../lib/progressStore";
import { useSettings } from "../../lib/settings";
import type { Franchise, Title } from "../../lib/types";
import { upcomingUrl, useRemote, type UpcomingApiItem } from "../../lib/api";
import { upcomingReleases } from "../../lib/upcoming";
import { isWrappedSeason } from "../../lib/wrapped";

export function HubPage() {
  const { t, loc } = useLang();
  const followedIds = useSettings((s) => s.followedFranchises);
  const progress = useProgressStore((s) => s.progress);

  const byName = (a: Franchise, b: Franchise) => loc(a.name).localeCompare(loc(b.name));
  const followed = catalog.franchises.filter((f) => followedIds.includes(f.id)).sort(byName);
  const others = catalog.franchises.filter((f) => !followedIds.includes(f.id)).sort(byName);
  // Sin franquicias seguidas, "continuar viendo" usa las que ya tienen algo visto.
  const continuing = followed.length
    ? followed
    : catalog.franchises.filter((f) => f.entries.some((e) => progress[e.titleId]?.status === "watched")).sort(byName);
  const upcomingIds = (followed.length ? followed : catalog.franchises).map((f) => f.id);
  const remote = useRemote<{ items: UpcomingApiItem[] }>(upcomingUrl(upcomingIds));
  // La API suma temporadas nuevas de series en curso; sin conexión, se usa el catálogo.
  const upcoming: UpcomingRowData[] = (
    remote.state === "ok"
      ? remote.data.items.flatMap((i) => {
          const title = catalogIndex.titlesById.get(i.titleId);
          const franchise = catalogIndex.franchisesById.get(i.franchiseId);
          return title && franchise ? [{ title, franchise, date: i.date, season: i.kind === "release" ? undefined : i.season, episode: i.kind === "episode" ? i.episode : undefined }] : [];
        })
      : upcomingReleases(catalogIndex, upcomingIds, todayIso()).map((u) => ({ ...u, date: u.title.releaseDate }))
  ).slice(0, 8);

  return (
    <div>
      <section className="on-faro -mx-4 border-b-2 border-line bg-faro px-4 pt-8 pb-10 text-tinta">
        <p className="label font-bold">{t("hub.eyebrow")}</p>
        <h1 className="display mt-4 max-w-[15ch] text-[39px] [text-wrap:balance] sm:text-[49px]">{t("app.tagline")}</h1>
        <Link
          to="/search"
          className="mt-6 flex min-h-12 max-w-md items-center gap-3 border-2 border-tinta bg-white px-3 font-mono text-sm text-tinta/60 transition-colors duration-[120ms] ease-out hover:text-tinta"
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
          <div className="space-y-4">
            {continuing.map((f) => (
              <ContinueCard key={f.id} franchise={f} />
            ))}
          </div>
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

      {followed.length > 0 && (
        <Section label={t("hub.following")}>
          <FranchiseGrid franchises={followed} />
        </Section>
      )}

      <Section label={followed.length ? t("hub.explore") : t("hub.franchises")}>
        {!followed.length && <p className="mb-4 max-w-[58ch] text-sm leading-[1.55] text-fg-soft">{t("hub.followHint")}</p>}
        <FranchiseGrid franchises={others} />
      </Section>

      <Section label={t("hub.tools")}>
        <ul className="grid gap-[2px] border-2 border-line bg-line sm:grid-cols-2">
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

function FranchiseGrid({ franchises }: { franchises: Franchise[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
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

function ContinueCard({ franchise }: { franchise: Franchise }) {
  const { t, loc, name } = useLang();
  const { next } = useFranchiseView(franchise.id);

  return (
    <div style={accentStyle(franchise.accentColor)} className="border-2 border-line bg-surface">
      <CardHeader>
        <Link to={`/f/${franchise.id}`} className="hover:underline hover:decoration-2 hover:underline-offset-4">
          {loc(franchise.name)}
        </Link>
      </CardHeader>
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
            onToggle={() => setTitleStatus(next.title, "watched")}
          />
        </div>
      ) : (
        <p className="p-4 text-sm text-fg-soft">{t("hub.allCaughtUp")}</p>
      )}
    </div>
  );
}

interface UpcomingRowData {
  title: Title;
  franchise: Franchise;
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

function FranchiseCard({ franchise }: { franchise: Franchise }) {
  const { t, loc } = useLang();
  const { summary } = useFranchiseView(franchise.id);

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
