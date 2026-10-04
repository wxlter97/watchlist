/// <reference types="vitest/config" />
import { existsSync, readdirSync, readFileSync } from "node:fs";
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
 * El catálogo se sirve por partes para que el arranque no crezca con cada franquicia nueva
 * (src/lib/catalog.ts lo consume). Los JSON de src/data/ siguen siendo la única fuente.
 *
 * - `virtual:catalog-manifest`: lo que se carga al abrir la app. Por franquicia, nombre,
 *   color, continuidades, sus títulos como `[id, continuidad, fecha]` (para el progreso del
 *   Hub) y los de otras franquicias que menciona; además los títulos próximos o en emisión
 *   (para "Próximos estrenos").
 * - `virtual:catalog-franchise/{id}`: la franquicia completa y sus títulos, sin sinopsis.
 * - `virtual:overviews/{lang}/{id}`: las sinopsis de esa franquicia en ese idioma.
 * - `virtual:catalog-loaders`: los `import()` de todo lo anterior, por id.
 */
function catalogData(): Plugin {
  type Localized = Record<string, { title: string; overview?: string }>;
  type RawTitle = {
    id: string;
    title: string;
    releaseDate: string;
    ongoing?: boolean;
    overview?: string;
    localized?: Localized;
    seasons?: { number: number; episodes: number; airDate?: string }[];
  };
  type RawFranchise = {
    id: string;
    name: unknown;
    description: unknown;
    accentColor: string;
    continuities: unknown[];
    entries: { titleId: string; continuityId: string; season?: number }[];
    orders: { type: string; titleIds?: string[] }[];
    routes: { titleIds: string[]; targetTitleId?: string }[];
  };
  const dataDir = resolve("src/data");
  const franchiseDir = join(dataDir, "franchises");
  const LANGS = ["es", "en"];

  const read = () => {
    const titles = JSON.parse(readFileSync(join(dataDir, "titles.json"), "utf8")) as RawTitle[];
    const franchises = readdirSync(franchiseDir)
      .filter((f) => f.endsWith(".json"))
      .sort()
      .map((f) => JSON.parse(readFileSync(join(franchiseDir, f), "utf8")) as RawFranchise);
    return { titles, titlesById: new Map(titles.map((t) => [t.id, t])), franchises };
  };
  // Sin sinopsis y solo con los títulos localizados distintos del original (titleName cae a él).
  const lite = ({ overview: _overview, localized, ...t }: RawTitle) => {
    const names = Object.entries(localized ?? {}).filter(([, v]) => v.title && v.title !== t.title);
    return names.length ? { ...t, localized: Object.fromEntries(names.map(([l, v]) => [l, { title: v.title }])) } : t;
  };
  // Todo título que la franquicia menciona: entries, órdenes curados y rutas (que pueden cruzar).
  // Órdenes y rutas pueden nombrar una temporada ("loki-2021#2"): cuenta el título.
  const titleOf = (key: string) => key.replace(/#\d+$/, "");
  const titleIdsOf = (f: RawFranchise) =>
    new Set([
      ...f.entries.map((e) => e.titleId),
      ...f.orders.flatMap((o) => o.titleIds ?? []).map(titleOf),
      ...f.routes.flatMap((r) => [...r.titleIds, ...(r.targetTitleId ? [r.targetTitleId] : [])]).map(titleOf),
    ]);
  // Estreno de una entry: el de su temporada, si es de una (como unitReleaseDate en units.ts).
  const entryDate = (t: RawTitle | undefined, season?: number) => {
    if (!t) return "";
    if (season === undefined) return t.releaseDate;
    const airDate = t.seasons?.find((s) => s.number === season)?.airDate;
    return airDate ?? (season > 1 && t.ongoing ? "9999-12-31" : t.releaseDate);
  };
  // JSON.parse de un string es más rápido de evaluar que un literal de objeto grande.
  const json = (data: unknown) => `export default JSON.parse(${JSON.stringify(JSON.stringify(data))});`;

  return {
    name: "watch-order-catalog-data",
    resolveId(id) {
      if (/^virtual:(catalog-manifest|catalog-loaders|catalog-franchise\/[a-z0-9-]+|overviews\/(es|en)\/[a-z0-9-]+)$/.test(id)) return `\0${id}`;
    },
    load(id) {
      if (!id.startsWith("\0virtual:")) return;
      this.addWatchFile(join(dataDir, "titles.json"));
      for (const f of readdirSync(franchiseDir)) this.addWatchFile(join(franchiseDir, f));
      const { titles, titlesById, franchises } = read();
      const name = id.slice("\0virtual:".length);

      if (name === "catalog-loaders") {
        const entry = (path: string) => `${JSON.stringify(path.split("/").at(-1))}: () => import(${JSON.stringify(`virtual:${path}`)})`;
        return [
          `export const franchises = { ${franchises.map((f) => entry(`catalog-franchise/${f.id}`)).join(", ")} };`,
          `export const overviews = { ${LANGS.map((l) => `${l}: { ${franchises.map((f) => entry(`overviews/${l}/${f.id}`)).join(", ")} }`).join(", ")} };`,
        ].join("\n");
      }

      if (name === "catalog-manifest") {
        const today = new Date().toISOString().slice(0, 10);
        return json({
          franchises: franchises.map((f) => ({
            id: f.id,
            name: f.name,
            description: f.description,
            accentColor: f.accentColor,
            continuities: f.continuities,
            // [título, continuidad, estreno] y, si la entry es de una temporada, [temporada, episodios].
            titles: f.entries.map((e) => {
              const t = titlesById.get(e.titleId);
              const base = [e.titleId, e.continuityId, entryDate(t, e.season)];
              return e.season === undefined ? base : [...base, e.season, t?.seasons?.find((s) => s.number === e.season)?.episodes ?? 0];
            }),
            // Títulos de otras franquicias que aparecen en sus rutas u órdenes curados.
            refs: [...titleIdsOf(f)].filter((tid) => !f.entries.some((e) => e.titleId === tid)),
          })),
          spotlight: titles.filter((t) => t.releaseDate >= today || t.ongoing).map(lite),
        });
      }

      const franchiseId = name.split("/").at(-1)!;
      const franchise = franchises.find((f) => f.id === franchiseId);
      if (!franchise) return json(null);
      const ids = titleIdsOf(franchise);

      if (name.startsWith("catalog-franchise/")) {
        return json({ franchise, titles: [...ids].flatMap((tid) => (titlesById.has(tid) ? [lite(titlesById.get(tid)!)] : [])) });
      }
      const lang = name.split("/")[1]!;
      return json(
        Object.fromEntries(
          [...ids].flatMap((tid) => {
            const t = titlesById.get(tid);
            const overview = t && (t.localized?.[lang]?.overview || t.overview);
            return overview ? [[tid, overview]] : [];
          }),
        ),
      );
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
      catalogData(),
      react(),
      tailwindcss(),
      VitePWA({
        registerType: "autoUpdate",
        // El registro lo hace src/lib/updates.ts: revisa versiones nuevas y recarga solo.
        injectRegister: false,
        includeAssets: ["favicon.png", "apple-touch-icon.png", "pwa-maskable-512.png"],
        manifest: {
          name: "Watch Order",
          short_name: "Watch Order",
          description: "Sigue sagas y franquicias de cine y TV en el orden que prefieras.",
          lang: "es",
          id: "/",
          start_url: "/",
          scope: "/",
          display: "standalone",
          background_color: "#111111",
          theme_color: "#111111",
          icons: [
            { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
            { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
            { src: "pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        },
        workbox: {
          // La versión nueva toma el control al instalarse, sin esperar a que se cierren las
          // pestañas (antes la app se quedaba en la versión vieja hasta cerrarla por completo).
          skipWaiting: true,
          clientsClaim: true,
          globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
          // El service worker de los avisos push se registra aparte; no va en el precache.
          globIgnores: ["firebase-messaging-sw.js"],
          navigateFallback: "/index.html",
          // El handler de Firebase Auth (/__/auth) y las funciones (/api) nunca caen en la SPA.
          // Las páginas públicas de links compartidos (/es/s/…) las arma el servidor.
          navigateFallbackDenylist: [/^\/__\//, /^\/api\//, /^\/(es|en)\/s\//],
          runtimeCaching: [
            {
              // Dónde ver y reparto: se muestra lo último conocido sin conexión y se refresca al volver.
              urlPattern: ({ url }) => url.pathname === "/api/providers" || url.pathname === "/api/upcoming" || url.pathname === "/api/credits",
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
