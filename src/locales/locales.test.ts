import es from "./es.json";
import en from "./en.json";

// Criterio de aceptación: toda la interfaz está disponible en español e inglés (SPEC §12).

type Tree = { [key: string]: string | Tree };

function leafKeys(tree: Tree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([k, v]) => (typeof v === "string" ? [prefix + k] : leafKeys(v, `${prefix}${k}.`)));
}

/** Clave base sin sufijo de plural de i18next (_one, _other…). */
const base = (key: string) => key.replace(/_(zero|one|two|few|many|other)$/, "");

describe("traducciones", () => {
  it("español e inglés tienen exactamente las mismas claves", () => {
    expect(leafKeys(en as Tree).sort()).toEqual(leafKeys(es as Tree).sort());
  });

  it("toda clave literal usada en el código existe", () => {
    const sources = import.meta.glob<string>("../**/*.{ts,tsx}", { eager: true, query: "?raw", import: "default" });
    const available = new Set(leafKeys(es as Tree).map(base));
    const missing: string[] = [];
    for (const [file, code] of Object.entries(sources)) {
      if (file.includes(".test.")) continue;
      for (const [, key] of code.matchAll(/\bt\(\s*"([a-zA-Z0-9_.-]+)"/g)) {
        if (!available.has(key!) && !available.has(base(key!))) missing.push(`${file}: ${key}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
