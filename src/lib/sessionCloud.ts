import {
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import {
  clearIndexedDbPersistence,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  terminate,
  updateDoc,
  waitForPendingWrites,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import type { Profile } from "./cloud";
import i18n, { currentLang } from "./i18n";
import { loadGuestSettings, setSettingsWriter, useSettings, withDefaults } from "./settings";
import {
  DEFAULT_PROFILE_ID,
  firestoreAchievementsBackend,
  firestoreBackend,
  firestorePlansBackend,
  paths,
} from "./cloud";
import { loadGuestAchievements, saveGuestAchievements, setAchievementsBackend, useAchievementsStore } from "./achievementsStore";
import { loadGuestPlans, saveGuestPlans, setPlansBackend, usePlansStore } from "./plansStore";
import { planMigration, planSize } from "./migrate";
import { useSharesStore } from "./sharesStore";
import { sharesCollection } from "./sharesCloud";
import { useGroupsStore } from "./groupsStore";
import { groupsCollection } from "./groupsCloud";
import { clearAccountHint, enterGuest, isMigrationDismissed, setAccountHint, useSession } from "./session";
import { EMPTY, hasGuestData, loadGuest, saveGuest, setBackend, useProgressStore, type ProgressData } from "./progressStore";

// La parte de la sesión que usa Firebase: cuenta de Google, perfiles y Firestore con caché
// offline (SPEC §5). session.ts la carga solo si hay una cuenta en este dispositivo o al
// iniciar sesión, así el arranque como invitado no trae Firebase.

const set = useSession.setState;
const get = useSession.getState;
const report = (err: unknown) => console.error("[session]", err);

let authUnsubs: Unsubscribe[] = [];
let profileUnsubs: Unsubscribe[] = [];

const stop = (list: Unsubscribe[]) => list.splice(0).forEach((u) => u());
const activeKey = (uid: string) => `watch-order:profile:${uid}`;
const readActive = (uid: string) => {
  try {
    return localStorage.getItem(activeKey(uid));
  } catch {
    return null;
  }
};

function newProfile(id: string, name: string): Profile {
  const clean = name.trim() || "Perfil";
  return { id, name: clean, avatar: clean[0]!.toUpperCase(), color: "#FFDB00", createdAt: new Date().toISOString() };
}

let started = false;

/** Escucha el estado de Auth. Idempotente. */
export function startAuth() {
  if (started) return;
  started = true;
  getRedirectResult(auth).catch((err) => set({ authError: authErrorCode(err) }));
  onAuthStateChanged(auth, (user) => {
    if (user) return enterAccount(user);
    stop(authUnsubs);
    stop(profileUnsubs);
    clearAccountHint();
    if (get().status !== "guest") enterGuest();
  });
}

function enterAccount(user: User) {
  stop(authUnsubs);
  stop(profileUnsubs);
  setAccountHint();
  const uid = user.uid;
  const displayName = user.displayName ?? user.email ?? "Usuario";
  set({
    status: "signedIn",
    user: { uid, displayName, email: user.email, photoURL: user.photoURL },
    profiles: [],
    migration: null,
    authError: undefined,
  });

  // Ajustes: merge profundo sobre users/{uid}.settings; funciona aunque el doc aún no exista.
  setSettingsWriter((patch) => {
    setDoc(paths.user(db, uid), { settings: patch }, { merge: true }).catch(report);
  });
  // Una cuenta nueva hereda los ajustes que se eligieron como invitado.
  const guestSettings = loadGuestSettings();

  // El documento del usuario se crea una sola vez: solo si el servidor confirma que no existe.
  authUnsubs.push(
    onSnapshot(
      paths.user(db, uid),
      (snap) => {
        if (!snap.exists()) {
          useSettings.setState(guestSettings);
          if (!snap.metadata.fromCache) {
            setDoc(paths.user(db, uid), {
              displayName,
              createdAt: serverTimestamp(),
              settings: {
                ...guestSettings,
                language: guestSettings.language ?? currentLang(i18n.resolvedLanguage),
                notifications: { releases: false, streamingAvailable: false, catalogUpdates: false },
              },
            }).catch(report);
          }
          return;
        }
        const settings = withDefaults(snap.get("settings"));
        useSettings.setState(settings);
        if (settings.language && settings.language !== currentLang(i18n.resolvedLanguage)) void i18n.changeLanguage(settings.language);
      },
      report,
    ),
  );

  authUnsubs.push(
    onSnapshot(
      query(paths.profiles(db, uid), orderBy("createdAt")),
      (snap) => {
        const profiles = snap.docs.map((d) => d.data());
        if (profiles.length === 0) {
          // Primer ingreso: perfil por defecto con id fijo, así dos dispositivos no crean dos.
          if (!snap.metadata.fromCache) {
            setDoc(paths.profile(db, uid, DEFAULT_PROFILE_ID), newProfile(DEFAULT_PROFILE_ID, displayName.split(" ")[0]!)).catch(report);
          }
          return;
        }
        set({ profiles });
        if (!profiles.some((p) => p.id === get().activeProfileId)) selectProfile(profiles[0]!.id);
      },
      report,
    ),
  );

  // Links compartidos de toda la cuenta (cada uno dice de qué perfil es).
  authUnsubs.push(
    onSnapshot(
      query(sharesCollection(), where("ownerUid", "==", uid)),
      (snap) =>
        useSharesStore.setState({
          shares: snap.docs.map((d) => d.data()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
        }),
      report,
    ),
  );

  // Grupos de los que es miembro (con cualquier perfil).
  useGroupsStore.setState({ groups: [], loaded: false });
  authUnsubs.push(
    onSnapshot(
      query(groupsCollection(), where("memberUids", "array-contains", uid)),
      (snap) =>
        useGroupsStore.setState({
          groups: snap.docs.map((d) => d.data()).sort((a, b) => a.name.localeCompare(b.name)),
          loaded: true,
        }),
      report,
    ),
  );

  // No espera a la lista de perfiles: con la caché local el progreso aparece al instante.
  selectProfile(readActive(uid) ?? DEFAULT_PROFILE_ID);
}

export function selectProfile(pid: string) {
  const uid = get().user?.uid;
  if (!uid) return;
  stop(profileUnsubs);
  try {
    localStorage.setItem(activeKey(uid), pid);
  } catch {
    // Sin almacenamiento se vuelve al primer perfil en el próximo arranque.
  }
  set({ activeProfileId: pid, profileReady: false, migration: null });
  useProgressStore.getState().replace(EMPTY);
  setBackend(firestoreBackend(db, uid, pid));
  usePlansStore.getState().replacePlans({});
  setPlansBackend(firestorePlansBackend(db, uid, pid));
  useAchievementsStore.getState().replaceUnlocked({}, false);
  setAchievementsBackend(firestoreAchievementsBackend(db, uid, pid));

  const data: ProgressData = { progress: {}, franchiseState: {} };
  const loaded = { progress: false, franchiseState: false };
  const onLoaded = (part: keyof typeof loaded) => {
    useProgressStore.getState().replace({ ...data });
    loaded[part] = true;
    if (loaded.progress && loaded.franchiseState && !get().profileReady) {
      set({ profileReady: true });
      checkMigration();
    }
  };

  profileUnsubs.push(
    onSnapshot(
      paths.progress(db, uid, pid),
      (snap) => {
        data.progress = Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]));
        onLoaded("progress");
      },
      report,
    ),
    onSnapshot(
      paths.franchiseState(db, uid, pid),
      (snap) => {
        data.franchiseState = Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]));
        onLoaded("franchiseState");
      },
      report,
    ),
    onSnapshot(
      paths.plans(db, uid, pid),
      (snap) => usePlansStore.getState().replacePlans(Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]))),
      report,
    ),
    onSnapshot(
      paths.achievements(db, uid, pid),
      (snap) => useAchievementsStore.getState().replaceUnlocked(Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]))),
      report,
    ),
  );
}

