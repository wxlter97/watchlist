import { create } from "zustand";

// Consentimiento de anuncios (Google AdSense). Solo importa si hay anuncios configurados
// (VITE_ADS_CLIENT); sin elección, no se carga ningún script publicitario.

export type Consent = "granted" | "denied" | undefined;

const KEY = "watch-order:ads-consent";

/** ¿Hay anuncios configurados en este despliegue? */
export const ADS_ENABLED = Boolean(import.meta.env.VITE_ADS_CLIENT);

function read(): Consent {
  try {
    const value = localStorage.getItem(KEY);
    return value === "granted" || value === "denied" ? value : undefined;
  } catch {
    return undefined;
  }
}

export const useConsent = create<{ consent: Consent }>()(() => ({ consent: read() }));

export function setConsent(consent: Consent) {
  useConsent.setState({ consent });
  try {
    if (consent) localStorage.setItem(KEY, consent);
    else localStorage.removeItem(KEY);
  } catch {
    // Sin almacenamiento, la elección dura la sesión.
  }
}
