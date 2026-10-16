// Negociación de contenido de las páginas públicas (RFC 9110 §12.5.1): HTML para navegadores,
// Markdown para agentes que piden `Accept: text/markdown` (acceptmarkdown.com). Lo usan
// api/page.ts y middleware.ts (la portada es un archivo estático y no pasa por los rewrites).

export type PageFormat = "html" | "markdown";

interface Range {
  type: string;
  subtype: string;
  q: number;
}

function parseAccept(accept: string): Range[] {
  return accept
    .split(",")
    .map((part) => {
      const [media = "", ...params] = part.trim().split(";");
      const [type = "", subtype = ""] = media.trim().toLowerCase().split("/");
      const qParam = params.map((p) => p.trim().toLowerCase()).find((p) => p.startsWith("q="));
      const q = qParam ? Number(qParam.slice(2)) : 1;
      return { type, subtype, q: Number.isFinite(q) ? Math.min(Math.max(q, 0), 1) : 0 };
    })
    .filter((r) => r.type && r.subtype);
}

/** Calidad que el cliente le da a un tipo: la del rango más específico que lo cubre (o 0). */
function quality(ranges: Range[], type: string, subtype: string): { q: number; exact: boolean } {
  const exact = ranges.find((r) => r.type === type && r.subtype === subtype);
  if (exact) return { q: exact.q, exact: true };
  const partial = ranges.find((r) => r.type === type && r.subtype === "*");
  if (partial) return { q: partial.q, exact: false };
  const any = ranges.find((r) => r.type === "*" && r.subtype === "*");
  return { q: any?.q ?? 0, exact: false };
}

/**
 * Qué representación servir según el `Accept` del cliente; `null` si no acepta ninguna (406).
 * Sin `Accept` (o con `*∕*`) es HTML. Markdown gana si su calidad es mayor que la de HTML, o
 * igual pero pedido por nombre (un navegador nunca nombra text/markdown).
 */
export function negotiate(accept: string | null | undefined): PageFormat | null {
  if (!accept?.trim()) return "html";
  const ranges = parseAccept(accept);
  if (!ranges.length) return "html";
  const html = quality(ranges, "text", "html");
  const md = quality(ranges, "text", "markdown");
  if (html.q <= 0 && md.q <= 0) return null;
  if (md.q > html.q || (md.q === html.q && md.exact)) return "markdown";
  return "html";
}

export const VARY = "Accept";

/** 406 en texto plano (RFC 9110 §15.5.7): dice qué tipos sí hay. */
export function notAcceptable(): Response {
  return new Response("406 Not Acceptable. This page is available as text/html or text/markdown.\n", {
    status: 406,
    headers: { "Content-Type": "text/plain; charset=utf-8", Vary: VARY, "Cache-Control": "public, max-age=0, s-maxage=300" },
  });
}

export function markdownResponse(body: string, init: { status?: number; cacheControl: string; link?: string }): Response {
  return new Response(body, {
    status: init.status ?? 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      Vary: VARY,
      "Cache-Control": init.cacheControl,
      ...(init.link ? { Link: init.link } : {}),
    },
  });
}

const decode = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

/**
 * El HTML de las páginas públicas a Markdown. Solo cubre las etiquetas que arma api/_lib/seo.ts
 * (h1–h3, p, ul/ol/li, a, pre/code, strong, section/article): no es un conversor general.
 */
export function htmlToMarkdown(html: string, origin = ""): string {
  const abs = (href: string) => (href.startsWith("/") ? origin + href : href);
  const inline = (s: string) =>
    decode(
      s
        .replace(/<a [^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g, (_, href: string, text: string) => `[${text.replace(/<[^>]+>/g, "")}](${abs(decode(href))})`)
        .replace(/<\/?strong>/g, "**")
        .replace(/<code>([\s\S]*?)<\/code>/g, "`$1`")
        .replace(/<[^>]+>/g, ""),
    ).trim();

  const blocks: string[] = [];
  const re = /<(h[1-3]|p|ul|ol|pre)\b[^>]*>([\s\S]*?)<\/\1>/g;
  for (const m of html.matchAll(re)) {
    const [, tag, inner = ""] = m;
    if (tag === "pre") blocks.push("```\n" + decode(inner.replace(/<\/?code>/g, "")).trim() + "\n```");
    else if (tag === "ul" || tag === "ol") {
      const items = [...inner.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map((li, i) => `${tag === "ol" ? `${i + 1}.` : "-"} ${inline(li[1] ?? "")}`);
      blocks.push(items.join("\n"));
    } else if (tag?.startsWith("h")) blocks.push(`${"#".repeat(Number(tag[1]))} ${inline(inner)}`);
    else blocks.push(inline(inner));
  }
  return blocks.filter(Boolean).join("\n\n") + "\n";
}
