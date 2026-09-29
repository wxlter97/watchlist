import { pushSupport } from "./pushSupport";
import { setNotification, useSettings } from "./settings";
import { useSession } from "./session";
import { showToast } from "./toasts";

// Ofrecer avisos de estrenos justo después de seguir una franquicia (la acción del usuario
// que justifica pedir permiso, SPEC §9.6). Una sola vez por dispositivo.

const ASKED_KEY = "watch-order:push-offered";

export function offerReleaseAlerts(t: (key: string) => string) {
  const uid = useSession.getState().user?.uid;
  if (!uid || useSettings.getState().notifications.releases) return;
  const support = pushSupport();
  if (support !== "ok" && support !== "ios-install") return;
  if (support === "ok" && Notification.permission === "denied") return;
  try {
    if (localStorage.getItem(ASKED_KEY)) return;
    localStorage.setItem(ASKED_KEY, "1");
  } catch {
    return;
  }
  if (support === "ios-install") {
    showToast({ message: t("notifications.offerIos"), duration: 10_000 });
    return;
  }
  showToast({
    message: t("notifications.offer"),
    action: {
      label: t("notifications.enable"),
      onClick: () => {
        // El permiso se pide en el mismo clic (Safari no lo permite después de una espera);
        // Firebase se carga recién después.
        const permission = Notification.permission === "granted" ? Promise.resolve("granted") : Notification.requestPermission();
        void permission
          .then((p) => (p === "granted" ? import("./push").then((m) => m.enablePush(uid)) : false))
          .catch(() => false)
          .then((ok) => {
            if (ok) setNotification("releases", true);
            else showToast({ message: t("notifications.notGranted") });
          });
      },
    },
    duration: 10_000,
  });
}
