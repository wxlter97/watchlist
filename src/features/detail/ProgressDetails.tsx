import { useEffect, useState } from "react";
import { formatRuntime, SectionLabel, Tabs } from "../../components/ui";
import { effectiveEpisodes, episodesPatch, setSeason, toggleEpisode, totalEpisodes, watchedEpisodes } from "../../lib/episodes";
import { externalUrl, type ExternalService } from "../../lib/externalLinks";
import { useLang } from "../../lib/i18n";
import { useProgressStore, viewingsOf, type ProgressDoc, type Viewing } from "../../lib/progressStore";
import { useSettings } from "../../lib/settings";
import type { Title } from "../../lib/types";
import { viewingOptions, type ViewingOptions } from "../../lib/viewings";

// Bloques del detalle que editan el progreso fino: versión, calificación, rewatch, notas y episodios.

export function VersionPicker({ title, doc }: { title: Title; doc?: ProgressDoc }) {
  const { t, loc } = useLang();
  const updateProgress = useProgressStore((s) => s.updateProgress);
  if (!title.versions?.length) return null;
  const current = doc?.versionId ?? title.versions.find((v) => v.default)?.id ?? title.versions[0]!.id;

  return (
    <section className="mt-8">
      <SectionLabel>{t("versions.title")}</SectionLabel>
      <div className="scrollbar-none -mx-4 overflow-x-auto px-4">
        <Tabs
          label={t("versions.title")}
          layout="flex w-max min-w-full"
          value={current}
          options={title.versions.map((v) => ({ value: v.id, label: `${loc(v.name)} · ${formatRuntime(v.runtimeMin, t)}` }))}
          onChange={(versionId) => updateProgress(title.id, { versionId })}
        />
      </div>
      <p className="mt-2 text-xs text-fg-soft">{t("versions.hint")}</p>
    </section>
  );
}

