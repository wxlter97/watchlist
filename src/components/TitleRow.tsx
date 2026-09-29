import { Link } from "react-router";
import { useLang } from "../lib/i18n";
import { isReleased } from "../lib/progress";
import { setTitleStatus } from "../lib/actions";
import { useProgressStore } from "../lib/progressStore";
import type { Entry, Title } from "../lib/types";
import { RowMenu } from "./RowMenu";
import { ImportanceBadge, Poster, PostCreditsIcon, TitleMeta, WatchToggle } from "./ui";

export interface RowItem {
  title: Title;
  /** Sin entry (título de una ruta ajena a toda franquicia) no se muestra la importancia. */
  entry?: Entry;
  position: number;
}

export function TitleRow({
  item,
  showChronoNote = false,
  onWatchedUpTo,
}: {
  item: RowItem;
  showChronoNote?: boolean;
  /** Muestra la acción "Visto hasta aquí" en el menú de la fila. */
  onWatchedUpTo?: (titleId: string) => void;
}) {
  const { t, name, loc, date } = useLang();
  const { title, entry, position } = item;
  const watched = useProgressStore((s) => s.progress[title.id]?.status === "watched");
  const released = isReleased(title);
  const display = name(title);

  return (
    <li className="flex items-center gap-3 border-b-2 border-line-soft py-3">
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
          <TitleMeta title={title} />
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            {entry && <ImportanceBadge importance={entry.importance} />}
            {entry?.postCredits && <PostCreditsIcon {...entry.postCredits} />}
            {showChronoNote && entry?.chronoNote && (
              <span className="font-mono text-[11px] text-muted">{loc(entry.chronoNote)}</span>
            )}
          </div>
        </div>
      </Link>
      {onWatchedUpTo && released && (
        <RowMenu
          label={t("row.menu", { title: display })}
          actions={[{ label: t("row.watchedUpTo"), onSelect: () => onWatchedUpTo(title.id) }]}
        />
      )}
      {released ? (
        <WatchToggle
          watched={watched}
          label={t(watched ? "actions.unmarkWatched" : "actions.markWatched", { title: display })}
          onToggle={() => setTitleStatus(title, watched ? null : "watched")}
        />
      ) : (
        <span className="w-16 shrink-0 text-right font-mono text-[10px] leading-tight text-muted uppercase">
          {date(title.releaseDate)}
        </span>
      )}
    </li>
  );
}
