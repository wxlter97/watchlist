import { addRecent, clearRecent, loadRecent, MAX_RECENT, removeRecent } from "./recentSearches";

beforeEach(() => localStorage.clear());

describe("búsquedas recientes", () => {
  it("guarda lo más reciente primero y sin duplicados", () => {
    addRecent("loki");
    addRecent("thor");
    expect(addRecent("  LOKI ")).toEqual(["LOKI", "thor"]);
    expect(loadRecent()).toEqual(["LOKI", "thor"]);
  });

  it("ignora búsquedas de un solo carácter y limita el historial", () => {
    addRecent("a");
    expect(loadRecent()).toEqual([]);
    for (let i = 0; i < MAX_RECENT + 3; i++) addRecent(`serie ${i}`);
    expect(loadRecent()).toHaveLength(MAX_RECENT);
  });

  it("quita una y borra todo; tolera datos corruptos", () => {
    addRecent("loki");
    addRecent("thor");
    expect(removeRecent("loki")).toEqual(["thor"]);
    expect(clearRecent()).toEqual([]);
    localStorage.setItem("watch-order:recent-searches", "{no es json");
    expect(loadRecent()).toEqual([]);
  });
});
