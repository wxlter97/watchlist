// Las funciones de /api corren en Vercel como ESM nativo de Node: un import relativo sin ".js"
// falla en producción con ERR_MODULE_NOT_FOUND (y ni tsc ni Vite lo notan). Este chequeo compila
// api/ como NodeNext a una carpeta temporal y carga cada función, igual que lo hace Node allá.
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, rmSync, statSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? (n === "_fonts" ? [] : files(p)) : p.endsWith(".ts") ? [p] : [];
  });

const out = mkdtempSync(join(tmpdir(), "watch-order-api-"));
try {
  try {
    execFileSync(
      "pnpm",
      ["exec", "tsc", "--module", "nodenext", "--moduleResolution", "nodenext", "--target", "es2023", "--skipLibCheck", "--ignoreConfig", "--types", "node", "--resolveJsonModule", "--outDir", out, "--rootDir", ".", ...files("api")],
      { stdio: "pipe" },
    );
  } catch {
    // tsc avisa de tipos en src/ aunque emita igual; lo que importa es que cargue (abajo).
  }
  cpSync("package.json", join(out, "package.json"));
  symlinkSync(join(process.cwd(), "node_modules"), join(out, "node_modules"));
  symlinkSync(join(process.cwd(), "src", "data"), join(out, "src", "data"));

  const problems: string[] = [];
  for (const file of files("api")) {
    const js = join(out, relative(".", file).replace(/\.ts$/, ".js"));
    // Node puro en un proceso aparte: tsx (que corre este script) resuelve imports sin extensión.
    try {
      execFileSync(process.execPath, ["--input-type=module", "-e", `await import(${JSON.stringify(pathToFileURL(js).href)})`], { stdio: "pipe" });
    } catch (err) {
      const stderr = String((err as { stderr?: Buffer }).stderr ?? "");
      problems.push(`${file}: ${stderr.split("\n").find((l) => /Error/.test(l)) ?? stderr.slice(0, 200)}`);
    }
  }
  if (problems.length) {
    console.error(`Las funciones no cargan como ESM nativo (¿falta ".js" en un import?):\n${problems.join("\n")}`);
    process.exit(1);
  }
  console.log(`Funciones de api/ cargan como ESM: ${files("api").length}.`);
} finally {
  rmSync(out, { recursive: true, force: true });
}
