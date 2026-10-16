import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import "../../lib/i18n";
import es from "../../locales/es.json";
import { AboutPage, ContactPage, DevelopersPage, NEXT_PAGE } from "./ContentPage";

const renderPage = (page: React.ReactElement) =>
  new DOMParser().parseFromString(renderToStaticMarkup(<MemoryRouter>{page}</MemoryRouter>), "text/html");

// Las páginas nuevas son las mismas que sirve api/page.ts sin JavaScript (mismo texto de locales/).
describe("páginas de contenido", () => {
  it("acerca de: título, secciones y link a contacto", () => {
    const doc = renderPage(<AboutPage />);
    expect(doc.querySelector("h1")?.textContent).toBe(es.content.about.title);
    expect(doc.querySelectorAll("h2")).toHaveLength(es.content.about.sections.length);
    expect(doc.querySelector('a[href="/contact"]')?.textContent).toContain(es.content.links.contact);
  });

  it("contacto: el correo es un link mailto", () => {
    const doc = renderPage(<ContactPage />);
    expect(doc.querySelector('a[href="mailto:work@wxlter.dev"]')?.textContent).toBe("work@wxlter.dev");
  });

  it("API: los ejemplos van en bloques de código y los errores tienen ancla", () => {
    const doc = renderPage(<DevelopersPage />);
    expect(doc.querySelector("pre code")?.textContent).toContain("curl 'https://watchlist.wxlter.dev/api/franchises/marvel");
    expect(doc.querySelector("section#errors h2")?.textContent).toBe("Errores");
  });

  it("el pie de cada página enlaza a otra distinta, en un ciclo que las recorre todas", () => {
    const seen = new Set<string>();
    let kind: keyof typeof NEXT_PAGE = "about";
    for (let i = 0; i < 3; i++) {
      seen.add(kind);
      expect(NEXT_PAGE[kind]).not.toBe(kind);
      kind = NEXT_PAGE[kind];
    }
    expect(seen).toEqual(new Set(["about", "contact", "developers"]));
  });
});