// ---- Migración invitado → cuenta (SPEC §5) ----

function checkMigration() {
  if (isMigrationDismissed() || (!hasGuestData() && Object.keys(loadGuestPlans()).length === 0)) return set({ migration: null });
  const { progress, franchiseState } = useProgressStore.getState();
  const cloudPlans = usePlansStore.getState().plans;
  const guestPlans = Object.keys(loadGuestPlans()).filter((id) => !(id in cloudPlans)).length;
  const count = planSize(planMigration(loadGuest(), { progress, franchiseState })) + guestPlans;
  set({ migration: count > 0 ? { count } : null });
}

export function migrateGuestProgress() {
  const { user, activeProfileId: pid } = get();
  if (!user || !pid) return;
  const { progress, franchiseState } = useProgressStore.getState();
  const plan = planMigration(loadGuest(), { progress, franchiseState });
  const ops = [
    ...plan.progress.map(([id, d]) => (b: ReturnType<typeof writeBatch>) => b.set(doc(paths.progress(db, user.uid, pid), id), d)),
    ...plan.franchiseState.map(
      ([id, d]) => (b: ReturnType<typeof writeBatch>) => b.set(doc(paths.franchiseState(db, user.uid, pid), id), d),
    ),
    // Logros: se conservan los del invitado que el perfil no tenga, con su fecha.
    ...Object.entries(loadGuestAchievements())
      .filter(([id]) => !(id in useAchievementsStore.getState().unlocked))
      .map(([id, u]) => (b: ReturnType<typeof writeBatch>) => b.set(doc(paths.achievements(db, user.uid, pid), id), u)),
    // Los planes no se combinan: se copian los que el perfil no tenga.
    ...Object.values(loadGuestPlans())
      .filter((p) => !(p.id in usePlansStore.getState().plans))
      .map((p) => (b: ReturnType<typeof writeBatch>) => b.set(doc(paths.plans(db, user.uid, pid), p.id), p)),
  ];
  // Un batch admite 500 operaciones. Sin conexión quedan en cola igual que cualquier escritura.
  for (let i = 0; i < ops.length; i += 500) {
    const batch = writeBatch(db);
    ops.slice(i, i + 500).forEach((op) => op(batch));
    batch.commit().catch(report);
  }
  saveGuest(EMPTY);
  saveGuestPlans({});
  saveGuestAchievements({});
  set({ migration: null });
}

