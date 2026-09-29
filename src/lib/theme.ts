import { useSyncExternalStore } from "react";

// Claro u oscuro según el sistema, salvo que el usuario fije uno. El script inline de
// index.html aplica lo mismo antes del primer render para evitar el parpadeo.

export type Theme = "light" | "dark";

const STORAGE_KEY = "watch-order:theme";
const media = () => window.matchMedia("(prefers-color-scheme: dark)");

function readStored(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

export function resolveTheme(): Theme {
  return readStored() ?? (media().matches ? "dark" : "light");
}

const listeners = new Set<() => void>();

function apply() {
  const theme = resolveTheme();
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#111111" : "#F4F3EF");
  listeners.forEach((l) => l());
}

let initialized = false;
function init() {
  if (initialized) return;
  initialized = true;
  media().addEventListener("change", () => {
    if (!readStored()) apply();
  });
  apply();
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Sin almacenamiento el cambio dura solo esta sesión.
  }
  apply();
}

export function useTheme(): Theme {
  init();
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    resolveTheme,
    () => "light",
  );
}
