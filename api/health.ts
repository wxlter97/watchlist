// GET /api/health → 200 si la función responde. Para un monitor de uptime externo.
export function GET(): Response {
  return new Response(JSON.stringify({ ok: true, time: new Date().toISOString() }), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
