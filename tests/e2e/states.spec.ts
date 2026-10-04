import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Lo que aparece después del "happy path": dos pestañas, red lenta o caída, el botón Atrás, un
// usuario con todo el catálogo visto y quien vuelve tras meses.

const GUEST_KEY = "watch-order:guest";
const watchButton = (page: Page, title: string) => page.getByRole("button", { name: `Marcar ${title} como visto` }).first();

/** Progreso de invitado sembrado antes de que cargue la app. */
const seed = (page: Page, progress: Record<string, unknown>) =>
  page.addInitScript(
    ([key, value]) => localStorage.setItem(key as string, value as string),
    [GUEST_KEY, JSON.stringify({ state: { progress, franchiseState: {} }, version: 1 })],
  );

test("dos pestañas: lo marcado en una aparece en la otra y no se pierde al marcar en ambas", async ({ context }) => {
  const a = await context.newPage();
  const b = await context.newPage();
  await a.goto("/f/saw");
  await b.goto("/f/saw");
  await expect(a.getByText("0 de 10 vistos")).toBeVisible();
  await expect(b.getByText("0 de 10 vistos")).toBeVisible();

  await watchButton(a, "Juego macabro").click();
  await expect(a.getByText("1 de 10 vistos")).toBeVisible();
  // La otra pestaña se entera sin recargar...
  await expect(b.getByText("1 de 10 vistos")).toBeVisible();

  // ...y lo que marca ella no borra lo de la primera.
  await b.getByRole("button", { name: /^Marcar .* como visto$/ }).first().click();
  await expect(b.getByText("2 de 10 vistos")).toBeVisible();
  await a.reload();
  await expect(a.getByText("2 de 10 vistos")).toBeVisible();
});

test("internet lento: 'dónde verlo' muestra que está cargando y luego el resultado", async ({ page }) => {
  await page.route("**/api/providers*", async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.fulfill({ json: { region: "SV", link: null, flatrate: [], free: [], ads: [], rent: [], buy: [] } });
  });
  await page.goto("/t/saw-2004");
  await expect(page.getByText("Buscando…").first()).toBeVisible();
  await expect(page.getByText(/No está en ninguna plataforma de tu región/)).toBeVisible({ timeout: 10_000 });
});

test("sin red o con un fallo del servidor: 'dónde verlo' explica qué hacer y la página sigue usable", async ({ page }) => {
  await page.route("**/api/providers*", (route) => route.abort("timedout"));
  await page.goto("/t/saw-2004");
  await expect(page.getByText(/No se pudo cargar esta información\. Revisa tu conexión/)).toBeVisible({ timeout: 10_000 });
  // Aunque falle esa consulta, el resto de la página sigue funcionando.
  await page.getByRole("radio", { name: "Visto" }).click();
  await expect(page.getByRole("radio", { name: "Visto" })).toHaveAttribute("aria-checked", "true");
});

test("el botón Atrás devuelve a la lista en el mismo punto", async ({ page }) => {
  await page.goto("/f/marvel");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.evaluate("window.scrollTo(0, 1800)");
  const before = (await page.evaluate("window.scrollY")) as number;
  expect(before).toBeGreaterThan(1000);
  // Un título que ya está a la vista (si no, Playwright desplazaría la página hasta el primero).
  const links = page.locator('a[href^="/t/"]');
  const inView = (await page.evaluate(
    `[...document.querySelectorAll('a[href^="/t/"]')].findIndex((el) => el.getBoundingClientRect().top > 100 && el.getBoundingClientRect().bottom < innerHeight)`,
  )) as number;
  expect(inView).toBeGreaterThan(-1);
  await links.nth(inView).click();
  await expect(page).toHaveURL(/\/t\//);
  await page.goBack();
  await expect(page).toHaveURL(/\/f\/marvel$/);
  await expect.poll(async () => (await page.evaluate("window.scrollY")) as number).toBeGreaterThan(before - 300);
});

test("usuario con todo el catálogo visto: la app sigue respondiendo", async ({ page }) => {
  const titles = JSON.parse(readFileSync("src/data/titles.json", "utf8")) as { id: string; releaseDate: string }[];
  const now = new Date().toISOString();
  const progress = Object.fromEntries(
    titles.filter((t) => t.releaseDate <= now.slice(0, 10)).map((t) => [t.id, { status: "watched", rewatchCount: 0, updatedAt: now, watchedAt: now }]),
  );
  expect(Object.keys(progress).length).toBeGreaterThan(500);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await seed(page, progress);

  const t0 = Date.now();
  await page.goto("/f/marvel");
  await expect(page.getByText(/100 %/).first()).toBeVisible({ timeout: 15_000 });
  await page.goto("/stats");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15_000 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(Date.now() - t0).toBeLessThan(30_000);
  expect(errors).toEqual([]);
});

test("quien vuelve tras meses ve lo que dejó empezado y lo que sigue", async ({ page }) => {
  const long = "2026-03-01T12:00:00.000Z";
  await seed(page, {
    "saw-2004": { status: "watched", rewatchCount: 0, updatedAt: long, watchedAt: long },
    "saw-ii-2005": { status: "watching", rewatchCount: 0, updatedAt: long, startedAt: long },
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Viendo ahora" })).toBeVisible();
  await expect(page.getByText("Juego macabro 2").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Continuar viendo" })).toBeVisible();
  await page.goto("/f/saw");
  await expect(page.getByText("1 de 10 vistos")).toBeVisible();
  expect(errors).toEqual([]);
});
