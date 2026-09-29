import { useEffect, useId, useRef, useState } from "react";

/** Menú "⋮" de una fila, con acciones secundarias. Se cierra al elegir, con Escape o al tocar fuera. */
export function RowMenu({ label, actions }: { label: string; actions: { label: string; onSelect: () => void }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen(!open)}
        className="grid h-11 w-7 place-items-center font-mono text-lg text-muted hover:text-fg"
      >
        ⋮
      </button>
      {open && (
        <ul id={menuId} role="menu" className="absolute top-full right-0 z-30 min-w-52 border-2 border-line bg-surface">
          {actions.map((a) => (
            <li key={a.label} role="none">
              <button
                type="button"
                role="menuitem"
                autoFocus
                onClick={() => {
                  setOpen(false);
                  a.onSelect();
                }}
                className="block min-h-11 w-full px-3 py-2 text-left text-sm font-semibold hover:bg-fg hover:text-bg"
              >
                {a.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
