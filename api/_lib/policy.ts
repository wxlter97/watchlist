// Política de la API pública: versión, límite de peticiones y cabeceras que la anuncian.
//   - Versión en la ruta: /api/v1/… (las rutas sin versión, /api/…, son alias de la v1 vigente).
//   - Límite: RateLimit-Policy y RateLimit (IETF draft-ietf-httpapi-ratelimit-headers) en cada respuesta;
//     al pasarse, 429 con Retry-After. Es un contador en memoria por instancia de la función
//     (la regla de Vercel Firewall de docs/RELEASE.md es el tope duro): sirve para que un cliente
//     se modere solo, no para facturar. Solo cuenta lo que llega a la función (no lo que sirve el CDN).
//   - Deprecación: ninguna versión está deprecada. Cuando una lo esté, deprecationHeaders() añade
//     Deprecation, Sunset y Link (RFC 9745, RFC 8594) y se avisa con 6 meses de antelación.
import { apiError } from "./tmdb.js";

export const API_MAJOR = "v1";
export const API_BASE = `/api/${API_MAJOR}`;
/** Meses de aviso antes de retirar una versión; se documenta en /developers y en el OpenAPI. */
export const DEPRECATION_NOTICE_MONTHS = 6;

export const RATE_LIMIT = 60;
export const RATE_WINDOW_S = 60;
const POLICY = `"default";q=${RATE_LIMIT};w=${RATE_WINDOW_S}`;

interface Bucket {
  count: number;
  resetAt: number;
}
const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5_000;

/** Quién pide: la IP que pone el proxy de Vercel (primer valor de x-forwarded-for). */
function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "anonymous";
}

export interface RateState {
  limited: boolean;
  remaining: number;
  /** Segundos hasta que se reinicia la ventana (mínimo 1). */
  reset: number;
}

/** Cuenta una petición. `now` se puede inyectar en las pruebas. */
export function consume(request: Request, now = Date.now()): RateState {
  const key = clientKey(request);
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
      if (buckets.size >= MAX_BUCKETS) buckets.clear();
    }
    b = { count: 0, resetAt: now + RATE_WINDOW_S * 1000 };
    buckets.set(key, b);
  }
  b.count += 1;
  return { limited: b.count > RATE_LIMIT, remaining: Math.max(0, RATE_LIMIT - b.count), reset: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
}

export function resetRateLimits(): void {
  buckets.clear();
}

/** Cabeceras que se añaden a toda respuesta de la API pública. */
function apply(res: Response, state: RateState): Response {
  const out = new Response(res.body, res);
  out.headers.set("RateLimit-Policy", POLICY);
  out.headers.set("RateLimit", `"default";r=${state.remaining};t=${state.reset}`);
  out.headers.set("API-Version", API_MAJOR);
  // Que un navegador de otro origen (CORS) pueda leerlas.
  if (out.headers.get("Access-Control-Allow-Origin")) {
    out.headers.set("Access-Control-Expose-Headers", "RateLimit, RateLimit-Policy, Retry-After, API-Version, Deprecation, Sunset, Link");
  }
  return out;
}

/** Cabeceras de deprecación (RFC 9745 + RFC 8594) para cuando una versión se retire. */
export function deprecationHeaders(deprecatedAt: Date, sunsetAt: Date, successor: string): Record<string, string> {
  return {
    Deprecation: `@${Math.floor(deprecatedAt.getTime() / 1000)}`,
    Sunset: sunsetAt.toUTCString(),
    Link: `<${successor}>; rel="successor-version"`,
  };
}

/** Ejecuta un handler de la API pública con límite y cabeceras. */
export async function withPolicy(request: Request, handler: () => Response | Promise<Response>): Promise<Response> {
  const state = consume(request);
  if (state.limited) {
    const res = apply(
      apiError(429, "Demasiadas peticiones", `Limit: ${RATE_LIMIT} requests per ${RATE_WINDOW_S} seconds. Wait the seconds in Retry-After and cache responses on your side.`),
      state,
    );
    res.headers.set("Retry-After", String(state.reset));
    res.headers.set("Access-Control-Allow-Origin", "*");
    res.headers.set("Access-Control-Expose-Headers", "RateLimit, RateLimit-Policy, Retry-After, API-Version");
    res.headers.set("Cache-Control", "no-store");
    return res;
  }
  return apply(await handler(), state);
}
