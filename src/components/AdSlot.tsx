import { useEffect, useRef } from "react";
import { useConsent } from "../lib/consent";

// Espacio para anuncios (AdSense). Sin VITE_ADS_CLIENT no renderiza nada ni carga ningún
// script, así que la app no cambia hasta que se configuren. Con él, reserva la altura del
// anuncio (sin saltos de layout) y carga el script una sola vez, al primer uso.
//
// Solo se muestra (y el script solo se carga) con consentimiento (ConsentBanner). Antes de
// activarlos falta `public/ads.txt` con el ID del editor. Ver README, "Anuncios".

const CLIENT = import.meta.env.VITE_ADS_CLIENT as string | undefined;

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

let scriptLoaded = false;
function loadScript(client: string) {
  if (scriptLoaded) return;
  scriptLoaded = true;
  const script = document.createElement("script");
  script.async = true;
  script.crossOrigin = "anonymous";
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
  document.head.append(script);
}

/** `slot` es el ID de bloque de anuncios de AdSense. Usar en páginas de lectura, nunca sobre controles. */
export function AdSlot({ slot, minHeight = 100 }: { slot: string; minHeight?: number }) {
  const pushed = useRef(false);
  const granted = useConsent((s) => s.consent === "granted");
  useEffect(() => {
    if (!CLIENT || !slot || !granted || pushed.current) return;
    // El script de anuncios pesa mucho: espera a que la página termine de cargar y a un momento
    // libre, para no tocar LCP ni el tiempo de bloqueo.
    const start = () => {
      if (pushed.current) return;
      pushed.current = true;
      loadScript(CLIENT);
      try {
        (window.adsbygoogle ??= []).push({});
      } catch {
        // Bloqueador de anuncios: el espacio queda vacío.
      }
    };
    const idle = () => ("requestIdleCallback" in window ? requestIdleCallback(start, { timeout: 4000 }) : setTimeout(start, 1500));
    if (document.readyState === "complete") idle();
    else addEventListener("load", idle, { once: true });
    return () => removeEventListener("load", idle);
  }, [granted, slot]);

  if (!CLIENT || !slot || !granted) return null;
  return (
    <aside aria-label="Publicidad" className="my-8 overflow-hidden" style={{ minHeight }}>
      <ins className="adsbygoogle block" style={{ display: "block" }} data-ad-client={CLIENT} data-ad-slot={slot} data-ad-format="auto" data-full-width-responsive="true" />
    </aside>
  );
}
