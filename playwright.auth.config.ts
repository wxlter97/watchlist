import { defineConfig } from "@playwright/test";

// Viajes con cuenta contra los emuladores de Firebase (Auth + Firestore, con las reglas reales):
// login, sincronización entre dispositivos, cerrar sesión y eliminar la cuenta. Requiere Java 21+
// y firebase-tools (npm i -g firebase-tools). Aparte de `pnpm test:e2e` (que corre como invitado).
//   pnpm test:e2e:auth
const PROJECT = "demo-watch-order";
const BUILD_ENV = [
  "VITE_FIREBASE_EMULATORS=1",
  "VITE_FIREBASE_API_KEY=demo-key",
  "VITE_FIREBASE_AUTH_DOMAIN=localhost",
  `VITE_FIREBASE_PROJECT_ID=${PROJECT}`,
  "VITE_FIREBASE_APP_ID=1:1:web:1",
].join(" ");

export default defineConfig({
  testDir: "tests/auth",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  // Comparten los emuladores: una a la vez.
  workers: 1,
  reporter: "list",
  use: { baseURL: "http://localhost:4174", locale: "en-US", launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {} },
  webServer: [
    {
      command: `firebase emulators:start --only auth,firestore --project ${PROJECT}`,
      url: "http://localhost:9099",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `${BUILD_ENV} pnpm exec vite build --outDir dist-auth && pnpm exec vite preview --outDir dist-auth --port 4174 --strictPort`,
      url: "http://localhost:4174",
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
