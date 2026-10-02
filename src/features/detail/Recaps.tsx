import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { ImportanceBadge, Notice, SectionLabel } from "../../components/ui";
import { useCatalogIndex } from "../../lib/catalog";
import { useLang } from "../../lib/i18n";
import { useProgressStore } from "../../lib/progressStore";
import { hasRecap, loadRecap, recapSources, type RecapSource } from "../../lib/recaps";
import { useSettings } from "../../lib/settings";
import type { Title } from "../../lib/types";

/** Markdown mínimo de los recaps: viñetas "- " y **negritas**. */
function renderRecap(text: string): ReactNode {
  const inline = (line: string) =>
    line.split(/(\*\*[^*]+\*\*)/).map((part, i) => (part.startsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part));
  const lines = text.split("\n").filter((l) => l.trim());
  const bullets = lines.filter((l) => l.startsWith("- "));
  return bullets.length === lines.length ? (
    <ul className="list-disc space-y-1.5 pl-5">
      {bullets.map((l, i) => (
        <li key={i}>{inline(l.slice(2))}</li>
      ))}
    </ul>
  ) : (
    lines.map((l, i) => <p key={i}>{inline(l.replace(/^- /, ""))}</p>)
  );
}

/** "Lo que necesitas recordar": todo lo previo que importa para este título y por qué (SPEC §9.3). */
export function Recaps({ title }: { title: Title }) {
  const { t } = useLang();
  const progress = useProgressStore((s) => s.progress);
  const index = useCatalogIndex();
  const watched = progress[title.id]?.status === "watched";
  const sources = useMemo(() => (watched ? [] : recapSources(title.id, index)), [title.id, watched, index]);
  if (!sources.length) return null;

  return (
    <section className="mt-8">
      <SectionLabel>{t("recaps.title")}</SectionLabel>
      <p className="mb-3 text-sm text-fg-soft">{t("recaps.hint", { count: sources.length })}</p>
      <div className="divide-y-2 divide-line-soft border-2 border-line bg-surface">
        {sources.map((source, i) => (
          <RecapItem key={source.title.id} source={source} seen={progress[source.title.id]?.status === "watched"} open={i === 0} />
        ))}
      </div>
    </section>
  );
}

function RecapItem({ source, seen, open }: { source: RecapSource; seen: boolean; open: boolean }) {
  const { t, lang, name, loc } = useLang();
  const spoilerFree = useSettings((s) => s.spoilerFree);
  const { title, franchise, continuity, importance, inMinimum, chronoNote } = source;
  const [text, setText] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(open);
  const [revealed, setRevealed] = useState(false);
  const recap = hasRecap(lang, title.id);
  const hidden = spoilerFree && !seen && !revealed;
  useEffect(() => {
    if (!expanded || hidden || text !== null || !recap) return;
    let alive = true;
    void loadRecap(lang, title.id)?.then((r) => alive && setText(r));
    return () => {
      alive = false;
    };
  }, [expanded, hidden, recap, text, lang, title.id]);

  const label = name(title);
  // Por qué importa: su nivel, si está en lo mínimo, la nota cronológica y de dónde viene.
  const why = [
    t(`recaps.why.${importance}`),
    inMinimum && t("recaps.why.minimum"),
    continuity && t("recaps.why.continuity", { continuity: loc(continuity.name), franchise: loc(franchise.name) }),
    chronoNote && loc(chronoNote),
  ].filter(Boolean);

  return (
    <details open={open} onToggle={(e) => setExpanded(e.currentTarget.open)} className="group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3 hover:bg-surface-muted">
        <span className="min-w-0">
          <span className="block truncate font-semibold">
            {label} <span className="font-mono text-[11px] font-normal text-muted">{title.releaseDate.slice(0, 4)}</span>
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-2">
            <ImportanceBadge importance={importance} />
            <span className="font-mono text-[11px] text-muted uppercase">{seen ? t("recaps.seen") : t("recaps.unseen")}</span>
          </span>
        </span>
        <span aria-hidden className="font-mono text-lg transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="space-y-3 px-3.5 pb-4 text-[15px] leading-[1.55] text-fg-soft">
        <p className="text-sm">
          <span className="label mr-1.5 text-muted">{t("recaps.whyLabel")}</span>
          {why.join(" · ")}
        </p>
        {!recap ? (
          <p className="text-sm text-muted">{t("recaps.none")}</p>
        ) : hidden ? (
          <Notice>
            <p className="leading-[1.5]">{t("recaps.spoilerHidden")}</p>
            <button type="button" onClick={() => setRevealed(true)} className="text-link mt-2 uppercase">
              {t("recaps.reveal")} →
            </button>
          </Notice>
        ) : text === null ? (
          "…"
        ) : (
          renderRecap(text)
        )}
        <Link to={`/t/${title.id}`} className="text-link inline-block font-mono text-[11px] uppercase">
          {label} →
        </Link>
      </div>
    </details>
  );
}
