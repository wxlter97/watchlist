import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { accentStyle, formatRuntime, ImportanceBadge, Notice, Poster, SectionLabel, Tabs } from "../../components/ui";
import { franchisesReferencing, useCatalog } from "../../lib/catalog";
import { Missing } from "../../components/Missing";
import { useLang } from "../../lib/i18n";
import { usePageMeta } from "../../lib/meta";
import { useOverview } from "../../lib/overviews";
import { curatedPrep, prepUnits } from "../../lib/prep";
import { isReleased } from "../../lib/progress";
import { setTitleStatus } from "../../lib/actions";
import { useProgressStore, type WatchStatus } from "../../lib/progressStore";
import { useSettings } from "../../lib/settings";
import { Episodes, ExternalLinks, Notes, RatingAndRewatch, VersionPicker, ViewingLog } from "./ProgressDetails";
import { AdSlot } from "../../components/AdSlot";
import { Cast } from "./Cast";
import { Recaps, WhyItMatters } from "./Recaps";
import { WhereToWatch } from "./WhereToWatch";

type DetailTab = "details" | "cast";
const STATUSES: WatchStatus[] = ["planned", "watching", "watched", "dropped"];

export function TitlePage() {
  const { titleId } = useParams();
  const navigate = useNavigate();
  const { t, lang, name, loc, date } = useLang();
  const { index, ready } = useCatalog(franchisesReferencing(titleId));
  const title = titleId ? index.titlesById.get(titleId) : undefined;
  const doc = useProgressStore((s) => (titleId ? s.progress[titleId] : undefined));
  const status = doc?.status;
  const spoilerFree = useSettings((s) => s.spoilerFree);
  const [revealed, setRevealed] = useState(false);
  const [tab, setTab] = useState<DetailTab>("details");
  const { overview, loading: overviewLoading } = useOverview(title, lang);
  usePageMeta(
    title && {
      title: t("meta.titleTitle", { name: name(title), year: title.releaseDate.slice(0, 4) }),
      description: t("meta.titleDescription", { name: name(title), year: title.releaseDate.slice(0, 4) }),
      canonical: `/t/${title.id}`,
    },
    t("meta.siteDescription"),
  );

  if (!ready) return <p className="py-16 text-center text-muted">…</p>;
  if (!title) return <Missing message={t("title.notFound")} />;

  const appearances = index.franchisesByTitle.get(title.id) ?? [];
  const inRoutes = index.routesByTitle.get(title.id) ?? [];
  // "Prepárate para…" en cada franquicia del título que tenga algo antes (curado o automático).
  const prep = [...new Map(appearances.map((a) => [a.franchise.id, a.franchise])).values()].flatMap((franchise) => {
    const route = curatedPrep(franchise, title.id);
    const all = prepUnits(franchise, title.id, "all", index).length;
    if (!route && all === 0) return [];
    return [{ franchise, href: route ? `/f/${franchise.id}/r/${route.id}` : `/f/${franchise.id}/prep/${title.id}` }];
  });
  const accent = appearances[0]?.franchise.accentColor ?? "#FFDB00";
  const released = isReleased(title);
  // Sin spoilers por defecto: la sinopsis de lo no visto queda oculta hasta revelarla.
  const showOverview = !spoilerFree || status === "watched" || revealed;
  const totalEpisodes = title.seasons?.reduce((n, s) => n + s.episodes, 0);
  const display = name(title);

  const meta = [
    released ? date(title.releaseDate) : t("title.upcoming", { date: date(title.releaseDate) }),
    t(`kind.${title.kind}`),
    title.seasons?.length && t("title.seasons", { count: title.seasons.length }),
    totalEpisodes && t("title.episodes", { count: totalEpisodes }),
    title.runtimeMin && formatRuntime(title.runtimeMin, t),
  ].filter(Boolean);

  return (
    <article style={accentStyle(accent)} className="pt-5">
      <button type="button" onClick={() => navigate(-1)} className="text-link uppercase">
        ← {t("nav.back")}
      </button>

      <header className="mt-6 flex gap-4">
        <Poster title={title} size="w342" className="aspect-[2/3] w-28 sm:w-40 lg:w-52" />
        <div className="min-w-0 self-end">
          <h1 className="display text-[31px] sm:text-[39px] lg:text-[56px]">{display}</h1>
          {display !== title.title && <p className="mt-2 text-sm text-muted">{title.title}</p>}
          <p className="mt-3 font-mono text-[11px] leading-relaxed tracking-[0.06em] text-muted uppercase">
            {meta.join(" · ")}
          </p>
        </div>
      </header>

      {prep.map(({ franchise, href }) => (
        <Link
          key={franchise.id}
          to={href}
          className="on-faro group mt-6 flex items-center justify-between gap-3 border-2 border-tinta bg-faro px-3.5 py-3 text-tinta"
        >
          <span>
            <span className="label block font-bold">
              {t("prep.link")}
              {prep.length > 1 && ` · ${loc(franchise.name)}`}
            </span>
            <span className="text-sm">{t("prep.linkHint")}</span>
          </span>
          <span aria-hidden className="font-mono text-lg">
            →
          </span>
        </Link>
      ))}

      <div className="mt-6">
        <Tabs
          label={t("title.sections")}
          value={tab}
          layout="grid grid-cols-2 sm:inline-grid sm:min-w-64"
          options={[
            { value: "details", label: t("title.tabDetails") },
            { value: "cast", label: t("title.tabCast") },
          ]}
          onChange={setTab}
        />
      </div>

      {tab === "cast" && <Cast key={title.id} title={title} />}

      {/* En desktop: lo del título a la izquierda y tu seguimiento en un panel fijo a la derecha. */}
      <div hidden={tab !== "details"} className="flex flex-col lg:mt-2 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)] lg:items-start lg:gap-12">
        <div className="contents lg:block lg:min-w-0">
<div className="order-2 lg:order-none">
      <section className="mt-8">
        <SectionLabel>{t("title.overview")}</SectionLabel>
        {overviewLoading ? (
          <p aria-busy="true" className="min-h-[1.55em] text-muted">…</p>
        ) : !overview ? (
          <p className="text-sm text-muted">{t("title.noOverview")}</p>
        ) : showOverview ? (
          <p className="max-w-[70ch] text-base leading-[1.55] text-fg-soft">{overview}</p>
        ) : (
          <Notice>
            <p className="leading-[1.5]">{t("title.spoilerHidden")}</p>
            <button type="button" onClick={() => setRevealed(true)} className="text-link mt-2 uppercase">
              {t("title.reveal")} →
            </button>
          </Notice>
        )}
      </section>

</div>
      <div className="order-2 lg:order-none"><WhyItMatters title={title} show={showOverview} /></div>
<div className="order-3 lg:order-none"><Recaps title={title} /></div>
      <div className="order-5 lg:order-none"><Episodes title={title} doc={doc} /></div>
<div className="order-11 lg:order-none">
      {appearances.length > 0 && (
        <section className="mt-8">
          <SectionLabel>{t("title.appearsIn")}</SectionLabel>
          <ul className="space-y-4">
            {appearances.map(({ franchise, entry }) => {
              const continuity = franchise.continuities.find((c) => c.id === entry.continuityId);
              return (
                <li key={`${franchise.id}#${entry.season ?? ""}`} style={accentStyle(franchise.accentColor)}>
                  <Link to={`/f/${franchise.id}`} className="group block border-2 border-line bg-surface">
                    <div className="label flex justify-between gap-2 border-b-2 border-line bg-accent px-3.5 py-2.5 font-bold text-on-accent">
                      <span>
                        {loc(franchise.name)}
                        {entry.season !== undefined && ` · ${t("episodes.season", { number: entry.season })}`}
                      </span>
                      <span aria-hidden>→</span>
                    </div>
                    <div className="space-y-2 p-3.5 text-sm">
                      {continuity && <p className="font-semibold">{loc(continuity.name)}</p>}
                      <ImportanceBadge importance={entry.importance} />
                      <dl className="space-y-1 font-mono text-[11px] tracking-[0.04em] text-muted">
                        {entry.chronoNote && (
                          <div>
                            <dt className="inline uppercase">{t("title.chrono")}: </dt>
                            <dd className="inline text-fg">{loc(entry.chronoNote)}</dd>
                          </div>
                        )}
                        {entry.postCredits && (
                          <div>
                            <dt className="inline uppercase">{t("title.postCredits")}: </dt>
                            <dd className="inline text-fg">
                              {entry.postCredits.mid + entry.postCredits.end
                                ? t("postCredits.detail", entry.postCredits)
                                : t("postCredits.none")}
                            </dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

</div>
<div className="order-12 lg:order-none">
      {inRoutes.length > 0 && (
        <section className="mt-8">
          <SectionLabel>{t("title.inRoutes")}</SectionLabel>
          <ul className="border-2 border-line bg-surface">
            {inRoutes.map(({ franchise, route }) => (
              <li key={`${franchise.id}/${route.id}`} className="border-b-2 border-line-soft last:border-b-0">
                <Link
                  to={`/f/${franchise.id}/r/${route.id}`}
                  className="flex items-center justify-between gap-3 px-3.5 py-3 transition-colors duration-[120ms] ease-out hover:bg-surface-muted"
                >
                  <span className="min-w-0">
                    <span className="label block text-muted">{t(`routes.kinds.${route.kind}`)}</span>
                    <span className="font-semibold">{loc(route.name)}</span>
                  </span>
                  <span aria-hidden className="font-mono">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

</div>
<div className="order-13 lg:order-none"><AdSlot slot={import.meta.env.VITE_ADS_SLOT_CONTENT ?? ""} /></div>
        </div>

        <aside className="contents lg:sticky lg:block lg:min-w-0 lg:top-[74px] lg:max-h-[calc(100dvh-90px)] lg:overflow-y-auto lg:pb-4">
<div className="order-1 lg:order-none">
      <section className="mt-8">
        <SectionLabel>{t("title.status")}</SectionLabel>
        {/* Tocar el estado activo lo quita. */}
        <Tabs
          label={t("title.status")}
          value={status}
          layout="grid grid-cols-2 sm:grid-cols-4"
          options={STATUSES.map((s) => ({ value: s, label: t(`status.${s}`), disabled: !released && s !== "planned" }))}
          onChange={(s) => setTitleStatus(title, s === status ? null : s)}
        />
      </section>

</div>
      <div className="order-4 lg:order-none"><VersionPicker title={title} doc={doc} /></div>
      <div className="order-6 lg:order-none">{released && <RatingAndRewatch title={title} doc={doc} />}</div>
      <div className="order-7 lg:order-none">{released && <ViewingLog title={title} doc={doc} />}</div>
      <div className="order-8 lg:order-none"><Notes title={title} doc={doc} /></div>
      <div className="order-9 lg:order-none">{released && <WhereToWatch title={title} />}</div>
      <div className="order-10 lg:order-none"><ExternalLinks title={title} /></div>
        </aside>
      </div>
    </article>
  );
}
