// Capturas de la app para el manifiesto de la PWA (instalación más rica en Chrome/Android) y para
// material de lanzamiento. Con datos de ejemplo sembrados en localStorage (no toca nada real).
//   pnpm build && pnpm preview --port 4173   (en otra terminal)
//   pnpm screenshots
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:4173";
const titles = new Map((JSON.parse(readFileSync("src/data/titles.json", "utf8")) as { id: string; releaseDate: string }[]).map((t) => [t.id, t.releaseDate]));
const marvel = JSON.parse(readFileSync("src/data/franchises/marvel.json", "utf8")) as { entries: { titleId: string; continuityId: string }[] };
const today = new Date().toISOString().slice(0, 10);

// Los primeros títulos del MCU por estreno, ya vistos (el resto de continuidades está oculto por defecto): la portada y la franquicia se ven "vivas".
const watched = [...new Set(marvel.entries.filter((e) => e.continuityId === "mcu").map((e) => e.titleId))]
  .filter((id) => (titles.get(id) ?? "9999") <= today)
  .sort((a, b) => titles.get(a)!.localeCompare(titles.get(b)!))
  .slice(0, 14);
const stamp = "2026-09-01T12:00:00.000Z";
const progress = Object.fromEntries(watched.map((id) => [id, { status: "watched", rewatchCount: 0, updatedAt: stamp, watchedAt: stamp }]));

const shots = [
  { file: "narrow-home.png", path: "/", viewport: { width: 390, height: 844 }, mobile: true },
  { file: "narrow-franchise.png", path: "/f/marvel", viewport: { width: 390, height: 844 }, mobile: true },
  { file: "wide-home.png", path: "/", viewport: { width: 1280, height: 800 }, mobile: false },
  { file: "wide-franchise.png", path: "/f/marvel", viewport: { width: 1280, height: 800 }, mobile: false },
];

const browser = await chromium.launch();
for (const s of shots) {
  const ctx = await browser.newContext({ viewport: s.viewport, deviceScaleFactor: s.mobile ? 2 : 1, isMobile: s.mobile, hasTouch: s.mobile, locale: "es-MX", colorScheme: "light" });
  await ctx.addInitScript(
    ([progressJson, settingsJson]) => {
      localStorage.setItem("watch-order:guest", progressJson as string);
      localStorage.setItem("watch-order:guest-settings", settingsJson as string);
      localStorage.setItem("watch-order:lang", "es");
    },
    [JSON.stringify({ state: { progress, franchiseState: {} }, version: 1 }), JSON.stringify({ followedFranchises: ["marvel", "star-wars", "saw"] })],
  );
  const page = await ctx.newPage();
  await page.goto(BASE + s.path);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
  // Sin los avisos de logros que dispara el progreso sembrado.
  await page.addStyleTag({ content: '[aria-live="polite"] { display: none !important; }' });
  await page.screenshot({ path: `public/screenshots/${s.file}` });
  await ctx.close();
  console.log("listo", s.file);
}
await browser.close();
