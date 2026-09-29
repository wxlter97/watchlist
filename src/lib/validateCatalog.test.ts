import { validateCatalog } from "./validateCatalog";
import { makeCatalog, title } from "../test/fixtures";
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

  it("el catálogo real es válido", () => {
    expect(catalog.franchises.length).toBeGreaterThan(0);
    expect(validateCatalog(catalog)).toEqual([]);
  });
});
