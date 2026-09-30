import { registerSW } from "virtual:pwa-register";

// Versiones nuevas sin esperar: el service worker se actualiza solo (skipWaiting + clientsClaim
// en vite.config.ts) y aquí se le pregunta por una versión nueva al abrir, al volver a la app
// y cada 30 minutos; con registerType "autoUpdate" la página se recarga cuando la toma.

const CHECK_EVERY_MS = 30 * 60_000;

export function startUpdates() {
  if (!import.meta.env.PROD) return;
  registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => {
        if (navigator.onLine) void registration.update().catch(() => undefined);
      };
      setInterval(check, CHECK_EVERY_MS);
      document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && check());
      addEventListener("online", check);
    },
  });
}
