import { useLang } from "../lib/i18n";
import { jumpTo, rowId } from "../lib/scroll";
import type { Title } from "../lib/types";

/** "Vas en …": lleva la vista a la fila que sigue de la lista (después de haberse ido arriba). */
export function JumpToNext({ next }: { next?: { title: Title; season?: number; key: string } }) {
  const { t, unitName } = useLang();
  if (!next) return null;
  return (
    <button
      type="button"
      onClick={() => jumpTo(rowId(next.key))}
      className="mt-4 flex min-h-11 w-full items-center justify-between gap-3 border-2 border-line px-3.5 py-2 text-left transition-colors duration-[120ms] ease-out hover:bg-fg hover:text-bg"
    >
      <span className="min-w-0">
        <span className="label block font-bold">{t("list.jump")}</span>
        <span className="block truncate text-sm">{t("list.jumpTitle", { title: unitName(next.title, next.season) })}</span>
      </span>
      <span aria-hidden className="font-mono text-lg">
        ↓
      </span>
    </button>
  );
}
