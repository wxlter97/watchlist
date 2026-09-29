import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { accentStyle, formatRuntime, ImportanceBadge, Poster } from "../../components/ui";
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
  const accent = appearances[0]?.franchise.accentColor ?? "#8b8bff";
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
    <article style={accentStyle(accent)} className="pt-2">
      <button type="button" onClick={() => navigate(-1)} className="text-sm text-muted hover:text-ink">
        ← {t("nav.back")}
      </button>

      <header className="mt-4 flex gap-4">
        <Poster title={title} size="w342" className="aspect-[2/3] w-28 sm:w-40" />
        <div className="min-w-0 self-end">
          <h1 className="text-2xl font-bold leading-tight tracking-tight">{display}</h1>
          {display !== title.title && <p className="mt-0.5 text-sm text-faint">{title.title}</p>}
          <p className="mt-2 text-sm text-muted">{meta.join(" · ")}</p>
        </div>
      </header>

      <section className="mt-6" aria-labelledby="status-label">
        <h2 id="status-label" className="mb-2 text-xs font-semibold tracking-wide text-faint uppercase">
          {t("title.status")}
        </h2>
        <div role="radiogroup" aria-labelledby="status-label" className="grid grid-cols-2 gap-1 rounded-xl bg-surface p-1 sm:grid-cols-4">
          {STATUSES.map((s) => {
            const active = status === s;
            const disabled = !released && s !== "planned";
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={disabled}
                onClick={() => setStatus(title.id, active ? null : s)}
                className={`rounded-lg px-1 py-2 text-sm font-medium transition-colors disabled:opacity-30 ${
                  active ? "bg-(--accent) text-white" : "text-muted enabled:hover:text-ink"
                }`}
              >
                {t(`status.${s}`)}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-xs font-semibold tracking-wide text-faint uppercase">{t("title.overview")}</h2>
        {!overview ? (
          <p className="text-sm text-muted">{t("title.noOverview")}</p>
        ) : showOverview ? (
          <p className="leading-relaxed text-ink/90">{overview}</p>
        ) : (
          <div className="rounded-xl border border-dashed border-line p-4 text-sm">
            <p className="text-muted">{t("title.spoilerHidden")}</p>
            <button type="button" onClick={() => setRevealed(true)} className="mt-2 font-medium text-(--accent)">
              {t("title.reveal")}
            </button>
          </div>
        )}
      </section>

      {appearances.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-faint uppercase">{t("title.appearsIn")}</h2>
          <ul className="space-y-2">
            {appearances.map(({ franchise, entry }) => {
              const continuity = franchise.continuities.find((c) => c.id === entry.continuityId);
              return (
                <li key={franchise.id} style={accentStyle(franchise.accentColor)}>
                  <Link
                    to={`/f/${franchise.id}`}
                    className="block rounded-xl bg-surface p-3 ring-1 ring-white/5 transition-colors hover:bg-surface-2"
                  >
                    <p className="font-medium">
                      <span className="text-(--accent)">{loc(franchise.name)}</span>
                      {continuity && <span className="text-muted"> · {loc(continuity.name)}</span>}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                      <ImportanceBadge importance={entry.importance} />
                      {entry.chronoNote && (
                        <span>
                          {t("title.chrono")}: {loc(entry.chronoNote)}
                        </span>
                      )}
                      {entry.postCredits && (
                        <span>
                          {t("title.postCredits")}:{" "}
                          {entry.postCredits.mid + entry.postCredits.end
                            ? t("postCredits.detail", entry.postCredits)
                            : t("postCredits.none")}
                        </span>
                      )}
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
