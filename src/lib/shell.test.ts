import html from "../../index.html?raw";
import en from "../locales/en.json";
import es from "../locales/es.json";

// El app shell de index.html repite textos del Hub: tienen que ser los mismos que en locales/.
describe("app shell de index.html", () => {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const texts = [...doc.querySelectorAll("#shell-hero [data-es]")].map((el) => [el.getAttribute("data-es"), el.getAttribute("data-en")]);

  it("usa los textos actuales del Hub en ambos idiomas", () => {
    expect(texts).toEqual([
      [es.app.tagline, en.app.tagline],
      [es.search.placeholder, en.search.placeholder],
    ]);
  });
});
