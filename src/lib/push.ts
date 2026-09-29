import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db, firebaseApp } from "./firebase";

// Web Push con FCM (SPEC §9.6). El permiso se pide solo tras una acción del usuario. En iOS
// funciona únicamente con la PWA instalada en la pantalla de inicio (iOS 16.4+).

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;
const TOKEN_KEY = "watch-order:push-token";

export type PushSupport = "ok" | "unconfigured" | "unsupported" | "ios-install" | "denied";

export function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function pushSupport(): PushSupport {
  if (!VAPID_KEY) return "unconfigured";
  const capable = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (isIos() && !isStandalone()) return "ios-install";
  if (!capable) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  return "ok";
}

function platform(): string {
  if (isIos()) return "ios";
  if (/Android/.test(navigator.userAgent)) return "android";
  return "web";
}

/**
 * Pide permiso (si hace falta), obtiene el token de FCM y registra el dispositivo en
 * users/{uid}/devices/{token}. Devuelve false si el usuario no dio permiso.
 */
export async function enablePush(uid: string): Promise<boolean> {
  if (pushSupport() !== "ok") return false;
  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") return false;

  // Service worker propio para los avisos (scope separado del de la PWA).
  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/firebase-cloud-messaging-push-scope" });
  const { getMessaging, getToken } = await import("firebase/messaging");
  const token = await getToken(getMessaging(firebaseApp), { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
  if (!token) return false;

  await setDoc(
    doc(db, "users", uid, "devices", token),
    { platform: platform(), createdAt: serverTimestamp(), lastSeenAt: serverTimestamp() },
    { merge: true },
  );
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Sin almacenamiento: el dispositivo queda registrado igual.
  }
  return true;
}

/** Deja de recibir avisos en este dispositivo (cuando se apagan todos los tipos). */
export async function disablePush(uid: string) {
  let token: string | null = null;
  try {
    token = localStorage.getItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Nada guardado.
  }
  if (!token) return;
  await deleteDoc(doc(db, "users", uid, "devices", token)).catch(() => undefined);
  const { getMessaging, deleteToken } = await import("firebase/messaging");
  await deleteToken(getMessaging(firebaseApp)).catch(() => undefined);
}

export function hasPushToken(): boolean {
  try {
    return Boolean(localStorage.getItem(TOKEN_KEY));
  } catch {
    return false;
  }
}
