// Modelo del catálogo (SPEC §4). Todo lo que describe franquicias es dato;
// este archivo solo define su forma.

export type Lang = "es" | "en";

/** Texto traducible en los JSON del catálogo: un string plano o uno por idioma. */
export type LocalizedText = string | Partial<Record<Lang, string>>;

export type Kind = "movie" | "series" | "special" | "short" | "one-shot" | "ova";

export interface TitleVersion {
  id: string;
  name: LocalizedText;
  runtimeMin: number;
  default?: boolean;
}

export interface Title {
  id: string;
  tmdbId: number;
  tmdbType: "movie" | "tv";
  imdbId?: string;
  title: string;
  kind: Kind;
  releaseDate: string;
  seasons?: { number: number; episodes: number }[];
  runtimeMin?: number;
  posterPath?: string;
  overview?: string;
  localized?: Partial<Record<Lang, { title: string; overview?: string }>>;
  versions?: TitleVersion[];
  /** Serie que sigue en emisión o producción según TMDB (enriquecido por script). */
  ongoing?: boolean;
}

export type Importance = "essential" | "recommended" | "optional" | "skippable";
export type CanonLevel = "main" | "semicanon" | "alternate" | "non-canon";

export interface Continuity {
  id: string;
  name: LocalizedText;
  canonLevel: CanonLevel;
  description?: LocalizedText;
  branchesFrom?: { continuityId: string; afterTitleId: string };
  /** Oculta hasta que el perfil la active en el filtro de continuidades. */
  hiddenByDefault?: boolean;
}

export interface Entry {
  titleId: string;
  continuityId: string;
  group?: string;
  chronoOrder?: number;
  chronoNote?: LocalizedText;
  importance: Importance;
  characters?: string[];
  teams?: string[];
  postCredits?: { mid: number; end: number };
}

interface OrderBase {
  id: string;
  name: LocalizedText;
  description?: LocalizedText;
}

export type OrderDef =
  | (OrderBase & { type: "release" })
  | (OrderBase & { type: "chronological" })
  | (OrderBase & { type: "grouped"; groupLabels: Record<string, LocalizedText> })
  | (OrderBase & { type: "curated"; description: LocalizedText; titleIds: string[] });

export interface Route {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  kind: "character" | "prep" | "theme";
  targetTitleId?: string;
  titleIds: string[];
}

export interface Franchise {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  accentColor: string;
  continuities: Continuity[];
  entries: Entry[];
  orders: OrderDef[];
  routes: Route[];
  /** Personajes y equipos que se pueden usar en entries[].characters / teams (filtro dinámico). */
  tags: { characters: TagDef[]; teams: TagDef[] };
}

export interface TagDef {
  id: string;
  name: LocalizedText;
}

export interface Catalog {
  titles: Title[];
  franchises: Franchise[];
}

// ---- Logros (SPEC §9.4) ----

export type AchievementRule =
  | { type: "complete-group"; franchiseId: string; group: string }
  | { type: "complete-franchise"; franchiseId: string; continuityId?: string }
  | { type: "complete-route"; franchiseId: string; routeId: string }
  | { type: "watched-in-order"; franchiseId: string; orderId: string }
  | { type: "count"; metric: "titles" | "hours" | "franchises"; value: number }
  | { type: "streak"; days: number };

export interface Achievement {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  /** Id de un ícono de src/lib/achievementIcons.ts. */
  icon: string;
  rule: AchievementRule;
}
