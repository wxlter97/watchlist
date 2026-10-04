import { create } from "zustand";
import { FIREBASE_CONFIGURED } from "./firebaseConfig";
import { track } from "./analytics";
import type { Profile } from "./cloud";
import {
  guestAchievementsBackend,
  loadGuestAchievements,
  setAchievementsBackend,
  useAchievementsStore,
} from "./achievementsStore";
import { useGroupsStore } from "./groupsStore";
import { guestPlansBackend, loadGuestPlans, setPlansBackend, usePlansStore } from "./plansStore";
import { guestBackend, loadGuest, setBackend, useProgressStore } from "./progressStore";
import { guestSettingsWriter, loadGuestSettings, setSettingsWriter, useSettings } from "./settings";
import { useSharesStore } from "./sharesStore";

// Sesión: invitado (progreso en localStorage) o cuenta de Google (Firestore con caché offline),
// con varios perfiles por cuenta (SPEC §5).
//
// Este módulo no importa Firebase: como invitado la app arranca sin descargarlo. La parte de
// la cuenta vive en sessionCloud.ts y se carga si este dispositivo tiene una cuenta iniciada
// (lo recuerda ACCOUNT_KEY) o cuando el usuario inicia sesión.

export interface SessionUser {
  uid: string;
  displayName: string;
  email: string | null;
  photoURL: string | null;
}

interface SessionState {
  status: "loading" | "guest" | "signedIn";
  user?: SessionUser;
  profiles: Profile[];
  activeProfileId?: string;
  /** Ya llegó el primer snapshot del progreso del perfil activo. */
  profileReady: boolean;
  /** Progreso de invitado que se puede pasar al perfil activo. */
  migration: { count: number } | null;
  authError?: string;
}

export const useSession = create<SessionState>()(() => ({
  status: "loading",
  profiles: [],
  profileReady: false,
  migration: null,
}));

const report = (err: unknown) => console.error("[session]", err);

// ---- Recordar que hay una cuenta en este dispositivo ----

const ACCOUNT_KEY = "watch-order:account";

function hasAccountHint(): boolean {
  try {
    return localStorage.getItem(ACCOUNT_KEY) === "1";
  } catch {
    // Sin almacenamiento no se puede saber: se carga Firebase por si acaso.
    return true;
  }
}

export function setAccountHint() {
  try {
    localStorage.setItem(ACCOUNT_KEY, "1");
  } catch {
    // Sin almacenamiento, hasAccountHint ya devuelve true.
  }
}

export function clearAccountHint() {
  try {
    localStorage.removeItem(ACCOUNT_KEY);
  } catch {
    // Nada que borrar.
  }
}

// ---- Arranque ----

let cloudModule: Promise<typeof import("./sessionCloud")> | undefined;

/** Carga la parte con Firebase y empieza a escuchar Auth (una sola vez). */
function cloud() {
  cloudModule ??= import("./sessionCloud").then((m) => {
    m.startAuth();
    return m;
  });
  return cloudModule;
}

/** Adelanta la descarga de Firebase donde es probable iniciar sesión (Cuenta, invitación). */
export function preloadAccount() {
  if (!FIREBASE_CONFIGURED) return;
  void cloud().catch(report);
}

let started = false;

/** Arranca una sola vez, desde main.tsx. */
export function startSession() {
  if (started) return;
  started = true;
  if (FIREBASE_CONFIGURED && hasAccountHint()) void cloud().catch(report);
  else enterGuest();
}

export function enterGuest() {
  setBackend(guestBackend);
  setSettingsWriter(guestSettingsWriter);
  useSettings.setState(loadGuestSettings());
  useProgressStore.getState().replace(loadGuest());
  useSharesStore.setState({ shares: [] });
  useGroupsStore.setState({ groups: [], loaded: true });
  setPlansBackend(guestPlansBackend);
  usePlansStore.getState().replacePlans(loadGuestPlans());
  setAchievementsBackend(guestAchievementsBackend);
  useAchievementsStore.getState().replaceUnlocked(loadGuestAchievements());
  useSession.setState({ status: "guest", user: undefined, profiles: [], activeProfileId: undefined, profileReady: true, migration: null });
}

// ---- Migración invitado → cuenta (SPEC §5) ----

let migrationDismissed = false;

export const isMigrationDismissed = () => migrationDismissed;

export function dismissMigration() {
  migrationDismissed = true;
  useSession.setState({ migration: null });
}

// ---- Acciones de la cuenta (en sessionCloud.ts) ----

export function migrateGuestProgress() {
  cloud().then((m) => m.migrateGuestProgress(), report);
}

export function selectProfile(pid: string) {
  cloud().then((m) => m.selectProfile(pid), report);
}

export function createProfile(name: string) {
  cloud().then((m) => m.createProfile(name), report);
}

export function renameProfile(pid: string, name: string) {
  cloud().then((m) => m.renameProfile(pid, name), report);
}

/** Borra un perfil y todo su progreso. Nunca el último. */
export async function deleteProfile(pid: string) {
  return (await cloud()).deleteProfile(pid);
}

/** Login con Google: popup, o redirect en la PWA instalada y si el popup está bloqueado. */
export async function signIn() {
  track("sign_in_started");
  return (await cloud()).signIn();
}

/**
 * Cierra sesión y borra la caché local de Firestore. Devuelve "pending" si hay cambios sin
 * subir y no se forzó.
 */
export async function signOut(force = false): Promise<"pending" | "done"> {
  return (await cloud()).signOut(force);
}

/** Elimina la cuenta y todos sus datos. "reauth": hay que iniciar sesión otra vez y reintentar. */
export async function deleteAccount(): Promise<"done" | "reauth"> {
  return (await cloud()).deleteAccount();
}
