import { useState } from "react";
import { Link } from "react-router";
import { effectiveEpisodes } from "../lib/episodes";
import { useLang } from "../lib/i18n";
import { todayIso } from "../lib/progress";
import { setUnitWatched } from "../lib/actions";
import { useProgressStore } from "../lib/progressStore";
import { rowId } from "../lib/scroll";
import type { Entry, Title } from "../lib/types";
import { isUnitWatched, seasonOf, unitKey, unitReleaseDate } from "../lib/units";
import { EpisodePicker } from "./EpisodePicker";
import { RowMenu } from "./RowMenu";
import { ImportanceBadge, Poster, PostCreditsIcon, TitleMeta, WatchToggle } from "./ui";

export interface RowItem {
  title: Title;
  /** Si la fila es una sola temporada de la serie (ver units.ts). */
  season?: number;
  /** Sin entry (título de una ruta ajena a toda franquicia) no se muestra la importancia. */
  entry?: Entry;
  position: number;
}

export function TitleRow({
  item,
  showChronoNote = false,
  isNext = false,
  onWatchedUpTo,
}: {
  item: RowItem;
  showChronoNote?: boolean;
  /** Es lo siguiente por ver de esta lista: se marca y es a donde lleva "Ir a mi siguiente". */
  isNext?: boolean;
  /** Muestra la acción "Visto hasta aquí" en el menú de la fila (recibe la clave de la unidad). */
  onWatchedUpTo?: (key: string) => void;
}) {
  const { t, loc, date, unitName } = useLang();
  const { title, entry, position, season } = item;
  const [open, setOpen] = useState(false);
  const episodes = season === undefined ? undefined : seasonOf(title, season)?.episodes;
  const watched = useProgressStore((s) => isUnitWatched(s.progress[title.id], season, episodes));
  const status = useProgressStore((s) => s.progress[title.id]?.status);
  // Episodios marcados de esta fila (la temporada, o toda la serie), para "3/13".
  const seen = useProgressStore((s) => {
    const map = effectiveEpisodes(title, s.progress[title.id]);
    return season === undefined ? Object.values(map).reduce((n, l) => n + l.length, 0) : (map[season]?.length ?? 0);
  });
  const total = season === undefined ? (title.seasons ?? []).reduce((n, s) => n + s.episodes, 0) : (episodes ?? 0);
  const releaseDate = unitReleaseDate(title, season);
  const released = releaseDate <= todayIso();
  const display = unitName(title, season);
  const hasEpisodes = total > 0 && released;

  return (
    <li id={rowId(unitKey(title.id, season))} className="scroll-mt-32 border-b-2 border-line-soft">
      <div className="flex items-center gap-3 py-3">
        <span className="w-6 shrink-0 text-right font-mono text-xs text-muted tabular-nums">
          {String(position).padStart(2, "0")}
        </span>
        <Link to={`/t/${title.id}`} className="group flex min-w-0 flex-1 items-center gap-3">
          <Poster title={title} size="w92" className={`h-[72px] w-12 ${watched ? "opacity-50" : ""}`} />
          <div className="min-w-0 flex-1">
            <p
              className={`truncate text-[15px] leading-snug font-semibold group-hover:underline group-hover:decoration-2 group-hover:underline-offset-4 ${
                watched ? "text-muted" : ""
              }`}
            >
              {display}
            </p>
            <TitleMeta title={title} season={season} />
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              {isNext && (
                <span className="inline-block border-2 border-tinta bg-faro px-1.5 py-px font-mono text-[10px] font-bold tracking-[0.1em] text-tinta uppercase">
                  {t("list.next")}
                </span>
              )}
              {!watched && (status === "watching" || status === "dropped") && (
                <span className="inline-block border-2 border-line px-1.5 py-px font-mono text-[10px] font-bold tracking-[0.1em] uppercase">
                  {t(`status.${status}`)}
                </span>
              )}
              {entry && <ImportanceBadge importance={entry.importance} />}
              {entry?.postCredits && <PostCreditsIcon {...entry.postCredits} />}
              {showChronoNote && entry?.chronoNote && <span className="font-mono text-[11px] text-muted">{loc(entry.chronoNote)}</span>}
              {hasEpisodes && seen > 0 && !watched && (
                <span className="font-mono text-[11px] font-bold text-fg-soft">{t("episodes.progress", { seen, total })}</span>
              )}
            </div>
          </div>
        </Link>
        {hasEpisodes && (
          <button
            type="button"
            aria-expanded={open}
            aria-label={t(open ? "episodes.hide" : "episodes.show", { title: display })}
            onClick={() => setOpen((o) => !o)}
            className="grid size-11 shrink-0 place-items-center border-2 border-line-soft font-mono text-sm hover:border-line"
          >
            {open ? "−" : "+"}
          </button>
        )}
        {onWatchedUpTo && released && (
          <RowMenu
            label={t("row.menu", { title: display })}
            actions={[{ label: t("row.watchedUpTo"), onSelect: () => onWatchedUpTo(unitKey(title.id, season)) }]}
          />
        )}
        {released ? (
          <WatchToggle
            watched={watched}
            label={t(watched ? "actions.unmarkWatched" : "actions.markWatched", { title: display })}
            onToggle={() => setUnitWatched(title, season, !watched)}
          />
        ) : (
          <span className="w-16 shrink-0 text-right font-mono text-[10px] leading-tight text-muted uppercase">{date(releaseDate)}</span>
        )}
      </div>
      {open && hasEpisodes && (
        <div className="pb-3 pl-9">
          <EpisodePicker title={title} seasons={season === undefined ? undefined : [season]} compact />
        </div>
      )}
    </li>
  );
}
