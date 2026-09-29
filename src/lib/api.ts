import { useEffect, useState } from "react";
import type { Title } from "./types";

// Cliente de las funciones /api (SPEC §7). Caché en memoria por URL; el service worker
// además guarda la última respuesta para mostrarla sin conexión.

export interface Provider {
  id: number;
  name: string;
  logoPath: string;
}

export interface ProvidersResponse {
  region: string;
  link: string | null;
  flatrate: Provider[];
  free: Provider[];
  ads: Provider[];
  rent: Provider[];
  buy: Provider[];
}

export interface UpcomingApiItem {
  titleId: string;
  franchiseId: string;
  date: string;
  kind: "release" | "season" | "episode";
  season?: number;
  episode?: number;
}

const cache = new Map<string, Promise<unknown>>();

async function getJson<T>(url: string): Promise<T> {
  let pending = cache.get(url) as Promise<T> | undefined;
  if (!pending) {
    pending = fetch(url).then(async (res) => {
      if (!res.ok) throw new Error(`${res.status}`);
      return (await res.json()) as T;
    });
    cache.set(url, pending);
    pending.catch(() => cache.delete(url));
  }
  return pending;
}

export type Remote<T> = { state: "loading" } | { state: "ok"; data: T } | { state: "error" };

export function useRemote<T>(url: string | null): Remote<T> {
  const [result, setResult] = useState<{ url: string | null; value: Remote<T> }>({ url, value: { state: "loading" } });
  useEffect(() => {
    if (!url) return;
    let alive = true;
    getJson<T>(url).then(
      (data) => alive && setResult({ url, value: { state: "ok", data } }),
      () => alive && setResult({ url, value: { state: "error" } }),
    );
    return () => {
      alive = false;
    };
  }, [url]);
  return result.url === url ? result.value : { state: "loading" };
}

export const providersUrl = (title: Title, region: string) =>
  `/api/providers?${new URLSearchParams({ tmdbId: String(title.tmdbId), type: title.tmdbType, region })}`;

export const upcomingUrl = (franchiseIds: string[]) =>
  franchiseIds.length ? `/api/upcoming?${new URLSearchParams({ franchise: [...franchiseIds].sort().join(",") })}` : null;
