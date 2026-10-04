// Si este dispositivo puede recibir avisos (SPEC §9.6), sin cargar Firebase: lo usa el aviso
// que se ofrece al seguir una franquicia. El registro con FCM está en push.ts.

export const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;
export const TOKEN_KEY = "watch-order:push-token";

export type PushSupport = "ok" | "unconfigured" | "unsupported" | "ios-install" | "denied";

export function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function isStandalone(): boolean {
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

export function platform(): string {
  if (isIos()) return "ios";
  if (/Android/.test(navigator.userAgent)) return "android";
  return "web";
}

export function hasPushToken(): boolean {
  try {
    return Boolean(localStorage.getItem(TOKEN_KEY));
  } catch {
    return false;
  }
}
