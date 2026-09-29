// SPEC §12: ningún secreto aparece en el bundle del cliente. Corre después de `pnpm build`.
// Busca en dist/ los valores de las variables de servidor (si están definidas) y marcas de
// código que solo debe correr en las funciones.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SERVER_ENV = ["TMDB_API_KEY", "FIREBASE_SERVICE_ACCOUNT", "CRON_SECRET"];
const MARKERS = ["firebase-admin", '"private_key"', "BEGIN PRIVATE KEY", "satori", "@resvg/resvg-js"];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.(js|html|css|json|webmanifest)$/.test(name) ? [path] : [];
  });
}

const needles = [
  ...SERVER_ENV.flatMap((key) => {
    const value = process.env[key];
    // Valores cortos darían falsos positivos; un secreto real nunca lo es.
    return value && value.length >= 16 ? [{ what: `el valor de ${key}`, text: value }] : [];
  }),
  ...MARKERS.map((text) => ({ what: `"${text}"`, text })),
];

const problems: string[] = [];
for (const file of files("dist")) {
  const content = readFileSync(file, "utf8");
  for (const { what, text } of needles) if (content.includes(text)) problems.push(`${file}: contiene ${what}`);
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`Bundle limpio: ${needles.length} comprobaciones en dist/.`);
