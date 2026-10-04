import {
  arrayRemove,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  Timestamp,
  updateDoc,
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import { newInviteCode, type GroupDoc, type GroupProgressDoc } from "./groups";

// Grupos en Firestore. Lo importan las pantallas de grupos (que ya van en chunks propios),
// sessionCloud.ts y, bajo demanda, groupsStore.ts: Firebase no está en el arranque.

const toIso = (ts: unknown) => (ts instanceof Timestamp ? ts.toDate().toISOString() : new Date(0).toISOString());
const report = (err: unknown) => console.error("[groups]", err);

export const groupConverter: FirestoreDataConverter<GroupDoc> = {
  toFirestore: ({ id: _id, ...g }: GroupDoc) => ({ ...g, createdAt: Timestamp.fromDate(new Date(g.createdAt)) }),
  fromFirestore: (snap: QueryDocumentSnapshot<DocumentData>) => {
    const d = snap.data();
    return {
      ...d,
      id: snap.id,
      members: d.members ?? {},
      memberUids: d.memberUids ?? [],
      memberNames: d.memberNames ?? {},
      createdAt: toIso(d.createdAt),
    } as GroupDoc;
  },
};

const progressConverter: FirestoreDataConverter<GroupProgressDoc> = {
  toFirestore: (p: GroupProgressDoc) => p,
  fromFirestore: (snap: QueryDocumentSnapshot<DocumentData>) => {
    const d = snap.data();
    return {
      watchedBy: Object.fromEntries(Object.entries(d.watchedBy ?? {}).map(([uid, ts]) => [uid, toIso(ts)])),
      watchedTogether: Boolean(d.watchedTogether),
      updatedAt: toIso(d.updatedAt),
    };
  },
};

export const groupsCollection = () => collection(db, "groups").withConverter(groupConverter);
const progressCollection = (groupId: string) => collection(db, "groups", groupId, "progress").withConverter(progressConverter);

/**
 * Progreso compartido de un grupo, en vivo. Si la lectura falla (el grupo recién creado aún
 * no llegó al servidor, o la membresía se está propagando) reintenta unas veces.
 */
export function subscribeGroupProgress(groupId: string, onChange: (p: Record<string, GroupProgressDoc>) => void): () => void {
  let unsub: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let attempts = 0;
  let stopped = false;
  const start = () => {
    unsub = onSnapshot(
      progressCollection(groupId),
      (snap) => {
        attempts = 0;
        onChange(Object.fromEntries(snap.docs.map((d) => [d.id, d.data()])));
      },
      (err) => {
        if (stopped || ++attempts > 5) return report(err);
        timer = setTimeout(start, 1000 * attempts);
      },
    );
  };
  start();
  return () => {
    stopped = true;
    clearTimeout(timer);
    unsub?.();
  };
}

export function createGroup(owner: { uid: string; profileId: string; name: string }, data: { name: string; franchiseId: string; routeId?: string }): string {
  const ref = doc(groupsCollection());
  const group: GroupDoc = {
    id: ref.id,
    name: data.name.trim().slice(0, 40),
    ownerUid: owner.uid,
    members: { [owner.uid]: owner.profileId },
    memberUids: [owner.uid],
    memberNames: { [owner.uid]: owner.name },
    franchiseId: data.franchiseId,
    routeId: data.routeId,
    inviteCode: newInviteCode(),
    createdAt: new Date().toISOString(),
  };
  setDoc(ref, group).catch(report);
  return ref.id;
}

export function regenerateInvite(groupId: string) {
  updateDoc(doc(db, "groups", groupId), { inviteCode: newInviteCode() }).catch(report);
}

/** Salir (uno mismo) o sacar a alguien (el dueño). */
export function removeMember(groupId: string, uid: string) {
  updateDoc(doc(db, "groups", groupId), {
    [`members.${uid}`]: deleteField(),
    [`memberNames.${uid}`]: deleteField(),
    memberUids: arrayRemove(uid),
  }).catch(report);
}

export async function deleteGroup(groupId: string) {
  const progress = await getDocs(progressCollection(groupId));
  await Promise.all(progress.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(doc(db, "groups", groupId));
}

/**
 * Marca o desmarca "lo vimos juntos". Si el documento ya existe se actualiza solo ese campo:
 * un merge con watchedBy vacío borraría las marcas de los demás (y las reglas lo impiden).
 */
export function setWatchedTogether(groupId: string, titleId: string, value: boolean, exists: boolean) {
  const ref = doc(db, "groups", groupId, "progress", titleId);
  (exists
    ? updateDoc(ref, { watchedTogether: value, updatedAt: Timestamp.now() })
    : setDoc(ref, { watchedBy: {}, watchedTogether: value, updatedAt: Timestamp.now() })
  ).catch(report);
}

/** Publica o quita lo visto por este miembro (ver mirrorChanges). */
export function publishWatched(groupId: string, uid: string, changes: { add: Record<string, string>; remove: string[] }) {
  for (const [titleId, at] of Object.entries(changes.add)) {
    setDoc(
      doc(db, "groups", groupId, "progress", titleId),
      { watchedBy: { [uid]: Timestamp.fromDate(new Date(at)) }, updatedAt: Timestamp.now() },
      { merge: true },
    ).catch(report);
  }
  for (const titleId of changes.remove) {
    updateDoc(doc(db, "groups", groupId, "progress", titleId), { [`watchedBy.${uid}`]: deleteField(), updatedAt: Timestamp.now() }).catch(report);
  }
}

export async function joinGroup(groupId: string, code: string, profileId: string, name: string): Promise<"ok" | "invalid" | "full" | "rateLimited" | "error"> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) return "error";
  const res = await fetch("/api/groups/join", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ groupId, code, profileId, name }),
  }).catch(() => null);
  if (!res) return "error";
  if (res.ok) return "ok";
  if (res.status === 404) return "invalid";
  if (res.status === 409) return "full";
  if (res.status === 429) return "rateLimited";
  return "error";
}
