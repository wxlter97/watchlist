// Avisa de novedades en el catálogo a quien activó "catalogUpdates" (SPEC §7, §9.6).
// Corre en CI al desplegar cambios en src/data/: compara con el commit anterior.
//   tsx scripts/notify-catalog-update.ts [--base <ref>] [--dry-run]
// Necesita FIREBASE_SERVICE_ACCOUNT (salvo con --dry-run).
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { catalogMessage, type CatalogTitleLite } from "../src/lib/notifications.ts";
import type { Lang, LocalizedText } from "../src/lib/types.ts";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const baseIndex = args.indexOf("--base");
const base = baseIndex >= 0 && args[baseIndex + 1] ? args[baseIndex + 1]! : "HEAD~1";

const atBase = <T,>(path: string): T | undefined => {
  try {
    return JSON.parse(execFileSync("git", ["show", `${base}:${path}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })) as T;
  } catch {
    return undefined;
  }
};

const titles = JSON.parse(readFileSync("src/data/titles.json", "utf8")) as CatalogTitleLite[];
const before = new Set((atBase<CatalogTitleLite[]>("src/data/titles.json") ?? titles).map((t) => t.id));
const newTitles = titles.filter((t) => !before.has(t.id));

const franchiseFiles = readdirSync("src/data/franchises").filter((f) => f.endsWith(".json"));
const newFranchises = franchiseFiles
  .filter((f) => atBase(`src/data/franchises/${f}`) === undefined)
  .map((f) => JSON.parse(readFileSync(`src/data/franchises/${f}`, "utf8")) as { name: LocalizedText });

const loc = (text: LocalizedText, lang: Lang) => (typeof text === "string" ? text : (text[lang] ?? text.es ?? ""));
const messageFor = (lang: Lang) => catalogMessage(newTitles, newFranchises.map((f) => ({ name: loc(f.name, lang) })), lang);

console.log(`Base ${base}: ${newTitles.length} títulos y ${newFranchises.length} franquicias nuevas.`);
if (!messageFor("es")) process.exit(0);
if (dryRun) {
  console.log(messageFor("es"), messageFor("en"));
  process.exit(0);
}

const { adminDb } = await import("../api/_lib/admin.ts");
const { sendToUser } = await import("../api/_lib/push.ts");
const users = await adminDb().collection("users").where("settings.notifications.catalogUpdates", "==", true).get();
let sent = 0;
for (const user of users.docs) {
  const lang: Lang = user.get("settings.language") === "en" ? "en" : "es";
  sent += await sendToUser(user.id, messageFor(lang)!).catch(() => 0);
}
console.log(`Avisados: ${users.size} usuarios, ${sent} dispositivos.`);
