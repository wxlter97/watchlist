import { describe, expect, it } from "vitest";
import { viewingOptions } from "./viewings";

describe("viewingOptions", () => {
  it("una película ofrece cine y todos los formatos", () => {
    const o = viewingOptions("movie", false);
    expect(o.mediums).toContain("cinema");
    expect(o.formats).toEqual(expect.arrayContaining(["imax", "4dx", "dubbed"]));
    expect(o.seasons).toBe(false);
  });

  it("una serie no ofrece cine ni formatos de sala, y deja elegir temporada", () => {
    const o = viewingOptions("series", true);
    expect(o.mediums).not.toContain("cinema");
    expect(o.formats).toEqual(["dubbed", "subbed"]);
    expect(o.seasons).toBe(true);
  });

  it("una serie sin temporadas, o un especial, no pide temporada", () => {
    expect(viewingOptions("series", false).seasons).toBe(false);
    expect(viewingOptions("special", true).seasons).toBe(false);
  });
});
