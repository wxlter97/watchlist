import { create } from "zustand";
import { findShare, newShareId, type ShareDoc, type ShareSnapshot, type ShareTarget } from "./shares";
import type { Lang } from "./types";

// Links compartidos de la cuenta (colección raíz shares/, filtrada por ownerUid).
// sessionCloud.ts los escucha mientras hay sesión. Los cambios se aplican aquí al instante y
// se escriben con sharesCloud.ts, que trae Firebase bajo demanda.

export const useSharesStore = create<{ shares: ShareDoc[] }>()(() => ({ shares: [] }));

const cloud = () => import("./sharesCloud");
const report = (err: unknown) => console.error("[shares]", err);

/**
 * Crea el link o, si ya existe uno para lo mismo, actualiza su foto (y lo reactiva si estaba
 * revocado). Devuelve el link. Sin conexión queda en cola como cualquier escritura.
 */
export function publishShare(
  owner: { uid: string; profileId: string; name: string },
  target: ShareTarget,
  data: { title: string; lang: Lang; snapshot: ShareSnapshot },
): ShareDoc {
  const now = new Date().toISOString();
  const existing = findShare(useSharesStore.getState().shares, owner.profileId, target);
  const share: ShareDoc = {
    ...target,
    id: existing?.id ?? newShareId(),
    ownerUid: owner.uid,
    profileId: owner.profileId,
    ownerName: owner.name,
    title: data.title,
    lang: data.lang,
    snapshot: data.snapshot,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    revoked: false,
  };
  useSharesStore.setState((s) => ({ shares: [share, ...s.shares.filter((x) => x.id !== share.id)] }));
  cloud().then((m) => m.writeShare(share), report);
  return share;
}

export function setShareRevoked(id: string, revoked: boolean) {
  useSharesStore.setState((s) => ({ shares: s.shares.map((x) => (x.id === id ? { ...x, revoked } : x)) }));
  cloud().then((m) => m.writeRevoked(id, revoked), report);
}

export function deleteShare(id: string) {
  useSharesStore.setState((s) => ({ shares: s.shares.filter((x) => x.id !== id) }));
  cloud().then((m) => m.removeShare(id), report);
}
