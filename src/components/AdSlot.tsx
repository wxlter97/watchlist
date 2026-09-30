import { useEffect, useRef } from "react";

// Espacio para anuncios (AdSense). Sin VITE_ADS_CLIENT no renderiza nada ni carga ningún
// script, así que la app no cambia hasta que se configuren. Con él, reserva la altura del
// anuncio (sin saltos de layout) y carga el script una sola vez, al primer uso.
//
// Antes de activarlos: política de privacidad, aviso de cookies/consentimiento (UE/UK) y
// `public/ads.txt` con el ID del editor. Ver README, "Anuncios".

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
  useEffect(() => {
    if (!CLIENT || pushed.current) return;
    pushed.current = true;
    loadScript(CLIENT);
    try {
      (window.adsbygoogle ??= []).push({});
    } catch {
      // Bloqueador de anuncios: el espacio queda vacío.
    }
  }, []);

  if (!CLIENT) return null;
  return (
    <aside aria-label="Publicidad" className="my-8 overflow-hidden" style={{ minHeight }}>
      <ins className="adsbygoogle block" style={{ display: "block" }} data-ad-client={CLIENT} data-ad-slot={slot} data-ad-format="auto" data-full-width-responsive="true" />
    </aside>
  );
}
