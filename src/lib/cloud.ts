import {
  collection,
  deleteDoc,
  doc,
  setDoc,
  Timestamp,
  type DocumentData,
  type Firestore,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import type { PlanDoc } from "./plans";
import type { PlansBackend } from "./plansStore";
import type { FranchiseStateDoc, ProgressBackend, ProgressDoc } from "./progressStore";

// Rutas y conversión de documentos de Firestore (SPEC §6). En el store las fechas son ISO;
// en Firestore, Timestamp.

export interface Profile {
  id: string;
  name: string;
  avatar: string;
  color: string;
  createdAt: string;
}

export const DEFAULT_PROFILE_ID = "default";

const toTs = (iso: string | undefined) => (iso ? Timestamp.fromDate(new Date(iso)) : undefined);
const toIso = (ts: unknown) => (ts instanceof Timestamp ? ts.toDate().toISOString() : undefined);

export const progressConverter: FirestoreDataConverter<ProgressDoc> = {
  toFirestore: (p: ProgressDoc) => ({ ...p, watchedAt: toTs(p.watchedAt), updatedAt: toTs(p.updatedAt) }),
  fromFirestore: (snap: QueryDocumentSnapshot<DocumentData>) => {
    const d = snap.data();
    return {
      ...d,
      status: d.status,
      rewatchCount: d.rewatchCount ?? 0,
      watchedAt: toIso(d.watchedAt),
      updatedAt: toIso(d.updatedAt) ?? new Date(0).toISOString(),
    } as ProgressDoc;
  },
};

export const franchiseStateConverter: FirestoreDataConverter<FranchiseStateDoc> = {
  toFirestore: (f: FranchiseStateDoc) => ({ ...f, updatedAt: toTs(f.updatedAt) }),
  fromFirestore: (snap: QueryDocumentSnapshot<DocumentData>) => {
    const d = snap.data();
    return { ...d, updatedAt: toIso(d.updatedAt) ?? new Date(0).toISOString() } as FranchiseStateDoc;
  },
};

export const profileConverter: FirestoreDataConverter<Profile> = {
  toFirestore: ({ id: _id, ...p }: Profile) => ({ ...p, createdAt: toTs(p.createdAt) }),
  fromFirestore: (snap: QueryDocumentSnapshot<DocumentData>) => {
    const d = snap.data();
    return {
      id: snap.id,
      name: d.name,
      avatar: d.avatar,
      color: d.color,
      createdAt: toIso(d.createdAt) ?? new Date(0).toISOString(),
    };
  },
};

export const planConverter: FirestoreDataConverter<PlanDoc> = {
  toFirestore: ({ id: _id, ...p }: PlanDoc) => ({ ...p, createdAt: toTs(p.createdAt), updatedAt: toTs(p.updatedAt) }),
  fromFirestore: (snap: QueryDocumentSnapshot<DocumentData>) => {
    const d = snap.data();
    return {
      ...d,
      id: snap.id,
      schedule: d.schedule ?? [],
      createdAt: toIso(d.createdAt) ?? new Date(0).toISOString(),
      updatedAt: toIso(d.updatedAt) ?? new Date(0).toISOString(),
    } as PlanDoc;
  },
};

export const paths = {
  user: (db: Firestore, uid: string) => doc(db, "users", uid),
  profiles: (db: Firestore, uid: string) => collection(db, "users", uid, "profiles").withConverter(profileConverter),
  profile: (db: Firestore, uid: string, pid: string) => doc(paths.profiles(db, uid), pid),
  progress: (db: Firestore, uid: string, pid: string) =>
    collection(db, "users", uid, "profiles", pid, "progress").withConverter(progressConverter),
  franchiseState: (db: Firestore, uid: string, pid: string) =>
    collection(db, "users", uid, "profiles", pid, "franchiseState").withConverter(franchiseStateConverter),
  plans: (db: Firestore, uid: string, pid: string) =>
    collection(db, "users", uid, "profiles", pid, "plans").withConverter(planConverter),
};

const report = (err: unknown) => console.error("[sync]", err);

/**
 * Escribe en Firestore sin esperar al servidor: sin conexión la escritura queda en la cola
 * local y se sincroniza al volver. Por documento gana el último cambio (setDoc completo).
 */
export function firestoreBackend(db: Firestore, uid: string, pid: string): ProgressBackend {
  return {
    writeProgress: (titleId, data) => {
      const ref = doc(paths.progress(db, uid, pid), titleId);
      (data ? setDoc(ref, data) : deleteDoc(ref)).catch(report);
    },
    writeFranchiseState: (franchiseId, data) => {
      setDoc(doc(paths.franchiseState(db, uid, pid), franchiseId), data).catch(report);
    },
  };
}

export function firestorePlansBackend(db: Firestore, uid: string, pid: string): PlansBackend {
  return {
    writePlan: (planId, data) => {
      const ref = doc(paths.plans(db, uid, pid), planId);
      (data ? setDoc(ref, data) : deleteDoc(ref)).catch(report);
    },
  };
}
