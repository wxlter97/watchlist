import { useMemo } from "react";
import { franchiseMetaById, useCatalog, useCatalogIndex, withReferences } from "../../lib/catalog";
import { useLang } from "../../lib/i18n";
import type { PlanItem } from "../../lib/planner";
import { computePlan, type PlanDoc } from "../../lib/plans";
import { todayIso } from "../../lib/progress";
import { useProgressStore } from "../../lib/progressStore";

type PlanInput = Parameters<typeof computePlan>[0];

/** Calendario del plan recalculado con el progreso actual, desde hoy. Undefined mientras carga su franquicia. */
export function usePlanView(plan: PlanInput | undefined) {
  const progress = useProgressStore((s) => s.progress);
  const franchiseState = useProgressStore((s) => s.franchiseState);
  const { index, ready } = useCatalog(withReferences(plan?.goal.franchiseId));
  return useMemo(
    () => (plan && ready ? computePlan(plan, { index, progress, franchiseState }, todayIso()) : undefined),
    [plan, ready, index, progress, franchiseState],
  );
}

/** Texto de una sesión: "Loki · T1 E1–3". */
export function useItemLabel() {
  const { t, name } = useLang();
  const index = useCatalogIndex();
  return (item: PlanItem) => {
    const title = index.titlesById.get(item.titleId);
    const base = title ? name(title) : item.titleId;
    if (item.season === undefined || item.from === undefined) return base;
    return `${base} · ${t(item.from === item.to ? "planner.episode" : "planner.episodes", { season: item.season, from: item.from, to: item.to })}`;
  };
}

/** Nombre de la meta para mostrar: "Marvel · Ruta esencial". */
export function useGoalLabel() {
  const { t, loc, name } = useLang();
  const index = useCatalogIndex();
  return (goal: PlanDoc["goal"]) => {
    const franchise = index.franchisesById.get(goal.franchiseId);
    // Sin cargar todavía: el nombre de la franquicia sale del manifiesto.
    if (!franchise) return loc(franchiseMetaById.get(goal.franchiseId)?.name ?? goal.refId);
    const fName = loc(franchise.name);
    if (goal.type === "prep") {
      const target = index.titlesById.get(goal.refId);
      return `${t("prep.title", { title: target ? name(target) : goal.refId })} · ${t(`prep.levels.${goal.level ?? "recommended"}`)}`;
    }
    if (goal.type === "route") {
      const route = franchise.routes.find((r) => r.id === goal.refId);
      return route ? loc(route.name) : fName;
    }
    if (goal.type === "order") {
      const order = franchise.orders.find((o) => o.id === goal.refId);
      return `${fName} · ${order ? loc(order.name) : t("customOrder.name")}`;
    }
    return fName;
  };
}

/** "vie 2 oct". */
export function useDayLabel() {
  const { t } = useLang();
  const fmt = new Intl.DateTimeFormat(t("meta.locale"), { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  return (iso: string) => fmt.format(new Date(`${iso}T00:00:00Z`));
}
