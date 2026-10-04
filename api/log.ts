// POST /api/log → errores del cliente a los logs de Vercel (src/lib/errorReport.ts).
// Sin base de datos ni datos personales; se recorta todo por seguridad y no se confía en el cuerpo.
const clip = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : undefined);

/** GET /api/health (reescrito a /api/log): 200 si la función responde, para un monitor de uptime. */
export function GET(): Response {
  // `commit` dice qué versión está desplegada (Vercel lo define en cada deploy).
  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
  return new Response(JSON.stringify({ ok: true, time: new Date().toISOString(), ...(commit ? { commit } : {}) }), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const raw = await request.text();
    if (raw.length > 8_000) return new Response(null, { status: 413 });
    const body = JSON.parse(raw) as Record<string, unknown>;
    // Violaciones de la CSP en modo "report-only" (vercel.json): mismo destino, para ajustarla antes de aplicarla.
    const csp = body["csp-report"] as Record<string, unknown> | undefined;
    if (csp && typeof csp === "object") {
      console.warn(
        "[csp-report]",
        JSON.stringify({
          directive: clip(csp["violated-directive"], 80),
          blocked: clip(csp["blocked-uri"], 200),
          page: clip(csp["document-uri"], 200),
        }),
      );
      return new Response(null, { status: 204 });
    }
    console.error(
      "[client-error]",
      JSON.stringify({
        kind: clip(body.kind, 20),
        message: clip(body.message, 500),
        stack: clip(body.stack, 2_000),
        path: clip(body.path, 200),
        ua: clip(body.ua, 200),
      }),
    );
    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 400 });
  }
}
