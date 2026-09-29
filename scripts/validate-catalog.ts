// Valida el catálogo completo (SPEC §4.5). Corre en CI: sale con código 1 si hay errores.
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Catalog } from "../src/lib/types.ts";
import { validateAchievements, validateCatalog } from "../src/lib/validateCatalog.ts";
import { ACHIEVEMENT_ICONS } from "../src/lib/achievementIcons.ts";

const dataDir = fileURLToPath(new URL("../src/data/", import.meta.url));
const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));

const franchiseFiles = readdirSync(`${dataDir}franchises`).filter((f) => f.endsWith(".json"));
const catalog: Catalog = {
  titles: read(`${dataDir}titles.json`),
  franchises: franchiseFiles.map((f) => read(`${dataDir}franchises/${f}`)),
};

const achievements = read(`${dataDir}achievements.json`);
const errors = [...validateCatalog(catalog), ...validateAchievements(achievements, catalog, Object.keys(ACHIEVEMENT_ICONS))];
for (const f of franchiseFiles) {
  const id = f.replace(/\.json$/, "");
  if (!catalog.franchises.some((fr) => fr.id === id)) errors.push(`franchises/${f}: el id debe coincidir con el nombre del archivo`);
}

if (errors.length) {
  console.error(`Catálogo inválido (${errors.length} errores):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(
  `Catálogo válido: ${catalog.titles.length} títulos, ${catalog.franchises.length} franquicias, ${achievements.length} logros.`,
);
