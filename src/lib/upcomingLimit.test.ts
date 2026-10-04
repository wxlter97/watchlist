import source from "../../api/upcoming.ts?raw";
import { franchiseMetas } from "./catalog";

// El Hub pide /api/upcoming con todas las franquicias cuando no sigues ninguna: si el tope de la
// función queda por debajo del catálogo, todo visitante nuevo recibe un 400 (pasó con 20 y 44).
describe("/api/upcoming", () => {
  it("acepta al menos todas las franquicias del catálogo", () => {
    const max = Number(/const MAX_FRANCHISES = (\d+)/.exec(source)?.[1]);
    expect(franchiseMetas.length).toBeLessThanOrEqual(max);
  });
});
