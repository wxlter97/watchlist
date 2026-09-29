import { useEffect, useState } from "react";
import { create } from "zustand";
import type { GroupProgressDoc, GroupDoc } from "./groups";

// Grupos del usuario (groups/ con memberUids array-contains uid). sessionCloud.ts los escucha.
// Las operaciones viven en groupsCloud.ts; lo que corre desde el arranque (GroupSync) lo
// carga bajo demanda.

export const useGroupsStore = create<{ groups: GroupDoc[]; loaded: boolean }>()(() => ({ groups: [], loaded: false }));

const cloud = () => import("./groupsCloud");
const report = (err: unknown) => console.error("[groups]", err);

/** Progreso compartido de un grupo, en vivo (ver groupsCloud.subscribeGroupProgress). */
export function subscribeGroupProgress(groupId: string, onChange: (p: Record<string, GroupProgressDoc>) => void): () => void {
  let unsub: (() => void) | undefined;
  let stopped = false;
  cloud().then((m) => {
    if (!stopped) unsub = m.subscribeGroupProgress(groupId, onChange);
  }, report);
  return () => {
    stopped = true;
    unsub?.();
  };
}

export function useGroupProgress(groupId: string | undefined) {
  const [progress, setProgress] = useState<Record<string, GroupProgressDoc>>({});
  useEffect(() => (groupId ? subscribeGroupProgress(groupId, setProgress) : undefined), [groupId]);
  return progress;
}

/** Publica o quita lo visto por este miembro (ver mirrorChanges). */
export function publishWatched(groupId: string, uid: string, changes: { add: Record<string, string>; remove: string[] }) {
  cloud().then((m) => m.publishWatched(groupId, uid, changes), report);
}
