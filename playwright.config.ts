import { defineConfig } from "@playwright/test";

// Humo de la PWA en un navegador real: instalable, español por defecto y uso sin conexión.
// Local: CHROMIUM_PATH=/opt/pw-browsers/chromium/chrome-linux/chrome pnpm test:e2e
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:4173",
    // Un navegador en inglés: el idioma por defecto tiene que seguir siendo español.
    locale: "en-US",
    serviceWorkers: "allow",
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  webServer: {
    command: "pnpm build && pnpm preview --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
