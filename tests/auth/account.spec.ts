import { expect, test, type Browser, type Page } from "@playwright/test";

// Con cuenta (emuladores de Firebase). El login con Google se hace en la página del emulador de
// Auth: se crea (o reutiliza) una cuenta por correo.

const FIRESTORE = "http://localhost:8080/v1/projects/demo-watch-order/databases/(default)/documents";
const unwatch = (page: Page, title: string) => page.getByRole("button", { name: `Quitar ${title} de vistos` }).first();
const watch = (page: Page, title: string) => page.getByRole("button", { name: `Marcar ${title} como visto` }).first();

/** Entra con Google desde Cuenta usando el emulador; vuelve a la app con la sesión iniciada. */
async function signIn(page: Page, email: string, name: string) {
  await page.goto("/account");
  await page.getByRole("button", { name: "Entrar con Google" }).click();
  // El emulador lista las cuentas que ya existen: se elige la de este correo o se crea una.
  const existing = page.getByText(email, { exact: false });
  // Sin cuentas es un botón; con cuentas, un elemento de la lista (#add-account-button).
  const add = page.locator("#add-account-button, button:has-text('Add new account')").filter({ visible: true }).first();
  // La página del emulador primero dice si hay cuentas y recién entonces pinta la lista.
  await expect(page.getByText(/Please select an existing account|No Google\.com accounts exist/)).toBeVisible();
  if (await existing.count()) {
    await existing.first().click();
  } else {
    await add.click();
    await page.locator("#email-input").fill(email);
    await page.locator("#display-name-input").fill(name);
    await page.getByRole("button", { name: /Sign in with Google\.com/ }).click();
  }
  await expect(page.getByText("Sesión iniciada como")).toBeVisible();
}

async function newDevice(browser: Browser) {
  return (await browser.newContext({ baseURL: "http://localhost:4174", locale: "en-US" })).newPage();
}

/** Usuarios con datos en Firestore (los emuladores acumulan los de otras pruebas: se compara antes y después). */
const users = async (page: Page): Promise<number> => {
  const res = await page.request.get(`${FIRESTORE}/users`, { headers: { Authorization: "Bearer owner" } });
  return ((await res.json()).documents ?? []).length;
};

test("iniciar sesión muestra la cuenta, el perfil y quita el modo invitado", async ({ page }) => {
  const email = `login-${Date.now()}@example.com`;
  await signIn(page, email, "Ana Prueba");
  await expect(page.getByText("Ana Prueba").first()).toBeVisible();
  await expect(page.getByText("Modo invitado")).toBeHidden();
  await expect(page.getByRole("heading", { name: "Perfiles" })).toBeVisible();
});

test("lo marcado como visto se sincroniza a otro dispositivo con la misma cuenta", async ({ page, browser }) => {
  const email = `sync-${Date.now()}@example.com`;
  await signIn(page, email, "Sync Prueba");
  await page.goto("/f/saw");
  await watch(page, "Juego macabro").click();
  await expect(page.getByText("1 de 10 vistos")).toBeVisible();

  const other = await newDevice(browser);
  await signIn(other, email, "Sync Prueba");
  await other.goto("/f/saw");
  await expect(unwatch(other, "Juego macabro")).toBeVisible({ timeout: 20_000 });
  await expect(other.getByText("1 de 10 vistos")).toBeVisible();
  await other.context().close();
});

test("cerrar sesión vuelve al modo invitado sin dejar el progreso en el dispositivo", async ({ page }) => {
  await signIn(page, `out-${Date.now()}@example.com`, "Salida Prueba");
  await page.goto("/f/saw");
  await watch(page, "Juego macabro").click();
  await expect(page.getByText("1 de 10 vistos")).toBeVisible();

  await page.goto("/account");
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page.getByRole("button", { name: "Entrar con Google" })).toBeVisible({ timeout: 20_000 });
  await page.goto("/f/saw");
  await expect(page.getByText("0 de 10 vistos")).toBeVisible();
});

test("eliminar la cuenta borra los datos y vuelve como invitado", async ({ page }) => {
  const email = `del-${Date.now()}@example.com`;
  await signIn(page, email, "Borrar Prueba");
  await page.goto("/f/saw");
  await watch(page, "Juego macabro").click();
  await expect(page.getByText("1 de 10 vistos")).toBeVisible();
  await expect.poll(() => users(page)).toBeGreaterThan(0);
  const before = await users(page);

  await page.goto("/account");
  await page.getByRole("button", { name: "Eliminar cuenta" }).click();
  await page.getByRole("button", { name: "Eliminar todo" }).click();
  // Tras borrar, la app vuelve a la portada como invitado ("Entrar" en la cabecera).
  await expect(page.getByRole("banner").getByRole("link", { name: "Entrar" })).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => users(page), { timeout: 20_000 }).toBe(before - 1);

  // Volver a entrar con el mismo correo crea una cuenta nueva y vacía.
  await signIn(page, email, "Borrar Prueba");
  await page.goto("/f/saw");
  await expect(page.getByText("0 de 10 vistos")).toBeVisible();
});
