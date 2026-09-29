import { validateCatalog } from "./validateCatalog";
import { entry, makeCatalog, title } from "../test/fixtures";
import type { Catalog } from "./types";
import { catalog } from "./catalog";

const withChange = (fn: (c: Catalog) => void) => {
  const c = makeCatalog();
  fn(c);
  return validateCatalog(c);
};

describe("validateCatalog", () => {
  it("acepta un catálogo válido", () => {
    expect(validateCatalog(makeCatalog())).toEqual([]);
  });

  it("detecta títulos referenciados que no existen", () => {
    const errors = withChange((c) => {
      const f = c.franchises[0]!;
      f.entries.push({ titleId: "ghost", continuityId: "main", importance: "optional" });
      f.routes.push({ id: "r", name: "R", description: "", kind: "theme", titleIds: ["ghost-2"] });
      f.continuities[1]!.branchesFrom!.afterTitleId = "ghost-3";
    });
    expect(errors.join("\n")).toMatch(/"ghost"/);
    expect(errors.join("\n")).toMatch(/"ghost-2"/);
    expect(errors.join("\n")).toMatch(/"ghost-3"/);
  });

  it("detecta chronoOrder duplicado dentro de una continuidad, pero no entre continuidades", () => {
    const errors = withChange((c) => {
      c.franchises[0]!.entries[1]!.chronoOrder = 20;
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/chronoOrder 20 repetido en "main"/);
    // b-2003 (main) y alt-2004 (alt) ya comparten chronoOrder 10 en el fixture sin error.
  });

  it("exige órdenes de estreno y cronológico", () => {
    const errors = withChange((c) => {
      c.franchises[0]!.orders = c.franchises[0]!.orders.filter((o) => o.type !== "chronological");
    });
    expect(errors).toEqual([expect.stringMatching(/falta un orden de tipo chronological/)]);
  });

  it("detecta títulos duplicados (mismo id o mismo tmdbId)", () => {
    const errors = withChange((c) => {
      c.titles.push(title("a-2001", "2001-01-01"));
      c.titles.push({ ...title("copy", "2001-01-01"), tmdbId: c.titles[1]!.tmdbId });
    });
    expect(errors.join("\n")).toMatch(/id duplicado/);
    expect(errors.join("\n")).toMatch(/un título existe una sola vez/);
  });

  it("detecta continuidades inexistentes y grupos sin etiqueta", () => {
    const errors = withChange((c) => {
      c.franchises[0]!.entries[0]!.continuityId = "nope";
      c.franchises[0]!.entries[1]!.group = "g3";
    });
    expect(errors.join("\n")).toMatch(/continuidad "nope" no existe/);
    expect(errors.join("\n")).toMatch(/falta la etiqueta del grupo "g3"/);
  });

  it("detecta personajes y equipos sin definir en tags", () => {
    const errors = withChange((c) => {
      const f = c.franchises[0]!;
      f.tags.characters.push({ id: "hero", name: "Hero" });
      f.entries[0]!.characters = ["hero", "villain"];
      f.entries[0]!.teams = ["team"];
    });
    expect(errors).toEqual([
      expect.stringMatching(/el personaje "villain" no está en tags.characters/),
      expect.stringMatching(/el equipo "team" no está en tags.teams/),
    ]);
  });

  it("una ruta prep necesita objetivo y no puede contenerlo", () => {
    const errors = withChange((c) => {
      c.franchises[0]!.routes.push(
        { id: "p1", name: "P", description: "", kind: "prep", titleIds: ["a-2001"] },
        { id: "p2", name: "P", description: "", kind: "prep", targetTitleId: "a-2001", titleIds: ["a-2001", "a-2001"] },
      );
    });
    expect(errors.join("\n")).toMatch(/"p1": una ruta "prep" necesita targetTitleId/);
    expect(errors.join("\n")).toMatch(/"p2": tiene títulos repetidos/);
    expect(errors.join("\n")).toMatch(/"p2": el título objetivo no va dentro/);
  });

  it.each<[string, (c: Catalog) => void, RegExp]>([
    ["id de título que no es slug", (c) => (c.titles[0]!.id = "Bad Id"), /debe ser un slug/],
    ["tmdbId inválido", (c) => (c.titles[0]!.tmdbId = 0), /tmdbId inválido/],
    ["kind desconocido", (c) => ((c.titles[0] as { kind: string }).kind = "podcast"), /kind "podcast" desconocido/],
    ["fecha que no es ISO", (c) => (c.titles[0]!.releaseDate = "2001-13-45x"), /no es una fecha ISO/],
    [
      "dos versiones default",
      (c) => (c.titles[0]!.versions = [{ id: "a", name: "A", default: true }, { id: "b", name: "B", default: true }] as never),
      /más de una versión marcada como default/,
    ],
    ["franquicia duplicada", (c) => c.franchises.push(structuredClone(c.franchises[0]!)), /franquicia "test": id duplicado/],
    ["id de franquicia que no es slug", (c) => (c.franchises[0]!.id = "Test"), /el id debe ser un slug/],
    ["color de acento inválido", (c) => (c.franchises[0]!.accentColor = "red"), /accentColor "red"/],
    ["color de acento con poco contraste", (c) => (c.franchises[0]!.accentColor = "#e23636"), /no llega a 4.5:1/],
    ["continuidad duplicada", (c) => c.franchises[0]!.continuities.push({ id: "main", name: "M", canonLevel: "main" }), /continuidad "main" duplicada/],
    ["canonLevel desconocido", (c) => ((c.franchises[0]!.continuities[0] as { canonLevel: string }).canonLevel = "fanon"), /canonLevel "fanon"/],
    ["branchesFrom a continuidad inexistente", (c) => (c.franchises[0]!.continuities[1]!.branchesFrom!.continuityId = "x"), /apunta a "x"/],
    ["tag que no es slug", (c) => c.franchises[0]!.tags.teams.push({ id: "X Men", name: "X" }), /equipo "X Men": el id debe ser un slug/],
    [
      "tag duplicado",
      (c) => c.franchises[0]!.tags.characters.push({ id: "hero", name: "H" }, { id: "hero", name: "H" }),
      /personaje "hero" duplicado/,
    ],
    ["entry repetida", (c) => c.franchises[0]!.entries.push(entry("a-2001")), /aparece más de una vez/],
    ["importance desconocida", (c) => ((c.franchises[0]!.entries[0] as { importance: string }).importance = "must"), /importance "must"/],
    ["postCredits inválidos", (c) => (c.franchises[0]!.entries[0]!.postCredits = { mid: -1, end: 1.5 }), /postCredits debe tener enteros/],
    ["orden duplicado", (c) => c.franchises[0]!.orders.push({ id: "release", name: "R", type: "release" }), /orden "release" duplicado/],
    ["orden con id reservado", (c) => c.franchises[0]!.orders.push({ id: "custom", name: "C", type: "release" }), /"custom" está reservado/],
    [
      "orden curado con título de otra franquicia",
      (c) => {
        c.titles.push(title("outside", "2010-01-01"));
        (c.franchises[0]!.orders[3] as { titleIds: string[] }).titleIds.push("outside", "ghost");
      },
      /"outside" no es entry de esta franquicia/,
    ],
    ["falta el orden de estreno", (c) => (c.franchises[0]!.orders = c.franchises[0]!.orders.filter((o) => o.type !== "release")), /tipo release/],
    [
      "ruta duplicada",
      (c) => c.franchises[0]!.routes.push(...[1, 2].map(() => ({ id: "r", name: "R", description: "", kind: "theme" as const, titleIds: [] }))),
      /ruta "r" duplicada/,
    ],
    [
      "objetivo de ruta inexistente",
      (c) => c.franchises[0]!.routes.push({ id: "p", name: "P", description: "", kind: "prep", targetTitleId: "ghost", titleIds: [] }),
      /targetTitleId: el título "ghost" no existe/,
    ],
  ])("detecta: %s", (_, change, pattern) => {
    expect(withChange(change).join("\n")).toMatch(pattern);
  });

  it("el catálogo real es válido", () => {
    expect(catalog.franchises.length).toBeGreaterThan(0);
    expect(validateCatalog(catalog)).toEqual([]);
  });
});
