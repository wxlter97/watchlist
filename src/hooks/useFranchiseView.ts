import { useMemo } from "react";
import { catalogIndex } from "../lib/catalog";
import { computeOrder, nextUp, resolveOrder } from "../lib/orders";
import { useIsWatched, useProgressStore } from "../lib/progressStore";
import { isReleased, summarize } from "../lib/progress";

const NONE: string[] = [];

/** Franquicia con su orden activo, filtros y progreso del perfil actual. */
export function useFranchiseView(franchiseId: string | undefined) {
  const franchise = franchiseId ? catalogIndex.franchisesById.get(franchiseId) : undefined;
  const state = useProgressStore((s) => (franchiseId ? s.franchiseState[franchiseId] : undefined));
  const setFranchiseState = useProgressStore((s) => s.setFranchiseState);
  const isWatched = useIsWatched();

  const order = useMemo(
    () => (franchise ? resolveOrder(franchise, state?.lastOrderId, state?.customOrder) : undefined),
    [franchise, state?.lastOrderId, state?.customOrder],
  );
  const hiddenContinuities = state?.hiddenContinuities ?? NONE;

  const items = useMemo(
    () => (franchise && order ? computeOrder(franchise, order, catalogIndex.titlesById, { hiddenContinuities }) : []),
    [franchise, order, hiddenContinuities],
  );

  const summary = summarize(items, isWatched);
  const next = nextUp(
    items.filter((i) => isReleased(i.title)),
    isWatched,
  );

  return {
    franchise,
    order,
    items,
    summary,
    next,
    hiddenContinuities,
    isWatched,
    setOrder: (orderId: string) => franchise && setFranchiseState(franchise.id, { lastOrderId: orderId }),
    toggleContinuity: (continuityId: string) => {
      if (!franchise) return;
      const hidden = new Set(hiddenContinuities);
      if (hidden.has(continuityId)) hidden.delete(continuityId);
      else hidden.add(continuityId);
      setFranchiseState(franchise.id, { hiddenContinuities: [...hidden] });
    },
  };
}
