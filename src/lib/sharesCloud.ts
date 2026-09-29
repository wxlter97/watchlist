import { collection, deleteDoc, doc, setDoc, Timestamp, updateDoc, type DocumentData, type FirestoreDataConverter, type QueryDocumentSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import type { ShareDoc } from "./shares";

// Escrituras de links compartidos en Firestore. Se carga bajo demanda desde sharesStore.ts y
// sessionCloud.ts para que Firebase no esté en el arranque.

const toTs = (iso: string) => Timestamp.fromDate(new Date(iso));
const toIso = (ts: unknown) => (ts instanceof Timestamp ? ts.toDate().toISOString() : new Date(0).toISOString());
const report = (err: unknown) => console.error("[shares]", err);

export const shareConverter: FirestoreDataConverter<ShareDoc> = {
  toFirestore: ({ id: _id, ...s }: ShareDoc) => ({ ...s, createdAt: toTs(s.createdAt), updatedAt: toTs(s.updatedAt) }),
  fromFirestore: (snap: QueryDocumentSnapshot<DocumentData>) => {
    const d = snap.data();
    return { ...d, id: snap.id, createdAt: toIso(d.createdAt), updatedAt: toIso(d.updatedAt) } as ShareDoc;
  },
};

export const sharesCollection = () => collection(db, "shares").withConverter(shareConverter);

export function writeShare(share: ShareDoc) {
  setDoc(doc(sharesCollection(), share.id), share).catch(report);
}

export function writeRevoked(id: string, revoked: boolean) {
  updateDoc(doc(db, "shares", id), { revoked, updatedAt: Timestamp.now() }).catch(report);
}

export function removeShare(id: string) {
  deleteDoc(doc(db, "shares", id)).catch(report);
}
