import type { Lang } from "./types";

// Tarjetas compartibles (SPEC §9.4): imagen de /api/og, compartida con la Web Share API o,
// si el navegador no puede compartir archivos, descargada.

export type CardParams =
  | { kind: "achievement"; id: string; d?: string }
  | { kind: "franchise"; id: string; n: number; h: number }
  | { kind: "stats"; h: number; t: number; r?: number; f?: string }
  | { kind: "wrapped"; y: number; h: number; t: number; f?: string; top?: string; m?: number; a: number };

/** URL de la tarjeta. Orden de parámetros fijo: misma tarjeta, misma URL, misma caché. */
export function cardUrl(params: CardParams, lang: Lang): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...params, lang })) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  return `/api/og?${search}`;
}

export type ShareResult = "shared" | "downloaded" | "cancelled";

export async function shareCard(url: string, { title, text, fileName }: { title: string; text: string; fileName: string }): Promise<ShareResult> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`og ${res.status}`);
  const blob = await res.blob();
  const file = new File([blob], `${fileName}.png`, { type: "image/png" });

  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text });
      return "shared";
    } catch (err) {
      if ((err as DOMException).name === "AbortError") return "cancelled";
      // Otros errores (permiso, gesto expirado): se descarga como alternativa.
    }
  }
  const href = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href, download: file.name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
  return "downloaded";
}
