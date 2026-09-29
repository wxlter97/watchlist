import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { accentStyle, formatRuntime, ImportanceBadge, Notice, Poster, SectionLabel, Tabs } from "../../components/ui";
import { catalogIndex } from "../../lib/catalog";
import { titleOverview, useLang } from "../../lib/i18n";
import { isReleased } from "../../lib/progress";
import { useProgressStore, type WatchStatus } from "../../lib/progressStore";

const STATUSES: WatchStatus[] = ["planned", "watching", "watched", "dropped"];

export function TitlePage() {
  const { titleId } = useParams();
  const navigate = useNavigate();
  const { t, lang, name, loc, date } = useLang();
  const title = titleId ? catalogIndex.titlesById.get(titleId) : undefined;
  const status = useProgressStore((s) => (titleId ? s.progress[titleId]?.status : undefined));
  const setStatus = useProgressStore((s) => s.setStatus);
  const [revealed, setRevealed] = useState(false);

  if (!title) return <p className="py-16 text-center text-muted">{t("title.notFound")}</p>;

  const appearances = catalogIndex.franchisesByTitle.get(title.id) ?? [];
  const accent = appearances[0]?.franchise.accentColor ?? "#FFDB00";
  const released = isReleased(title);
  const overview = titleOverview(title, lang);
  // Sin spoilers por defecto: la sinopsis de lo no visto queda oculta hasta revelarla.
  const showOverview = status === "watched" || revealed;
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
        <Poster title={title} size="w342" className="aspect-[2/3] w-28 sm:w-40" />
        <div className="min-w-0 self-end">
          <h1 className="display text-[31px] sm:text-[39px]">{display}</h1>
          {display !== title.title && <p className="mt-2 text-sm text-muted">{title.title}</p>}
          <p className="mt-3 font-mono text-[11px] leading-relaxed tracking-[0.06em] text-muted uppercase">
            {meta.join(" · ")}
          </p>
        </div>
      </header>

      <section className="mt-8">
        <SectionLabel>{t("title.status")}</SectionLabel>
        {/* Tocar el estado activo lo quita. */}
        <Tabs
          label={t("title.status")}
          value={status}
          layout="grid grid-cols-2 sm:grid-cols-4"
          options={STATUSES.map((s) => ({ value: s, label: t(`status.${s}`), disabled: !released && s !== "planned" }))}
          onChange={(s) => setStatus(title.id, s === status ? null : s)}
        />
      </section>

      <section className="mt-8">
        <SectionLabel>{t("title.overview")}</SectionLabel>
        {!overview ? (
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

      {appearances.length > 0 && (
        <section className="mt-8">
          <SectionLabel>{t("title.appearsIn")}</SectionLabel>
          <ul className="space-y-4">
            {appearances.map(({ franchise, entry }) => {
              const continuity = franchise.continuities.find((c) => c.id === entry.continuityId);
              return (
                <li key={franchise.id} style={accentStyle(franchise.accentColor)}>
                  <Link to={`/f/${franchise.id}`} className="group block border-2 border-line bg-surface">
                    <div className="label flex justify-between gap-2 border-b-2 border-line bg-accent px-3.5 py-2.5 font-bold text-on-accent">
                      <span>{loc(franchise.name)}</span>
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
    </article>
  );
}
