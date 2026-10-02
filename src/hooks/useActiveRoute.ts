import { useEffect } from "react";
import { useProgressStore } from "../lib/progressStore";

/** Recuerda esta ruta como la que el perfil sigue en la franquicia: "continuar viendo" la usa. */
export function useRememberRoute(franchiseId: string | undefined, path: string | undefined) {
  const setFranchiseState = useProgressStore((s) => s.setFranchiseState);
  useEffect(() => {
    if (!franchiseId || !path) return;
    if (useProgressStore.getState().franchiseState[franchiseId]?.activeRoute !== path) setFranchiseState(franchiseId, { activeRoute: path });
  }, [franchiseId, path, setFranchiseState]);
}
