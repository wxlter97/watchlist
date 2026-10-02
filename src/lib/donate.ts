// Apoyo voluntario ("invítame un café"): un enlace externo de pago donde la persona elige el
// monto (por ejemplo un enlace de Wompi). La app no cobra ni procesa nada; sin el enlace
// configurado, el botón no aparece. Se configura con VITE_DONATE_URL.

const raw = import.meta.env.VITE_DONATE_URL?.trim();

/** El enlace de apoyo, solo si es una URL https válida. */
export const DONATE_URL: string | undefined = (() => {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
})();
