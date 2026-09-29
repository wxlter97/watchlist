import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db, firebaseApp } from "./firebase";
import { platform, pushSupport, TOKEN_KEY, VAPID_KEY } from "./pushSupport";

// Web Push con FCM (SPEC §9.6). El permiso se pide solo tras una acción del usuario. En iOS
// funciona únicamente con la PWA instalada en la pantalla de inicio (iOS 16.4+).

export { hasPushToken, isIos, pushSupport, type PushSupport } from "./pushSupport";

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