// ---- Perfiles ----

export function createProfile(name: string) {
  const uid = get().user?.uid;
  if (!uid) return;
  const ref = doc(paths.profiles(db, uid));
  setDoc(ref, newProfile(ref.id, name)).catch(report);
  selectProfile(ref.id);
}

export function renameProfile(pid: string, name: string) {
  const uid = get().user?.uid;
  const clean = name.trim();
  if (!uid || !clean) return;
  updateDoc(doc(db, "users", uid, "profiles", pid), { name: clean, avatar: clean[0]!.toUpperCase() }).catch(report);
}

/** Borra un perfil y todo su progreso. Nunca el último. */
export async function deleteProfile(pid: string) {
  const { user, profiles, activeProfileId } = get();
  if (!user || profiles.length <= 1) return;
  if (pid === activeProfileId) selectProfile(profiles.find((p) => p.id !== pid)!.id);
  const [progress, states, plans, achievements] = await Promise.all([
    getDocs(paths.progress(db, user.uid, pid)),
    getDocs(paths.franchiseState(db, user.uid, pid)),
    getDocs(paths.plans(db, user.uid, pid)),
    getDocs(paths.achievements(db, user.uid, pid)),
  ]);
  // El documento del perfil va al final: si algo falla a medias, el perfil sigue visible.
  const refs = [...progress.docs, ...states.docs, ...plans.docs, ...achievements.docs].map((d) => d.ref.withConverter(null));
  // Sus links públicos también: dejarían de tener dueño visible.
  for (const share of useSharesStore.getState().shares.filter((x) => x.profileId === pid)) refs.push(doc(db, "shares", share.id));
  refs.push(doc(db, "users", user.uid, "profiles", pid));
  for (let i = 0; i < refs.length; i += 500) {
    const batch = writeBatch(db);
    refs.slice(i, i + 500).forEach((r) => batch.delete(r));
    await batch.commit();
  }
}

// ---- Auth ----

function isIosStandalone() {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || (/iPad|iPhone|iPod/.test(navigator.userAgent) && matchMedia("(display-mode: standalone)").matches);
}

function authErrorCode(err: unknown): string {
  return (err as { code?: string }).code ?? "auth/unknown";
}

/** Al volver del redirect, session.ts ya sabe que tiene que cargar esta parte. */
function redirect(provider: GoogleAuthProvider) {
  setAccountHint();
  return signInWithRedirect(auth, provider);
}

/** Login con Google: popup, o redirect en la PWA instalada de iOS y si el popup está bloqueado. */
export async function signIn() {
  const provider = new GoogleAuthProvider();
  set({ authError: undefined });
  // Con emuladores también redirect: es el flujo de la PWA en iOS y funciona en navegadores
  // embebidos que no abren popups.
  if (isIosStandalone() || import.meta.env.VITE_FIREBASE_EMULATORS === "1") return redirect(provider);
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    const code = authErrorCode(err);
    if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
      return redirect(provider);
    }
    if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") set({ authError: code });
  }
}

/**
 * Cierra sesión y borra la caché local de Firestore (no deja datos de la cuenta en el
 * dispositivo). Devuelve "pending" si hay cambios sin subir y no se forzó.
 */
export async function signOut(force = false): Promise<"pending" | "done"> {
  if (!force) {
    const synced = await Promise.race([
      waitForPendingWrites(db).then(() => true),
      new Promise<boolean>((r) => setTimeout(() => r(false), 3000)),
    ]);
    if (!synced) return "pending";
  }
  clearAccountHint();
  await firebaseSignOut(auth);
  await terminate(db);
  await clearIndexedDbPersistence(db).catch(report);
  location.reload();
  return "done";
}
