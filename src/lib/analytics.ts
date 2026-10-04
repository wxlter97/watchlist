import { useConsent } from "./consent";

// Google Analytics 4. Solo existe si el despliegue define VITE_GA_ID y, aun así, no se descarga
// ningún script ni se envía nada hasta que la persona acepta (ConsentBanner). Sin señales de
// Google ni personalización de anuncios; no se manda cuenta, correo ni el detalle del progreso.

const ID = import.meta.env.VITE_GA_ID as string | undefined;

/** ¿Hay analítica configurada en este despliegue? */
export const ANALYTICS_ENABLED = Boolean(ID);

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let loaded = false;

function load(id: string) {
  if (loaded) return;
  loaded = true;
  window.dataLayer ??= [];
  window.gtag = function gtag() {
    // gtag.js espera el objeto `arguments`, no un arreglo.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", id, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false });
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.append(script);
}

const allowed = () => Boolean(ID) && useConsent.getState().consent === "granted";

export function track(name: string, params: Record<string, string | number | boolean> = {}) {
  if (!ID || !allowed()) return;
  load(ID);
  window.gtag?.("event", name, params);
}

export function trackPageView(path: string) {
  // El título lo fija la página después de navegar: se lee al terminar el ciclo actual.
  setTimeout(() => track("page_view", { page_path: path, page_location: `${location.origin}${path}`, page_title: document.title }), 0);
}

// Al aceptar, se cuenta la página en la que ya estás; al retirar el permiso, GA se desactiva.
useConsent.subscribe((state, previous) => {
  if (!ID) return;
  (window as unknown as Record<string, unknown>)[`ga-disable-${ID}`] = state.consent !== "granted";
  if (state.consent === "granted" && previous.consent !== "granted") trackPageView(location.pathname);
});
