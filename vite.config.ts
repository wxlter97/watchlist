/// <reference types="vitest/config" />
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

function readBody(req: import("node:http").IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/**
 * En desarrollo, sirve /api/* con los mismos archivos que usa Vercel (firma Web
 * `export function GET(request)`), para no depender de `vercel dev`.
 */
function apiDevServer(): Plugin {
  return {
    name: "watch-order-api-dev",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
        // Igual que el rewrite de vercel.json: /{lang}/s/{id} → /api/share?lang=&id=.
        const shared = /^\/(es|en)\/s\/([A-Za-z0-9]+)$/.exec(url.pathname);
        if (shared) {
          url.pathname = "/api/share";
          url.searchParams.set("lang", shared[1]!);
          url.searchParams.set("id", shared[2]!);
        }
        const match = /^\/api\/([a-z0-9-]+)(?:\/([^/]+))?$/.exec(url.pathname);
        if (!match) return next();
        // /api/groups/join → api/groups/join.ts si existe; si no, como el rewrite de vercel.json:
        // /api/calendar/:file → /api/calendar?file=:file.
        let file = `/api/${match[1]}.ts`;
        if (match[2] && existsSync(join(server.config.root, "api", match[1]!, `${match[2]}.ts`))) {
          file = `/api/${match[1]}/${match[2]}.ts`;
        } else if (match[2]) {
          url.searchParams.set("file", decodeURIComponent(match[2]));
        }
        try {
          const mod = (await server.ssrLoadModule(file)) as Record<string, (r: Request) => Promise<Response>>;
          const handler = mod[req.method ?? "GET"];
          if (!handler) {
            res.statusCode = 405;
            return res.end();
          }
          const headers = new Headers();
          for (const [key, value] of Object.entries(req.headers)) if (typeof value === "string") headers.set(key, value);
          const body = req.method === "GET" || req.method === "HEAD" ? undefined : await readBody(req);
          const response = await handler(new Request(url, { method: req.method, headers, body }));
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (err) {
          next(err);
        }
      });
    },
  };
}

/**
 * titles.json sin sinopsis para el arranque: son más de la mitad del archivo y solo las usa
 * el detalle de un título. `virtual:catalog-titles` trae el resto y `virtual:overviews/{lang}`
 * las sinopsis de un idioma, en un chunk aparte. titles.json sigue siendo la única fuente.
 */
function catalogSplit(): Plugin {
  const file = resolve("src/data/titles.json");
  type Raw = { id: string; overview?: string; localized?: Record<string, { title: string; overview?: string }> };
  return {
    name: "watch-order-catalog-split",
    resolveId(id) {
      if (id === "virtual:catalog-titles" || /^virtual:overviews\/(es|en)$/.test(id)) return `\0${id}`;
    },
    load(id) {
      if (!id.startsWith("\0virtual:")) return;
      this.addWatchFile(file);
      const titles = JSON.parse(readFileSync(file, "utf8")) as Raw[];
      let data: unknown;
      if (id === "\0virtual:catalog-titles") {
        data = titles.map(({ overview: _overview, localized, ...t }) =>
          localized ? { ...t, localized: Object.fromEntries(Object.entries(localized).map(([l, v]) => [l, { title: v.title }])) } : t,
        );
      } else {
        const lang = id.slice(-2);
        data = Object.fromEntries(titles.flatMap((t) => {
          const overview = t.localized?.[lang]?.overview || t.overview;
          return overview ? [[t.id, overview]] : [];
        }));
      }
      // JSON.parse de un string es más rápido de evaluar que un literal de objeto grande.
      return `export default JSON.parse(${JSON.stringify(JSON.stringify(data))});`;
    },
  };
}

export default defineConfig(({ mode }) => {
  // Variables sin prefijo VITE_ (TMDB_API_KEY…) solo para las funciones en desarrollo;
  // nunca entran al bundle del cliente.
  for (const [key, value] of Object.entries(loadEnv(mode, process.cwd(), ""))) process.env[key] ??= value;

  return {
    plugins: [
      apiDevServer(),
      catalogSplit(),
      react(),
      tailwindcss(),
      VitePWA({
        registerType: "autoUpdate",
        // El registro del service worker no bloquea el primer render.
        injectRegister: "script-defer",
        includeAssets: ["favicon.png", "apple-touch-icon.png"],
        manifest: {
          name: "Watch Order",
          short_name: "Watch Order",
          description: "Sigue sagas y franquicias de cine y TV en el orden que prefieras.",
          lang: "es",
          id: "/",
          start_url: "/",
          scope: "/",
          display: "standalone",
          background_color: "#F4F3EF",
          theme_color: "#111111",
          icons: [
            { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
            { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
            { src: "pwa-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
          // El service worker de los avisos push se registra aparte; no va en el precache.
          globIgnores: ["firebase-messaging-sw.js"],
          navigateFallback: "/index.html",
          // El handler de Firebase Auth (/__/auth) y las funciones (/api) nunca caen en la SPA.
          // Las páginas públicas de links compartidos (/es/s/…) las arma el servidor.
          navigateFallbackDenylist: [/^\/__\//, /^\/api\//, /^\/(es|en)\/s\//],
          runtimeCaching: [
            {
              // Dónde ver: se muestra lo último conocido sin conexión y se refresca al volver.
              urlPattern: ({ url }) => url.pathname === "/api/providers" || url.pathname === "/api/upcoming",
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "api",
                expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 7 },
                cacheableResponse: { statuses: [200] },
              },
            },
            {
              // Pósters de TMDB: nunca cambian para una misma ruta.
              urlPattern: ({ url }) => url.origin === "https://image.tmdb.org",
              handler: "CacheFirst",
              options: {
                cacheName: "tmdb-posters",
                expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 90 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
      }),
    ],
    build: {
      // El chunk de Firebase (Firestore con caché persistente) ronda los 620 kB por sí solo.
      chunkSizeWarningLimit: 650,
      rolldownOptions: {
        output: {
          // Firebase y el catálogo cambian a otro ritmo que el código: chunks propios, caché aparte.
          codeSplitting: {
            groups: [
              // Messaging solo se carga al activar avisos: queda fuera del chunk de Firebase.
              { name: "firebase", test: /^(?!.*messaging).*node_modules[\\/].*@?firebase/ },
              // Los recaps se cargan uno por uno y las sinopsis por idioma, bajo demanda.
              { name: "catalog", test: /src[\\/]data[\\/](?!recaps)|virtual:catalog-titles/ },
            ],
          },
        },
      },
    },
    test: {
      globals: true,
      environment: "jsdom",
      include: ["src/**/*.test.{ts,tsx}"],
      setupFiles: ["./src/test/setup.ts"],
      coverage: {
        // La lógica pura de lib/: el núcleo que pide el SPEC (§11, fase 9) no puede bajar del 95%.
        include: ["src/lib/**/*.ts"],
        exclude: ["src/lib/**/*.test.ts"],
        reporter: ["text-summary", "html"],
        thresholds: {
          "src/lib/{orders,planner,achievements,validateCatalog}.ts": { lines: 95, functions: 95, statements: 90, branches: 80 },
        },
      },
    },
  };
});
