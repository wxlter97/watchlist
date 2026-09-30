// Registro de errores del cliente sin servicios externos: se envían a /api/log, que los
// escribe en los logs de Vercel. Solo mensaje, pila, ruta (sin query ni hash) y navegador.
// Nada de la cuenta ni del progreso. Máximo 5 distintos por carga de página.

const seen = new Set<string>();

export function reportError(kind: string, error: unknown) {
  if (!import.meta.env.PROD) return;
  const err = error instanceof Error ? error : new Error(String(error));
  const key = `${kind}:${err.message}`;
  if (seen.has(key) || seen.size >= 5) return;
  seen.add(key);
  const body = JSON.stringify({ kind, message: err.message, stack: err.stack, path: location.pathname, ua: navigator.userAgent });
  try {
    if (!navigator.sendBeacon?.("/api/log", new Blob([body], { type: "application/json" }))) {
      void fetch("/api/log", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => undefined);
    }
  } catch {
    // Reportar nunca debe romper la app.
  }
}

let started = false;

/** Errores no capturados y promesas rechazadas. Idempotente. */
export function startErrorReporting() {
  if (started) return;
  started = true;
  addEventListener("error", (e) => reportError("error", e.error ?? e.message));
  addEventListener("unhandledrejection", (e) => reportError("rejection", e.reason));
}
