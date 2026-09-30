import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { SectionLabel } from "../../components/ui";
import { useCatalogIndex } from "../../lib/catalog";
import { useLang } from "../../lib/i18n";
import { useProgressStore } from "../../lib/progressStore";
import { hasRecap, loadRecap, recapsBefore } from "../../lib/recaps";
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

/** "Lo que necesitas recordar": recaps de lo previo que ya viste (SPEC §9.3). */
export function Recaps({ title }: { title: Title }) {
  const { t, lang, name } = useLang();
  const progress = useProgressStore((s) => s.progress);
  const franchiseState = useProgressStore((s) => s.franchiseState);
  const index = useCatalogIndex();
  const watched = progress[title.id]?.status === "watched";
  const ids = useMemo(
    () => (watched ? [] : recapsBefore(title.id, { index, progress, franchiseState, has: (id) => hasRecap(lang, id) })),
    [title.id, watched, index, progress, franchiseState, lang],
  );
  if (!ids.length) return null;

  return (
    <section className="mt-8">
      <SectionLabel>{t("recaps.title")}</SectionLabel>
      <p className="mb-3 text-sm text-fg-soft">{t("recaps.hint")}</p>
      <div className="divide-y-2 divide-line-soft border-2 border-line bg-surface">
        {/* Lo más cercano primero y abierto. */}
        {[...ids].reverse().map((id, i) => {
          const prev = index.titlesById.get(id)!;
          return <RecapItem key={id} title={prev} label={name(prev)} open={i === 0} />;
        })}
      </div>
    </section>
  );
}

function RecapItem({ title, label, open }: { title: Title; label: string; open: boolean }) {
  const { lang } = useLang();
  const [text, setText] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(open);
  useEffect(() => {
    if (!expanded || text !== null) return;
    let alive = true;
    void loadRecap(lang, title.id)?.then((t) => alive && setText(t));
    return () => {
      alive = false;
    };
  }, [expanded, text, lang, title.id]);

  return (
    <details open={open} onToggle={(e) => setExpanded(e.currentTarget.open)} className="group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3 font-semibold hover:bg-surface-muted">
        <span className="min-w-0 truncate">
          {label} <span className="font-mono text-[11px] font-normal text-muted">{title.releaseDate.slice(0, 4)}</span>
        </span>
        <span aria-hidden className="font-mono text-lg transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="px-3.5 pb-4 text-[15px] leading-[1.55] text-fg-soft">
        {text === null ? "…" : renderRecap(text)}
        <Link to={`/t/${title.id}`} className="text-link mt-3 inline-block font-mono text-[11px] uppercase">
          {label} →
        </Link>
      </div>
    </details>
  );
}
