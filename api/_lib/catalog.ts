// Lectura del catálogo desde las funciones (los JSON de src/data, incluidos en el deploy).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Lang, LocalizedText } from "../../src/lib/types";
import { HttpError } from "./tmdb";

const DATA = join(process.cwd(), "src", "data");
export const readData = <T,>(path: string): T => JSON.parse(readFileSync(join(DATA, path), "utf8")) as T;

export interface ServerTitle {
  id: string;
  tmdbId: number;
  tmdbType: "movie" | "tv";
  title: string;
  releaseDate: string;
  posterPath?: string;
  kind: string;
  localized?: Partial<Record<Lang, { title: string }>>;
}

export interface ServerFranchise {
  id: string;
  name: LocalizedText;
  accentColor: string;
  routes?: { id: string; name: LocalizedText }[];
}

let titles: Map<string, ServerTitle> | undefined;
export function titlesById(): Map<string, ServerTitle> {
  titles ??= new Map(readData<ServerTitle[]>("titles.json").map((t) => [t.id, t]));
  return titles;
}

export function readFranchise(id: string): ServerFranchise {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) throw new HttpError(400, "franquicia inválida");
  try {
    return readData<ServerFranchise>(join("franchises", `${id}.json`));
  } catch {
    throw new HttpError(404, `No existe la franquicia "${id}"`);
  }
}

export const localize = (text: LocalizedText | undefined, lang: Lang) =>
  typeof text === "string" ? text : (text?.[lang] ?? text?.es ?? text?.en ?? "");

export const titleName = (t: ServerTitle, lang: Lang) => t.localized?.[lang]?.title ?? t.title;
