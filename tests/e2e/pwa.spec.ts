import { expect, test, type Page } from "@playwright/test";

const ready = (page: Page) => page.evaluate<string>("navigator.serviceWorker.ready.then((r) => r.active.state)");

test("el manifest y sus íconos existen", async ({ request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.display).toBe("standalone");
  const purposes = manifest.icons.map((i: { purpose?: string }) => i.purpose ?? "any");
  expect(purposes).toEqual(expect.arrayContaining(["any", "maskable"]));
  for (const icon of manifest.icons) {
    const res = await request.get(`/${icon.src}`);
    expect(res.status(), icon.src).toBe(200);
    expect(res.headers()["content-type"]).toContain("image/png");
  }
});

test("arranca en español aunque el navegador esté en inglés", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tus sagas, en el orden que prefieras.");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
});

test("las páginas legales se abren", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Política de privacidad");
  await page.getByRole("link", { name: "Términos" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Términos de uso");
});

test("seguir una ruta la muestra en el Hub", async ({ page }) => {
  await page.goto("/f/marvel/r/prep-avengers-doomsday-2026");
  await page.getByRole("button", { name: /Seguir ruta/ }).click();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Tus rutas" })).toBeVisible();
  await expect(page.getByText("Prepárate para Avengers: Doomsday").first()).toBeVisible();
});

test("los niveles de 'Prepárate para…' caben en la pantalla", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/f/marvel/r/prep-avengers-doomsday-2026");
  const group = page.getByRole("radiogroup");
  const box = await group.boundingBox();
  for (const radio of await page.getByRole("radio").all()) {
    const r = (await radio.boundingBox())!;
    expect(r.x + r.width).toBeLessThanOrEqual(box!.x + box!.width + 1);
  }
});

test("sin conexión, la app instalada sigue abriendo", async ({ page, context }) => {
  await page.goto("/");
  await expect.poll(() => ready(page)).toBe("activated");
  await page.reload(); // ya con el service worker al mando
  // Visitar una franquicia con conexión para que su chunk quede en caché.
  await page.goto("/f/marvel");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tus sagas, en el orden que prefieras.");
});

test("las búsquedas recientes se guardan", async ({ page }) => {
  await page.goto("/search");
  await page.getByRole("searchbox").fill("loki");
  await expect(page.getByText(/\d+ títulos?/)).toBeVisible();
  await page.waitForTimeout(2000);
  await page.goto("/search");
  await expect(page.getByRole("heading", { name: "Búsquedas recientes" }).or(page.getByText("Búsquedas recientes"))).toBeVisible();
  await page.getByRole("button", { name: "loki", exact: true }).click();
  await expect(page.getByRole("searchbox")).toHaveValue("loki");
});
