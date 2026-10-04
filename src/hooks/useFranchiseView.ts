import { useMemo } from "react";
import { useCatalog, withReferences } from "../lib/catalog";
import { applyFilters, effectiveHidden, NO_FILTERS, toggleContinuity } from "../lib/filters";
import { computeOrder, CUSTOM_ORDER_ID, nextUp, resolveOrder } from "../lib/orders";
import { useProgressStore } from "../lib/progressStore";
import { useIsDropped, useIsWatched } from "../lib/watched";
import { summarize, todayIso } from "../lib/progress";
import { useUiStore } from "../lib/uiStore";

/** Franquicia con su orden activo, continuidades, filtros y progreso del perfil actual. */
export function useFranchiseView(franchiseId: string | undefined) {
  const { index, ready } = useCatalog(withReferences(franchiseId));
  const franchise = franchiseId ? index.franchisesById.get(franchiseId) : undefined;
  const state = useProgressStore((s) => (franchiseId ? s.franchiseState[franchiseId] : undefined));
  const setFranchiseState = useProgressStore((s) => s.setFranchiseState);
  const filters = useUiStore((s) => (franchiseId ? s.filters[franchiseId] : undefined)) ?? NO_FILTERS;
  const isWatched = useIsWatched();
  const isDropped = useIsDropped();

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
    () => (franchise && order ? computeOrder(franchise, order, index.titlesById, { hiddenContinuities }) : []),
    [franchise, order, index, hiddenContinuities],
  );
  const visibleItems = useMemo(() => applyFilters(items, filters, isWatched), [items, filters, isWatched]);

  // El progreso del orden activo (lo que se ve en la lista) y, aparte, el de toda la franquicia
  // (continuidades visibles): un orden curado incluye solo algunos títulos y, si solo se mostrara
  // el de la franquicia, el porcentaje no cambiaría al cambiar de orden.
  const allItems = useMemo(
    () =>
      franchise
        ? order?.type === "curated"
          ? computeOrder(franchise, { id: "release", type: "release", name: "" }, index.titlesById, { hiddenContinuities })
          : items
        : [],
    [franchise, order, items, index, hiddenContinuities],
  );
  const summary = summarize(items, isWatched);
  const franchiseSummary = summarize(allItems, isWatched);
  const today = todayIso();
  const next = nextUp(
    items.filter((i) => i.releaseDate <= today),
    isWatched,
    isDropped,
  );

  return {
    /** La franquicia ya se cargó (o no existe): antes, `franchise` es undefined. */
    ready,
    index,
    franchise,
    order,
    items,
    visibleItems,
    filters,
    summary,
    /** Toda la franquicia, sin importar el orden: igual a `summary` salvo en órdenes curados. */
    franchiseSummary,
    next,
    hiddenContinuities,
    isWatched,
    hasCustomOrder: Boolean(state?.customOrder?.length),
    state,
    // Elegir un orden vuelve a "continuar viendo" por el orden, no por la última ruta abierta.
    setOrder: (orderId: string) => franchise && setFranchiseState(franchise.id, { lastOrderId: orderId, activeRoute: undefined }),
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
