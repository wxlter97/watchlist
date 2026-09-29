import { useState } from "react";
import { Chip, SelectField } from "../../components/ui";
import { catalogIndex } from "../../lib/catalog";
import { activeFilterCount, kindsIn, type Filters, type StatusFilter } from "../../lib/filters";
import { useLang } from "../../lib/i18n";
import type { Franchise, Importance } from "../../lib/types";
import { useUiStore } from "../../lib/uiStore";

const IMPORTANCE: Importance[] = ["essential", "recommended", "optional", "skippable"];
const STATUS: StatusFilter[] = ["all", "pending", "watched"];
const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

export function FiltersPanel({
  franchise,
  filters,
  hiddenContinuities,
  onToggleContinuity,
  shown,
  total,
}: {
  franchise: Franchise;
  filters: Filters;
  hiddenContinuities: string[];
  onToggleContinuity: (id: string) => void;
  shown: number;
  total: number;
}) {
  const { t, loc } = useLang();
  const [open, setOpen] = useState(false);
  const setFilters = useUiStore((s) => s.setFilters);
  const clearFilters = useUiStore((s) => s.clearFilters);
  const set = (patch: Partial<Filters>) => setFilters(franchise.id, patch);
  const active = activeFilterCount(filters);
  const kinds = kindsIn(franchise, (id) => catalogIndex.titlesById.get(id)?.kind);

  const summary = [
    active > 0 && t("filters.active", { count: active }),
    hiddenContinuities.length > 0 && t("filters.hiddenContinuities", { count: hiddenContinuities.length }),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="mt-6 border-2 border-line bg-surface">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="filters-body"
        onClick={() => setOpen(!open)}
        className="flex min-h-12 w-full items-center justify-between gap-3 px-3.5 py-2 text-left transition-colors duration-[120ms] ease-out hover:bg-surface-muted"
      >
        <span>
          <span className="label font-bold text-fg">{t("filters.title")}</span>
          {summary && <span className="block font-mono text-[11px] text-muted">{summary}</span>}
        </span>
        <span aria-hidden className="font-mono text-lg">
          {open ? "−" : "+"}
        </span>
      </button>

      {open && (
        <div id="filters-body" className="space-y-5 border-t-2 border-line p-3.5">
          <fieldset>
            <legend className="label mb-2 text-fg-soft">{t("franchise.continuities")}</legend>
            <div className="flex flex-col gap-2">
              {franchise.continuities.map((c) => {
                const visible = !hiddenContinuities.includes(c.id);
                return (
                  <label key={c.id} className="flex cursor-pointer items-start gap-3 border-2 border-line-soft p-2.5 hover:border-line">
                    <input
                      type="checkbox"
                      checked={visible}
                      onChange={() => onToggleContinuity(c.id)}
                      className="checkbox mt-0.5"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline justify-between gap-x-2">
                        <span className={`text-sm font-semibold ${visible ? "" : "text-muted"}`}>{loc(c.name)}</span>
                        <span className="label text-muted">{t(`canon.${c.canonLevel}`)}</span>
                      </span>
                      {c.description && <span className="mt-0.5 block text-xs leading-[1.5] text-fg-soft">{loc(c.description)}</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="label mb-2 text-fg-soft">{t("filters.status")}</legend>
            <div className="flex flex-wrap gap-2">
              {STATUS.map((s) => (
                <Chip key={s} selected={filters.status === s} onClick={() => set({ status: s })}>
                  {t(`filters.statuses.${s}`)}
                </Chip>
              ))}
            </div>
          </fieldset>

          {kinds.length > 1 && (
            <fieldset>
              <legend className="label mb-2 text-fg-soft">{t("filters.kind")}</legend>
              <div className="flex flex-wrap gap-2">
                {kinds.map((k) => (
                  <Chip key={k} selected={filters.kinds.includes(k)} onClick={() => set({ kinds: toggle(filters.kinds, k) })}>
                    {t(`kind.${k}`)}
                  </Chip>
                ))}
              </div>
            </fieldset>
          )}

          <fieldset>
            <legend className="label mb-2 text-fg-soft">{t("filters.importance")}</legend>
            <div className="flex flex-wrap gap-2">
              {IMPORTANCE.map((i) => (
                <Chip
                  key={i}
                  selected={filters.importance.includes(i)}
                  onClick={() => set({ importance: toggle(filters.importance, i) })}
                >
                  {t(`importance.${i}`)}
                </Chip>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            {franchise.tags.characters.length > 0 && (
              <SelectField
                label={t("filters.character")}
                value={filters.character ?? ""}
                onChange={(e) => set({ character: e.target.value || undefined })}
                options={[
                  { value: "", label: t("filters.any") },
                  ...franchise.tags.characters
                    .map((c) => ({ value: c.id, label: loc(c.name) }))
                    .sort((a, b) => a.label.localeCompare(b.label)),
                ]}
              />
            )}
            {franchise.tags.teams.length > 0 && (
              <SelectField
                label={t("filters.team")}
                value={filters.team ?? ""}
                onChange={(e) => set({ team: e.target.value || undefined })}
                options={[
                  { value: "", label: t("filters.any") },
                  ...franchise.tags.teams
                    .map((c) => ({ value: c.id, label: loc(c.name) }))
                    .sort((a, b) => a.label.localeCompare(b.label)),
                ]}
              />
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t-2 border-line-soft pt-3">
            <span className="font-mono text-[11px] text-muted">{t("filters.showing", { shown, total })}</span>
            {active > 0 && (
              <button type="button" className="text-link uppercase" onClick={() => clearFilters(franchise.id)}>
                {t("filters.clear")}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
