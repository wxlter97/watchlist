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

/** La tarjeta como PNG. Un fallo de red o del servidor se reintenta una vez (arranque en frío). */
async function fetchCard(url: string): Promise<Blob> {
  let failure: Error | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok && res.headers.get("content-type")?.startsWith("image/")) return await res.blob();
      failure = new Error(`og ${res.status} ${(await res.text().catch(() => "")).slice(0, 200)}`);
      if (res.status < 500) break;
    } catch (err) {
      failure = err instanceof Error ? err : new Error(String(err));
    }
    await new Promise((r) => setTimeout(r, 800));
  }
  throw failure ?? new Error("og: sin respuesta");
}

function tryFile(blob: Blob, name: string): File | undefined {
  try {
    return new File([blob], name, { type: "image/png" });
  } catch {
    return undefined;
  }
}

export type ShareResult = "shared" | "downloaded" | "cancelled";

export async function shareCard(url: string, { title, text, fileName }: { title: string; text: string; fileName: string }): Promise<ShareResult> {
  const blob = await fetchCard(url);
  // Algunos navegadores no tienen el constructor File: sin él se descarga igual.
  const file = tryFile(blob, `${fileName}.png`);

  if (file && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text });
      return "shared";
    } catch (err) {
      if ((err as DOMException).name === "AbortError") return "cancelled";
      // Otros errores (permiso, gesto expirado): se descarga como alternativa.
    }
  }
  const href = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href, download: `${fileName}.png` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
  return "downloaded";
}