export function RatingAndRewatch({ title, doc }: { title: Title; doc?: ProgressDoc }) {
  const { t } = useLang();
  const updateProgress = useProgressStore((s) => s.updateProgress);
  const rating = doc?.rating ?? 0;

  return (
    <section className="mt-8 grid gap-6 sm:grid-cols-2">
      <div>
        <SectionLabel>{t("rating.title")}</SectionLabel>
        <div role="radiogroup" aria-label={t("rating.title")} className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={t("rating.value", { count: n })}
              // Calificar implica haberlo visto; tocar la calificación actual la quita.
              onClick={() => updateProgress(title.id, { rating: rating === n ? undefined : n, status: doc?.status ?? "watched" })}
              className={`grid size-11 place-items-center border-2 font-display text-lg transition-colors duration-[120ms] ease-out ${
                n <= rating ? "border-line bg-accent text-on-accent" : "border-line-soft text-muted hover:border-line"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      {doc?.status === "watched" && (
        <div>
          <SectionLabel>{t("rewatch.title")}</SectionLabel>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label={t("rewatch.less")}
              disabled={!doc.rewatchCount}
              onClick={() => updateProgress(title.id, { rewatchCount: Math.max(0, doc.rewatchCount - 1) })}
              className="grid size-11 place-items-center border-2 border-line font-mono text-lg disabled:border-line-soft disabled:text-muted"
            >
              −
            </button>
            <span className="min-w-24 text-center font-mono text-sm">{t("rewatch.count", { count: doc.rewatchCount })}</span>
            <button
              type="button"
              aria-label={t("rewatch.more")}
              onClick={() => updateProgress(title.id, { rewatchCount: doc.rewatchCount + 1 })}
              className="grid size-11 place-items-center border-2 border-line font-mono text-lg"
            >
              +
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

const chip = (on: boolean) =>
  `min-h-11 border-2 px-3 font-mono text-[11px] font-bold uppercase transition-colors duration-[120ms] ease-out ${
    on ? "border-line bg-accent text-on-accent" : "border-line-soft hover:border-line"
  }`;

// Campos de texto y fecha: `min-w-0 max-w-full` y sin apariencia nativa, porque en iOS el campo
// de fecha toma su ancho intrínseco y desborda la pantalla.
const field = "block min-h-11 w-full min-w-0 max-w-full appearance-none border-2 border-line bg-surface px-3 text-left text-fg";

/**
 * Cada vez que se vio (el estreno, un replay…), con lo que corresponde al tipo de título:
 * una película puede haberse visto en cine y en formatos como IMAX; una serie, por temporada.
 */
export function ViewingLog({ title, doc }: { title: Title; doc?: ProgressDoc }) {
  const { t } = useLang();
  const updateProgress = useProgressStore((s) => s.updateProgress);
  const viewings = viewingsOf(doc);
  const options = viewingOptions(title.kind, Boolean(title.seasons?.length));

  // Guardar implica haberlo visto (como calificar). Cada replay más allá de la primera vez
  // sube el contador de rewatch si hacía falta.
  const save = (next: Viewing[]) => {
    const status = doc?.status ?? "watched";
    const rewatchCount = Math.max(doc?.rewatchCount ?? 0, status === "watched" ? next.length - 1 : 0);
    updateProgress(title.id, { viewings: next.length ? next : undefined, rewatchCount, status });
  };

  return (
    <section className="mt-8">
      <SectionLabel>{t("viewing.title")}</SectionLabel>
      <p className="mb-3 text-xs text-fg-soft">{t("viewing.hint")}</p>
      {viewings.length > 0 && (
        <ol className="space-y-4">
          {viewings.map((v, i) => (
            <ViewingEntry
              key={i}
              index={i}
              viewing={v}
              title={title}
              options={options}
              onChange={(patch) => save(viewings.map((x, j) => (j === i ? clean({ ...x, ...patch }) : x)))}
              onRemove={() => save(viewings.filter((_, j) => j !== i))}
            />
          ))}
        </ol>
      )}
      <button
        type="button"
        onClick={() => save([...viewings, { date: new Date().toLocaleDateString("sv") }])}
        className="mt-3 min-h-11 border-2 border-line px-4 font-mono text-xs font-bold uppercase transition-colors duration-[120ms] ease-out hover:bg-fg hover:text-bg"
      >
        + {t(viewings.length ? "viewing.addReplay" : "viewing.add")}
      </button>
    </section>
  );
}

/** Quita los campos vacíos de una entrada (el resto de campos conserva su valor). */
const clean = (v: Viewing): Viewing =>
  Object.fromEntries(Object.entries(v).filter(([, x]) => (Array.isArray(x) ? x.length : x !== undefined && x !== ""))) as Viewing;

function ViewingEntry({
  index,
  viewing,
  title,
  options,
  onChange,
  onRemove,
}: {
  index: number;
  viewing: Viewing;
  title: Title;
  options: ViewingOptions;
  onChange: (patch: Partial<Viewing>) => void;
  onRemove: () => void;
}) {
  const { t } = useLang();
  const [place, setPlace] = useState(viewing.place ?? "");
  const [note, setNote] = useState(viewing.note ?? "");
  useEffect(() => setPlace(viewing.place ?? ""), [viewing.place]);
  useEffect(() => setNote(viewing.note ?? ""), [viewing.note]);
  const formats = viewing.formats ?? [];
  const id = `viewing-${index}`;

  return (
    <li className="min-w-0 border-2 border-line-soft bg-surface p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="label font-bold">{index === 0 ? t("viewing.first") : t("viewing.replay", { number: index })}</p>
        <button type="button" onClick={onRemove} aria-label={t("viewing.remove", { number: index + 1 })} className="text-link min-h-11 px-1 uppercase">
          {t("viewing.clear")}
        </button>
      </div>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <div className="min-w-0">
          <label htmlFor={`${id}-date`} className="label mb-2 block text-muted">
            {t("viewing.date")}
          </label>
          <input
            id={`${id}-date`}
            type="date"
            value={viewing.date ?? ""}
            max={new Date().toLocaleDateString("sv")}
            onChange={(e) => onChange({ date: e.target.value || undefined })}
            className={field}
          />
        </div>
        <div className="min-w-0">
          <label htmlFor={`${id}-place`} className="label mb-2 block text-muted">
            {t("viewing.place")}
          </label>
          <input
            id={`${id}-place`}
            type="text"
            value={place}
            maxLength={100}
            placeholder={t("viewing.placePlaceholder")}
            onChange={(e) => setPlace(e.target.value)}
            onBlur={() => place.trim() !== (viewing.place ?? "") && onChange({ place: place.trim() || undefined })}
            className={`${field} placeholder:text-muted`}
          />
        </div>
      </div>
      <div className="mt-4">
        <SectionLabel>{t("viewing.medium")}</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {options.mediums.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={viewing.medium === m}
              // Tocar el activo lo quita.
              onClick={() => onChange({ medium: viewing.medium === m ? undefined : m })}
              className={chip(viewing.medium === m)}
            >
              {t(`viewing.mediums.${m}`)}
            </button>
          ))}
        </div>
      </div>
      {options.seasons && title.seasons && (
        <div className="mt-4">
          <SectionLabel>{t("viewing.season")}</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {title.seasons.map((s) => (
              <button
                key={s.number}
                type="button"
                aria-pressed={viewing.season === s.number}
                onClick={() => onChange({ season: viewing.season === s.number ? undefined : s.number })}
                className={chip(viewing.season === s.number)}
              >
                {t("episodes.season", { number: s.number })}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="mt-4">
        <SectionLabel>{t(options.formats.length > 2 ? "viewing.format" : "viewing.language")}</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {options.formats.map((f) => {
            const on = formats.includes(f);
            return (
              <button
                key={f}
                type="button"
                aria-pressed={on}
                onClick={() => onChange({ formats: on ? formats.filter((x) => x !== f) : [...formats, f] })}
                className={chip(on)}
              >
                {t(`viewing.formats.${f}`)}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-4">
        <label htmlFor={`${id}-note`} className="label mb-2 block text-muted">
          {t("viewing.note")}
        </label>
        <textarea
          id={`${id}-note`}
          value={note}
          rows={2}
          maxLength={500}
          placeholder={t("viewing.notePlaceholder")}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => note.trim() !== (viewing.note ?? "") && onChange({ note: note.trim() || undefined })}
          className={`${field} resize-y py-2 text-[15px] leading-[1.55] placeholder:text-muted`}
        />
      </div>
    </li>
  );
}

export function Notes({ title, doc }: { title: Title; doc?: ProgressDoc }) {
  const { t } = useLang();
  const updateProgress = useProgressStore((s) => s.updateProgress);
  const [text, setText] = useState(doc?.notes ?? "");
  useEffect(() => setText(doc?.notes ?? ""), [doc?.notes]);

  const save = () => {
    const notes = text.trim() || undefined;
    if (notes !== doc?.notes) updateProgress(title.id, { notes });
  };

  return (
    <section className="mt-8">
      <label htmlFor="notes" className="label mb-2 block text-muted">
        {t("notes.title")}
      </label>
      <textarea
        id="notes"
        value={text}
        rows={3}
        maxLength={2000}
        placeholder={t("notes.placeholder")}
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
        className="w-full resize-y border-2 border-line bg-surface p-3 text-[15px] leading-[1.55] text-fg placeholder:text-muted"
      />
    </section>
  );
}

export function Episodes({ title, doc }: { title: Title; doc?: ProgressDoc }) {
  const { t } = useLang();
  const updateProgress = useProgressStore((s) => s.updateProgress);
  const setStatus = useProgressStore((s) => s.setStatus);
  const [open, setOpen] = useState<number | null>(null);
  if (!title.seasons?.length) return null;

  // Un título visto entero cuenta con todos sus episodios: así se puede desmarcar uno.
  const map = effectiveEpisodes(title, doc);
  const apply = (episodes: ProgressDoc["episodes"] & object) => {
    // Sin episodios vistos, el progreso se borra salvo que tenga calificación o notas.
    const patch = episodesPatch(title, doc, episodes);
    if (patch.status === null) setStatus(title.id, null);
    else updateProgress(title.id, patch);
  };
  const total = totalEpisodes(title);
  const seen = watchedEpisodes(map);

  return (
    <section className="mt-8">
      <div className="mb-2 flex items-baseline justify-between">
        <SectionLabel>{t("episodes.title")}</SectionLabel>
        <span className="font-mono text-[11px] text-muted">{t("progress.count", { watched: seen, total })}</span>
      </div>
      <ul className="border-2 border-line bg-surface">
        {title.seasons.map((s) => {
          const watched = map?.[s.number] ?? [];
          const complete = watched.length >= s.episodes;
          const isOpen = open === s.number;
          return (
            <li key={s.number} className="border-b-2 border-line-soft last:border-b-0">
              <div className="flex items-center gap-2 px-3 py-2">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : s.number)}
                  className="flex min-h-11 flex-1 items-center gap-2 text-left"
                >
                  <span aria-hidden className="font-mono">
                    {isOpen ? "−" : "+"}
                  </span>
                  <span className="font-semibold">{t("episodes.season", { number: s.number })}</span>
                  <span className="font-mono text-[11px] text-muted">
                    {watched.length}/{s.episodes}
                  </span>
                </button>
                <button
                  type="button"
                  aria-pressed={complete}
                  onClick={() => apply(setSeason(map, s.number, s.episodes, !complete))}
                  className={`min-h-11 border-2 px-3 font-mono text-[11px] font-bold uppercase transition-colors duration-[120ms] ease-out ${
                    complete ? "border-line bg-accent text-on-accent" : "border-line-soft hover:border-line"
                  }`}
                >
                  {complete ? t("episodes.seasonDone") : t("episodes.markSeason")}
                </button>
              </div>
              {isOpen && (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-1.5 px-3 pb-3">
                  {Array.from({ length: s.episodes }, (_, i) => i + 1).map((ep) => {
                    const on = watched.includes(ep);
                    return (
                      <button
                        key={ep}
                        type="button"
                        aria-pressed={on}
                        aria-label={t("episodes.episode", { season: s.number, episode: ep })}
                        onClick={() => apply(toggleEpisode(map, s.number, ep))}
                        className={`h-11 border-2 font-mono text-sm tabular-nums ${
                          on ? "border-line bg-accent font-bold text-on-accent" : "border-line-soft text-fg hover:border-line"
                        }`}
                      >
                        {ep}
                      </button>
                    );
                  })}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const SERVICES: { key: ExternalService; label: string }[] = [
  { key: "letterboxd", label: "Letterboxd" },
  { key: "imdb", label: "IMDb" },
  { key: "trakt", label: "Trakt" },
];

export function ExternalLinks({ title }: { title: Title }) {
  const { t } = useLang();
  const enabled = useSettings((s) => s.externalLinks);
  const links = SERVICES.flatMap(({ key, label }) => {
    const href = enabled[key] ? externalUrl(key, title) : undefined;
    return href ? [{ key, label, href }] : [];
  });
  if (!links.length) return null;

  return (
    <section className="mt-8">
      <SectionLabel>{t("external.title")}</SectionLabel>
      <ul className="flex flex-wrap gap-2">
        {links.map((l) => (
          <li key={l.key}>
            <a
              href={l.href}
              target="_blank"
              rel="noopener"
              className="flex min-h-11 items-center gap-1.5 border-2 border-line bg-surface px-3 font-mono text-xs font-bold uppercase transition-colors duration-[120ms] ease-out hover:bg-fg hover:text-bg"
            >
              {l.label} <span aria-hidden>↗</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
