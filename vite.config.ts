/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
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
});
