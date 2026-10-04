import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Viajes críticos como invitado (sin Firebase): lo que una persona hace de verdad. El login con
// Google, el borrado de cuenta y la sincronización entre dispositivos necesitan Firebase y se
// cubren con las pruebas de reglas (pnpm test:rules) y la lista manual de docs/RELEASE.md.

const watchToggle = (page: Page, title: string) => page.getByRole("button", { name: `Marcar ${title} como visto` }).first();
const unwatchToggle = (page: Page, title: string) => page.getByRole("button", { name: `Quitar ${title} de vistos` }).first();

test("marcar un título como visto se guarda y sobrevive a recargar", async ({ page }) => {
  await page.goto("/f/saw");
  await expect(page.getByText("0 de 10 vistos")).toBeVisible();
  await watchToggle(page, "Juego macabro").click();
  await expect(page.getByText("1 de 10 vistos")).toBeVisible();
  await page.reload();
  await expect(page.getByText("1 de 10 vistos")).toBeVisible();
  await expect(unwatchToggle(page, "Juego macabro")).toHaveAttribute("aria-pressed", "true");
});

test("pulsar dos veces rápido no deja un estado a medias", async ({ page }) => {
  await page.goto("/f/saw");
  await watchToggle(page, "Juego macabro").dblclick();
  // Dos toques = marcar y desmarcar: vuelve a 0, sin quedar a medias.
  await expect(page.getByText("0 de 10 vistos")).toBeVisible();
  await expect(watchToggle(page, "Juego macabro")).toHaveAttribute("aria-pressed", "false");
});

test("seguir una franquicia la pone en 'Tus franquicias' del Hub", async ({ page }) => {
  await page.goto("/f/saw");
  await page.getByRole("button", { name: "+ Seguir" }).first().click();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Tus franquicias" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Saw", level: 3 }).first()).toBeVisible();
});

test("el progreso sigue al orden elegido y muestra aparte el de toda la franquicia", async ({ page }) => {
  await page.goto("/f/die-hard");
  await watchToggle(page, "Duro de matar").click();
  await page.getByRole("radio", { name: "Las tres clásicas" }).click();
  await expect(page.getByText("Orden: Las tres clásicas")).toBeVisible();
  await expect(page.getByText("1 de 3 vistos")).toBeVisible();
  await expect(page.getByText(/Toda la franquicia: 20 % · 1 de 5 vistos/)).toBeVisible();
});

test("buscar una saga muestra su tarjeta con progreso", async ({ page }) => {
  await page.goto("/search");
  await page.getByRole("searchbox").fill("saw");
  const card = page.getByRole("heading", { name: "Saw", level: 3 });
  await expect(card).toBeVisible();
  await card.click();
  await expect(page).toHaveURL(/\/f\/saw$/);
});

test("una búsqueda sin resultados explica qué probar", async ({ page }) => {
  await page.goto("/search?q=zzzzqq");
  await expect(page.getByText(/Nada coincide con «zzzzqq»\. Prueba con menos letras/)).toBeVisible();
});

test("direcciones que no existen explican qué pasó y a dónde ir", async ({ page }) => {
  await page.goto("/algo-que-no-existe");
  await expect(page.getByRole("heading", { name: "Página no encontrada" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
  await page.getByRole("link", { name: "Ir al inicio" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tus sagas, en el orden que prefieras.");

  await page.goto("/f/no-existe");
  await expect(page.getByText(/No encontramos esa franquicia\. Puede que el link esté mal escrito/)).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Buscar" })).toBeVisible();
});

test("el detalle de un título cambia a Reparto y vuelve", async ({ page }) => {
  await page.goto("/t/saw-2004");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("radio", { name: "Reparto" }).click();
  await expect(page.getByRole("heading", { name: "Reparto" })).toBeVisible();
  // Sin funciones /api en el servidor de pruebas, el reparto explica que no se pudo cargar.
  await expect(page.getByText(/No se pudo cargar esta información/).filter({ visible: true })).toBeVisible();
  await page.getByRole("radio", { name: "Detalles" }).click();
  await expect(page.getByRole("heading", { name: "Sinopsis" })).toBeVisible();
});

test("las URLs en inglés abren la app en inglés, con canonical propio", async ({ page }) => {
  await page.goto("/en/f/saw");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page).toHaveTitle("Saw: what order to watch | Watch Order");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/en\/f\/saw$/);
  await page.goto("/en/account");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
});

// Lo que hace Chrome cuando la PWA se puede instalar (el navegador de pruebas no lo dispara solo).
const installable = (page: Page) =>
  page.evaluate(`(() => {
    const e = new Event("beforeinstallprompt", { cancelable: true });
    e.prompt = async () => undefined;
    e.userChoice = Promise.resolve({ outcome: "dismissed" });
    window.dispatchEvent(e);
  })()`);

test("el recordatorio de instalar aparece, se pospone y no vuelve enseguida", async ({ page }) => {
  await page.goto("/");
  await installable(page);
  await expect(page.getByText("Instala Watch Order")).toBeVisible();
  await page.getByRole("button", { name: "Más tarde" }).click();
  await expect(page.getByText("Instala Watch Order")).toBeHidden();
  await page.reload();
  await installable(page);
  await expect(page.getByText("Instala Watch Order")).toBeHidden();
});

test("exportar y volver a importar el respaldo devuelve el progreso", async ({ page }) => {
  await page.goto("/f/saw");
  await watchToggle(page, "Juego macabro").click();
  await expect(page.getByText("1 de 10 vistos")).toBeVisible();

  await page.goto("/account");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Exportar", exact: true }).click()]);
  const path = await download.path();
  const backup = JSON.parse(readFileSync(path, "utf8"));
  expect(backup.app).toBe("watch-order");
  expect(Object.keys(backup.progress)).toContain("saw-2004");

  // Se pierde todo en este dispositivo y se restaura desde el archivo.
  await page.evaluate("localStorage.clear()");
  await page.goto("/f/saw");
  await expect(page.getByText("0 de 10 vistos")).toBeVisible();
  await page.goto("/account");
  await page.locator('input[type="file"]').setInputFiles(path);
  await page.getByRole("dialog").getByRole("button", { name: "Importar" }).click();
  await page.goto("/f/saw");
  await expect(page.getByText("1 de 10 vistos")).toBeVisible();
});

test("'Exportar todos mis datos' baja un archivo con progreso, ajustes y logros", async ({ page }) => {
  await page.goto("/f/saw");
  await watchToggle(page, "Juego macabro").click();
  await page.goto("/account");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Exportar todos mis datos" }).click()]);
  expect(download.suggestedFilename()).toContain("todos-mis-datos");
  const all = JSON.parse(readFileSync((await download.path())!, "utf8"));
  expect(all.app).toBe("watch-order-export");
  expect(all.settings).toBeTruthy();
  expect(Object.keys(all.progress)).toContain("saw-2004");
  expect(all.account).toBeNull();
});
