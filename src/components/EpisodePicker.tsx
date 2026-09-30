import { effectiveEpisodes, episodesPatch, setSeason, toggleEpisode, type EpisodeMap } from "../lib/episodes";
import { useLang } from "../lib/i18n";
import { useProgressStore } from "../lib/progressStore";
import type { Title } from "../lib/types";

/** Aplica un mapa de episodios nuevo al progreso del título (y su estado). */
export function applyEpisodes(title: Title, episodes: EpisodeMap) {
  const store = useProgressStore.getState();
  const patch = episodesPatch(title, store.progress[title.id], episodes);
  if (patch.status === null) store.setStatus(title.id, null);
  else store.updateProgress(title.id, patch);
}

/**
 * Casillas de episodios de las temporadas dadas (o todas), para registrar capítulo por
 * capítulo desde la lista o el detalle.
 */
export function EpisodePicker({ title, seasons, compact = false }: { title: Title; seasons?: readonly number[]; compact?: boolean }) {
  const { t } = useLang();
  const doc = useProgressStore((s) => s.progress[title.id]);
  const map = effectiveEpisodes(title, doc);
  const list = (title.seasons ?? []).filter((s) => !seasons || seasons.includes(s.number));

  return (
    <div className="space-y-3">
      {list.map((s) => {
        const watched = map[s.number] ?? [];
        const complete = watched.length >= s.episodes;
        return (
          <div key={s.number}>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] font-bold uppercase">
                {t("episodes.season", { number: s.number })} · {watched.length}/{s.episodes}
              </span>
              <button
                type="button"
                aria-pressed={complete}
                onClick={() => applyEpisodes(title, setSeason(map, s.number, s.episodes, !complete))}
                className={`min-h-9 border-2 px-2.5 font-mono text-[10px] font-bold uppercase transition-colors duration-[120ms] ease-out ${
                  complete ? "border-line bg-accent text-on-accent" : "border-line-soft hover:border-line"
                }`}
              >
                {complete ? t("episodes.seasonDone") : t("episodes.markSeason")}
              </button>
            </div>
            <div className={`grid gap-1.5 ${compact ? "grid-cols-[repeat(auto-fill,minmax(38px,1fr))]" : "grid-cols-[repeat(auto-fill,minmax(44px,1fr))]"}`}>
              {Array.from({ length: s.episodes }, (_, i) => i + 1).map((ep) => {
                const on = watched.includes(ep);
                return (
                  <button
                    key={ep}
                    type="button"
                    aria-pressed={on}
                    aria-label={t("episodes.episode", { season: s.number, episode: ep })}
                    onClick={() => applyEpisodes(title, toggleEpisode(map, s.number, ep))}
                    className={`${compact ? "h-9 text-xs" : "h-11 text-sm"} border-2 font-mono tabular-nums ${
                      on ? "border-line bg-accent font-bold text-on-accent" : "border-line-soft text-fg hover:border-line"
                    }`}
                  >
                    {ep}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
