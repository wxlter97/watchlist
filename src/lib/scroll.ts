import { useEffect } from "react";
import { useNavigationType } from "react-router";

// Dónde estabas en cada pantalla. El navegador no lo recuerda en una SPA: las páginas se
// montan de cero (y el catálogo llega después), así que al volver con "atrás" el scroll
// quedaba arriba. Se guarda la posición por entrada del historial al salir y se restaura al
// volver, esperando a que la página tenga el alto necesario.

const positions = new Map<string, number>();
let currentKey = "default";

/** La entrada del historial que está a la vista (la fija el Layout). */
export const setCurrentKey = (key: string) => {
  currentKey = key;
};

// Mientras se restaura una posición, los cambios de scroll no son de la persona (la página
// aún no tiene su alto): no se guardan, o pisarían la posición que se está restaurando.
let restoring = false;

/**
 * Guarda el scroll de la entrada actual mientras la persona se desplaza. En un clic se guarda
 * también, por si se sale antes de que llegue el último evento de scroll. No se guarda en
 * `popstate`: el router ya cambió de entrada cuando ese evento llega a un listener del Layout.
 */
export function trackScroll(): () => void {
  const save = () => {
    if (!restoring) positions.set(currentKey, window.scrollY);
  };
  addEventListener("scroll", save, { passive: true });
  addEventListener("click", save, true);
  return () => {
    removeEventListener("scroll", save);
    removeEventListener("click", save, true);
  };
}

export const savedScroll = (key: string) => positions.get(key);

/**
 * Lleva el scroll a `y` en cuanto el documento sea lo bastante alto (la página y el catálogo
 * pueden tardar en llegar). Se rinde a los 5 s o si la persona empieza a desplazarse.
 * Devuelve la función que lo cancela.
 */
export function restoreScroll(y: number): () => void {
  restoring = true;
  const stop = () => {
    restoring = false;
    clearInterval(timer);
    clearTimeout(giveUp);
    for (const type of ["wheel", "touchstart", "keydown"]) removeEventListener(type, stop);
  };
  const attempt = () => {
    if (document.documentElement.scrollHeight - window.innerHeight >= y - 1) {
      window.scrollTo(0, y);
      stop();
    }
  };
  const timer = setInterval(attempt, 60);
  const giveUp = setTimeout(stop, 5000);
  for (const type of ["wheel", "touchstart", "keydown"]) addEventListener(type, stop, { passive: true });
  attempt();
  return stop;
}

/**
 * Al abrir una lista con avance, lleva la vista a la fila que sigue (`id` del elemento). Solo
 * al entrar de nuevo, no al volver con "atrás" (ahí se restaura donde estabas).
 */
export function useScrollToNext(ready: boolean, elementId: string | undefined, enabled: boolean) {
  const navigationType = useNavigationType();
  useEffect(() => {
    if (!ready || !elementId || !enabled || navigationType === "POP") return;
    // Después del reinicio de scroll del Layout y de que la lista se pinte.
    const timer = setTimeout(() => document.getElementById(elementId)?.scrollIntoView({ block: "start" }), 50);
    return () => clearTimeout(timer);
    // Una vez por entrada: cambiar de orden o de filtros no vuelve a mover la vista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, Boolean(elementId), enabled]);
}

/** Salta (suave) a la fila con ese id. */
export const jumpTo = (elementId: string) =>
  document.getElementById(elementId)?.scrollIntoView({ block: "start", behavior: "smooth" });

/** Id del elemento de una fila de lista (unitKey: puede llevar `#`). */
export const rowId = (key: string) => `row-${key}`;
