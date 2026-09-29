import { Link } from "react-router";
import type { OrderedItem } from "../lib/orders";
import { useLang } from "../lib/i18n";
import { isReleased } from "../lib/progress";
import { useProgressStore } from "../lib/progressStore";
import { ImportanceBadge, Poster, PostCreditsIcon, TitleMeta, WatchToggle } from "./ui";

export function TitleRow({ item, showChronoNote }: { item: OrderedItem; showChronoNote: boolean }) {
  const { t, name, loc, date } = useLang();
  const { title, entry, position } = item;
  const watched = useProgressStore((s) => s.progress[title.id]?.status === "watched");
  const setStatus = useProgressStore((s) => s.setStatus);
  const released = isReleased(title);
  const display = name(title);

  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="w-6 shrink-0 text-right text-xs tabular-nums text-faint">{position}</span>
      <Link
        to={`/t/${title.id}`}
        className={`flex min-w-0 flex-1 items-center gap-3 rounded-lg transition-opacity ${watched ? "opacity-60" : ""}`}
      >
        <Poster title={title} size="w92" className="h-[72px] w-12" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium leading-snug">{display}</p>
          <TitleMeta title={title} />
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <ImportanceBadge importance={entry.importance} />
            {entry.postCredits && <PostCreditsIcon {...entry.postCredits} />}
            {showChronoNote && entry.chronoNote && <span className="text-xs text-faint">{loc(entry.chronoNote)}</span>}
          </div>
        </div>
      </Link>
      {released ? (
        <WatchToggle
          watched={watched}
          label={t(watched ? "actions.unmarkWatched" : "actions.markWatched", { title: display })}
          onToggle={() => setStatus(title.id, watched ? null : "watched")}
        />
      ) : (
        <span className="w-16 shrink-0 text-right text-[11px] leading-tight text-muted">{date(title.releaseDate)}</span>
      )}
    </li>
  );
}
