/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

/**
 * En desarrollo, sirve /api/* con los mismos archivos que usa Vercel (firma Web
 * `export function GET(request)`), para no depender de `vercel dev`.
 */
function apiDevServer(): Plugin {
  return {
    name: "watch-order-api-dev",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const match = /^\/api\/([a-z0-9-]+)$/.exec(url.pathname);
        if (!match) return next();
        try {
          const mod = (await server.ssrLoadModule(`/api/${match[1]}.ts`)) as Record<string, (r: Request) => Promise<Response>>;
          const handler = mod[req.method ?? "GET"];
          if (!handler) {
            res.statusCode = 405;
            return res.end();
          }
          const headers = new Headers();
          for (const [key, value] of Object.entries(req.headers)) if (typeof value === "string") headers.set(key, value);
          const response = await handler(new Request(url, { method: req.method, headers }));
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

export default defineConfig(({ mode }) => {
  // Variables sin prefijo VITE_ (TMDB_API_KEY…) solo para las funciones en desarrollo;
  // nunca entran al bundle del cliente.
  for (const [key, value] of Object.entries(loadEnv(mode, process.cwd(), ""))) process.env[key] ??= value;

  return {
    plugins: [
      apiDevServer(),
      react(),
      tailwindcss(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.png", "apple-touch-icon.png"],
        manifest: {
          name: "Watch Order",
          short_name: "Watch Order",
          description: "Sigue sagas y franquicias de cine y TV en el orden que prefieras.",
          lang: "es",
          start_url: "/",
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
          navigateFallback: "/index.html",
          // El handler de Firebase Auth (/__/auth) y las funciones (/api) nunca caen en la SPA.
          navigateFallbackDenylist: [/^\/__\//, /^\/api\//],
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
              { name: "firebase", test: /node_modules[\\/].*@?firebase/ },
              { name: "catalog", test: /src[\\/]data[\\/]/ },
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
    },
  };
});
