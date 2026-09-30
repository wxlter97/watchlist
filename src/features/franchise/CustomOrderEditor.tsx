import { useState } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button, Poster } from "../../components/ui";
import { useLang } from "../../lib/i18n";
import type { Title } from "../../lib/types";

// Orden personalizado por perfil (SPEC §4.3): arrastrar con puntero, táctil o teclado
// (espacio para tomar, flechas para mover), o con los botones de subir/bajar.

/** Una unidad del orden: un título o una temporada (ver units.ts). */
interface EditorUnit {
  key: string;
  title: Title;
  season?: number;
}

export function CustomOrderEditor({
  units,
  onSave,
  onCancel,
}: {
  units: EditorUnit[];
  onSave: (keys: string[]) => void;
  onCancel: () => void;
}) {
  const { t, unitName } = useLang();
  const [list, setList] = useState(units);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const move = (from: number, to: number) => {
    if (to < 0 || to >= list.length) return;
    setList(arrayMove(list, from, to));
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    move(
      list.findIndex((x) => x.key === active.id),
      list.findIndex((x) => x.key === over.id),
    );
  };

  return (
    <section className="mt-6">
      <p className="mb-3 max-w-[58ch] text-sm leading-[1.55] text-fg-soft">{t("customOrder.hint")}</p>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        accessibility={{
          screenReaderInstructions: { draggable: t("customOrder.srInstructions") },
        }}
      >
        <SortableContext items={list.map((x) => x.key)} strategy={verticalListSortingStrategy}>
          <ol className="border-2 border-line">
            {list.map((unit, i) => (
              <SortableRow
                key={unit.key}
                id={unit.key}
                title={unit.title}
                label={unitName(unit.title, unit.season)}
                position={i + 1}
                isFirst={i === 0}
                isLast={i === list.length - 1}
                onUp={() => move(i, i - 1)}
                onDown={() => move(i, i + 1)}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>

      <div className="sticky bottom-0 -mx-4 mt-4 flex flex-wrap gap-2 border-t-2 border-line bg-bg px-4 py-3">
        <Button variant="primary" onClick={() => onSave(list.map((x) => x.key))}>
          {t("customOrder.save")}
        </Button>
        <Button onClick={onCancel}>{t("common.cancel")}</Button>
      </div>
    </section>
  );
}

function SortableRow({
  id,
  title,
  label,
  position,
  isFirst,
  isLast,
  onUp,
  onDown,
}: {
  id: string;
  title: Title;
  label: string;
  position: number;
  isFirst: boolean;
  isLast: boolean;
  onUp: () => void;
  onDown: () => void;
}) {
  const { t } = useLang();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 border-b-2 border-line-soft bg-surface px-2 py-2 last:border-b-0 ${
        isDragging ? "relative z-10 outline-3 outline-faro" : ""
      }`}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={t("customOrder.drag", { title: label })}
        className="grid size-11 shrink-0 cursor-grab touch-none place-items-center text-muted hover:text-fg active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <svg viewBox="0 0 16 16" className="size-4" fill="currentColor" aria-hidden>
          <rect x="3" y="3" width="3" height="3" />
          <rect x="10" y="3" width="3" height="3" />
          <rect x="3" y="10" width="3" height="3" />
          <rect x="10" y="10" width="3" height="3" />
        </svg>
      </button>
      <span className="w-6 shrink-0 text-right font-mono text-xs text-muted tabular-nums">{String(position).padStart(2, "0")}</span>
      <Poster title={title} size="w92" className="h-12 w-8" />
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{label}</span>
      <div className="flex shrink-0">
        <button
          type="button"
          aria-label={t("customOrder.moveUp", { title: label })}
          disabled={isFirst}
          onClick={onUp}
          className="grid size-11 place-items-center border-2 border-line-soft font-mono text-fg enabled:hover:border-line disabled:opacity-30"
        >
          ↑
        </button>
        <button
          type="button"
          aria-label={t("customOrder.moveDown", { title: label })}
          disabled={isLast}
          onClick={onDown}
          className="-ml-[2px] grid size-11 place-items-center border-2 border-line-soft font-mono text-fg enabled:hover:border-line disabled:opacity-30"
        >
          ↓
        </button>
      </div>
    </li>
  );
}
