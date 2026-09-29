import { useMemo } from "react";
import { catalogIndex } from "../lib/catalog";
import { applyFilters, effectiveHidden, NO_FILTERS, toggleContinuity } from "../lib/filters";
import { computeOrder, CUSTOM_ORDER_ID, nextUp, resolveOrder } from "../lib/orders";
import { useIsWatched, useProgressStore } from "../lib/progressStore";
import { isReleased, summarize } from "../lib/progress";
import { useUiStore } from "../lib/uiStore";

/** Franquicia con su orden activo, continuidades, filtros y progreso del perfil actual. */
export function useFranchiseView(franchiseId: string | undefined) {
  const franchise = franchiseId ? catalogIndex.franchisesById.get(franchiseId) : undefined;
  const state = useProgressStore((s) => (franchiseId ? s.franchiseState[franchiseId] : undefined));
  const setFranchiseState = useProgressStore((s) => s.setFranchiseState);
  const filters = useUiStore((s) => (franchiseId ? s.filters[franchiseId] : undefined)) ?? NO_FILTERS;
  const isWatched = useIsWatched();

  const order = useMemo(
    () => (franchise ? resolveOrder(franchise, state?.lastOrderId, state?.customOrder) : undefined),
    [franchise, state?.lastOrderId, state?.customOrder],
  );
  const hiddenContinuities = useMemo(
    () => (franchise ? effectiveHidden(franchise, state?.hiddenContinuities, state?.shownContinuities) : []),
    [franchise, state?.hiddenContinuities, state?.shownContinuities],
  );

  // Orden completo de las continuidades visibles: base del progreso y de "continuar viendo".
  const items = useMemo(
    () => (franchise && order ? computeOrder(franchise, order, catalogIndex.titlesById, { hiddenContinuities }) : []),
    [franchise, order, hiddenContinuities],
  );
  const visibleItems = useMemo(() => applyFilters(items, filters, isWatched), [items, filters, isWatched]);

  const summary = summarize(items, isWatched);
  const next = nextUp(
    items.filter((i) => isReleased(i.title)),
    isWatched,
  );

  return {
    franchise,
    order,
    items,
    visibleItems,
    filters,
    summary,
    next,
    hiddenContinuities,
    isWatched,
    hasCustomOrder: Boolean(state?.customOrder?.length),
    setOrder: (orderId: string) => franchise && setFranchiseState(franchise.id, { lastOrderId: orderId }),
    saveCustomOrder: (titleIds: string[]) =>
      franchise && setFranchiseState(franchise.id, { customOrder: titleIds, lastOrderId: CUSTOM_ORDER_ID }),
    toggleContinuity: (continuityId: string) =>
      franchise &&
      setFranchiseState(
        franchise.id,
        toggleContinuity(franchise, continuityId, state?.hiddenContinuities, state?.shownContinuities),
      ),
  };
}
