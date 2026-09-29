import { catalogMessage, newlyStreaming, releasesDue, releasesMessage, streamingMessage, type CatalogTitleLite } from "./notifications";

const titles = new Map<string, CatalogTitleLite>(
  [
    { id: "a", title: "Alpha", releaseDate: "2026-09-28", localized: { es: { title: "Alfa" } } },
    { id: "b", title: "Beta", releaseDate: "2026-10-05" },
    { id: "c", title: "Gamma", releaseDate: "2026-10-06" },
  ].map((t) => [t.id, t]),
);
const franchises = new Map([
  ["f1", { entries: [{ titleId: "a" }, { titleId: "b" }, { titleId: "c" }] }],
  ["f2", { entries: [{ titleId: "a" }] }],
]);

describe("avisos", () => {
  it("estrenos de hoy y en 7 días, sin repetir un título de dos franquicias", () => {
    expect(releasesDue(["f2", "f1"], franchises, titles, "2026-09-28")).toEqual([
      { titleId: "a", franchiseId: "f2", inDays: 0 },
      { titleId: "b", franchiseId: "f1", inDays: 7 },
    ]);
    expect(releasesDue([], franchises, titles, "2026-09-28")).toEqual([]);
  });

  it("mensaje de estrenos en el idioma del usuario", () => {
    const due = releasesDue(["f1"], franchises, titles, "2026-09-28");
    expect(releasesMessage(due, titles, "es", "2026-09-28")).toEqual({
      title: "Estrenos de tus franquicias",
      body: "Hoy se estrena Alfa. En una semana: Beta.",
      url: "/",
      tag: "releases-2026-09-28",
    });
    expect(releasesMessage(due.slice(1), titles, "en", "2026-09-28")?.url).toBe("/t/b");
    expect(releasesMessage([], titles, "es", "2026-09-28")).toBeNull();
  });

  it("streaming: solo cuando pasa de ningún servicio a alguno (el primer registro no avisa)", () => {
    expect(newlyStreaming([], [8])).toBe(true);
    expect(newlyStreaming(undefined, [8])).toBe(false);
    expect(newlyStreaming([8], [8, 9])).toBe(false);
    expect(newlyStreaming([], [])).toBe(false);
    expect(streamingMessage(["a", "b"], titles, "es", "2026-09-28")?.body).toBe("Alfa y Beta llegaron a un servicio de tu región.");
  });

  it("catálogo: franquicias nuevas primero y hasta 3 títulos", () => {
    const many = [...titles.values(), { id: "d", title: "Delta", releaseDate: "2027-01-01" }];
    expect(catalogMessage(many, [{ name: "Alien" }], "es")?.body).toBe("Alien, Alfa, Beta, Gamma y 1 más.");
    expect(catalogMessage([], [], "en")).toBeNull();
  });
});
