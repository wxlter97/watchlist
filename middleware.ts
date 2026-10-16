// Routing Middleware de Vercel, solo para la portada: "/" es el index.html estático y los archivos
// tienen prioridad sobre los rewrites de vercel.json, así que la negociación de contenido de "/"
// (Markdown para agentes, 406 si no acepta ni HTML ni Markdown) tiene que pasar por aquí. Lo
// demás sigue de largo hacia el archivo estático; el resto de páginas negocia en api/page.ts.
import { negotiate } from "./api/_lib/negotiate.js";

export const config = { matcher: "/" };

export default function middleware(request: Request): Response {
  const format = negotiate(request.headers.get("accept"));
  if (format === "html") {
    // Equivale a next() de @vercel/functions: que siga hacia el index.html estático.
    return new Response(null, { headers: { "x-middleware-next": "1" } });
  }
  const target = new URL("/api/page?type=home", request.url);
  return new Response(null, { headers: { "x-middleware-rewrite": target.toString() } });
}
