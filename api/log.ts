// POST /api/log → errores del cliente a los logs de Vercel (src/lib/errorReport.ts).
// Sin base de datos ni datos personales; se recorta todo por seguridad y no se confía en el cuerpo.
const clip = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : undefined);

export async function POST(request: Request): Promise<Response> {
  try {
    const raw = await request.text();
    if (raw.length > 8_000) return new Response(null, { status: 413 });
    const body = JSON.parse(raw) as Record<string, unknown>;
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
