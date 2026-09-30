// Búsquedas recientes: por dispositivo, en localStorage (no van a la cuenta).

const KEY = "watch-order:recent-searches";
export const MAX_RECENT = 8;

export function loadRecent(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((q): q is string => typeof q === "string").slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function save(list: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Sin almacenamiento, el historial dura lo que dure la pantalla.
  }
  return list;
}

/** La búsqueda va primero; sin duplicados (sin importar mayúsculas) y hasta MAX_RECENT. */
export function addRecent(query: string): string[] {
  const clean = query.trim().replace(/\s+/g, " ");
  if (clean.length < 2) return loadRecent();
  const rest = loadRecent().filter((q) => q.toLowerCase() !== clean.toLowerCase());
  return save([clean, ...rest].slice(0, MAX_RECENT));
}

export function removeRecent(query: string): string[] {
  return save(loadRecent().filter((q) => q !== query));
}

export const clearRecent = (): string[] => save([]);
