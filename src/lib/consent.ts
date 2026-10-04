import { create } from "zustand";

// Consentimiento de anuncios (Google AdSense) y analítica (Google Analytics). Solo importa si hay
// alguno configurado (VITE_ADS_CLIENT / VITE_GA_ID); sin elección, no se carga ningún script de
// terceros ni se envía nada.

export type Consent = "granted" | "denied" | undefined;

const KEY = "watch-order:consent";

/** ¿Hay anuncios configurados en este despliegue? */
export const ADS_ENABLED = Boolean(import.meta.env.VITE_ADS_CLIENT);

/** ¿Hay que pedir consentimiento? Con anuncios o con analítica configurados. */
export const CONSENT_NEEDED = ADS_ENABLED || Boolean(import.meta.env.VITE_GA_ID);

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
