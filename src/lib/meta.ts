import { useEffect } from "react";

// Título, descripción, canonical y robots de cada pantalla. El HTML que ve un buscador lo arma
// api/page.ts (franquicias y títulos) y vite.config.ts (portada); esto mantiene la pestaña, el
// historial y los marcadores al día cuando la app navega sola, y marca como noindex lo privado.

const DESCRIPTION = 'meta[name="description"]';

function meta(selector: string, create: () => HTMLElement): HTMLElement {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (!el) {
    el = create();
    document.head.append(el);
  }
  return el;
}

function setRobots(noindex: boolean) {
  const el = document.head.querySelector('meta[name="robots"]');
  if (noindex) {
    const tag = el ?? Object.assign(document.createElement("meta"), { name: "robots" });
    tag.setAttribute("content", "noindex");
    if (!el) document.head.append(tag);
  } else {
    el?.remove();
  }
}

function setCanonical(path: string | undefined) {
  const el = document.head.querySelector('link[rel="canonical"]');
  if (!path) return el?.remove();
  // Con el dominio configurado en el build, el canonical ya viene en el HTML: solo se ajusta la ruta.
  const base = el ? new URL(el.getAttribute("href") ?? "", location.origin).origin : location.origin;
  const tag = el ?? Object.assign(document.createElement("link"), { rel: "canonical" });
  tag.setAttribute("href", `${base}${path}`);
  if (!el) document.head.append(tag);
}

export interface PageMeta {
  title: string;
  description?: string;
  noindex?: boolean;
  /** Ruta canónica; solo las públicas (portada, franquicias, títulos, legales). */
  canonical?: string;
}

export function applyMeta({ title, description, noindex = false, canonical }: PageMeta, defaultDescription: string) {
  document.title = title;
  meta(DESCRIPTION, () => Object.assign(document.createElement("meta"), { name: "description" })).setAttribute("content", description ?? defaultDescription);
  setRobots(noindex);
  setCanonical(noindex ? undefined : canonical);
}

/** Rutas con sesión o de uso personal: no tienen nada que indexar. */
export const PRIVATE_PREFIXES = ["/account", "/plans", "/groups", "/join", "/compare", "/wrapped", "/stats", "/map", "/achievements", "/search"];

export const isPrivatePath = (pathname: string) => PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/** Fija la meta de una pantalla pública con datos propios (franquicia, título). Corre después del reinicio del Layout. */
export function usePageMeta(meta: PageMeta | undefined, defaultDescription: string) {
  const { title, description, noindex, canonical } = meta ?? {};
  useEffect(() => {
    if (title) applyMeta({ title, description, noindex, canonical }, defaultDescription);
  }, [title, description, noindex, canonical, defaultDescription]);
}
