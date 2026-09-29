import { collection, deleteDoc, doc, setDoc, Timestamp, updateDoc, type DocumentData, type FirestoreDataConverter, type QueryDocumentSnapshot } from "firebase/firestore";
import { create } from "zustand";
import { db } from "./firebase";
import { findShare, newShareId, type ShareDoc, type ShareSnapshot, type ShareTarget } from "./shares";
import type { Lang } from "./types";

// Links compartidos de la cuenta (colección raíz shares/, filtrada por ownerUid).
// session.ts los escucha mientras hay sesión.

export const useSharesStore = create<{ shares: ShareDoc[] }>()(() => ({ shares: [] }));

const toTs = (iso: string) => Timestamp.fromDate(new Date(iso));
const toIso = (ts: unknown) => (ts instanceof Timestamp ? ts.toDate().toISOString() : new Date(0).toISOString());

export const shareConverter: FirestoreDataConverter<ShareDoc> = {
  toFirestore: ({ id: _id, ...s }: ShareDoc) => ({ ...s, createdAt: toTs(s.createdAt), updatedAt: toTs(s.updatedAt) }),
  fromFirestore: (snap: QueryDocumentSnapshot<DocumentData>) => {
    const d = snap.data();
    return { ...d, id: snap.id, createdAt: toIso(d.createdAt), updatedAt: toIso(d.updatedAt) } as ShareDoc;
  },
};

export const sharesCollection = () => collection(db, "shares").withConverter(shareConverter);

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
  setDoc(doc(sharesCollection(), share.id), share).catch((err) => console.error("[shares]", err));
  return share;
}

export function setShareRevoked(id: string, revoked: boolean) {
  useSharesStore.setState((s) => ({ shares: s.shares.map((x) => (x.id === id ? { ...x, revoked } : x)) }));
  updateDoc(doc(db, "shares", id), { revoked, updatedAt: Timestamp.now() }).catch((err) => console.error("[shares]", err));
}

export function deleteShare(id: string) {
  useSharesStore.setState((s) => ({ shares: s.shares.filter((x) => x.id !== id) }));
  deleteDoc(doc(db, "shares", id)).catch((err) => console.error("[shares]", err));
}
