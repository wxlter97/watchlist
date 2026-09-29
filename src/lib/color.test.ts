import { contrastRatio, onColor } from "./color";

describe("onColor", () => {
  it("usa Tinta sobre Faro y blanco sobre acentos oscuros", () => {
    expect(onColor("#FFDB00")).toBe("#111111");
    expect(onColor("#e23636")).toBe("#FFFFFF");
    expect(onColor("#111111")).toBe("#FFFFFF");
  });

  it("siempre cumple al menos 3:1 (texto grande / UI)", () => {
    for (const hex of ["#e23636", "#FFDB00", "#1f6feb", "#0b7a45", "#7a3fe0", "#ff8a00"]) {
      expect(contrastRatio(hex, onColor(hex))).toBeGreaterThanOrEqual(3);
    }
  });
});
