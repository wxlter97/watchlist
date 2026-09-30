import { toggleFollowRoute, useSettings, withDefaults } from "./settings";

describe("rutas seguidas", () => {
  it("withDefaults descarta lo que no sea texto y rellena documentos viejos", () => {
    expect(withDefaults({}).followedRoutes).toEqual([]);
    expect(withDefaults({ followedRoutes: ["/f/marvel/prep/x", 3] }).followedRoutes).toEqual(["/f/marvel/prep/x"]);
  });

  it("toggleFollowRoute sigue y deja de seguir", () => {
    useSettings.setState({ followedRoutes: [] });
    toggleFollowRoute("/f/marvel/r/a");
    expect(useSettings.getState().followedRoutes).toEqual(["/f/marvel/r/a"]);
    toggleFollowRoute("/f/marvel/r/a");
    expect(useSettings.getState().followedRoutes).toEqual([]);
  });
});
