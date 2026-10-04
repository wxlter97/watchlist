import { applyMeta, isPrivatePath } from "./meta";

const robots = () => document.head.querySelector('meta[name="robots"]')?.getAttribute("content");
const canonical = () => document.head.querySelector('link[rel="canonical"]')?.getAttribute("href");

beforeEach(() => {
  document.head.innerHTML = "";
});

describe("meta de cada pantalla", () => {
  it("fija título, descripción y canonical, y cambia al navegar", () => {
    applyMeta({ title: "Saw | Watch Order", description: "Orden de Saw", canonical: "/f/saw" }, "General");
    expect(document.title).toBe("Saw | Watch Order");
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute("content")).toBe("Orden de Saw");
    expect(canonical()).toBe(`${location.origin}/f/saw`);
    expect(robots()).toBeUndefined();

    applyMeta({ title: "Inicio" }, "General");
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute("content")).toBe("General");
    expect(canonical()).toBeUndefined();
  });

  it("marca noindex y quita el canonical en pantallas privadas; lo retira al volver a una pública", () => {
    applyMeta({ title: "Cuenta", noindex: true, canonical: "/account" }, "General");
    expect(robots()).toBe("noindex");
    expect(canonical()).toBeUndefined();
    applyMeta({ title: "Saw", canonical: "/f/saw" }, "General");
    expect(robots()).toBeUndefined();
  });

  it("conserva el dominio del canonical que trae el HTML", () => {
    document.head.innerHTML = '<link rel="canonical" href="https://watchorder.example/">';
    applyMeta({ title: "Saw", canonical: "/f/saw" }, "General");
    expect(canonical()).toBe("https://watchorder.example/f/saw");
  });

  it("en una URL en inglés (/en/…) el canonical es la versión en inglés", () => {
    window.history.pushState({}, "", "/en/f/saw");
    applyMeta({ title: "Saw", canonical: "/f/saw" }, "General");
    expect(canonical()).toBe(`${location.origin}/en/f/saw`);
    applyMeta({ title: "Home", canonical: "/" }, "General");
    expect(canonical()).toBe(`${location.origin}/en`);
    window.history.pushState({}, "", "/");
  });

  it("reconoce las rutas privadas", () => {
    expect(isPrivatePath("/account")).toBe(true);
    expect(isPrivatePath("/plans/abc/edit")).toBe(true);
    expect(isPrivatePath("/f/saw")).toBe(false);
    expect(isPrivatePath("/accounting")).toBe(false);
  });
});
