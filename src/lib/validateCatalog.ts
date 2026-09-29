import type { Catalog, Franchise, Kind } from "./types";

// Reglas del validador (SPEC §4.5). Devuelve la lista de errores; vacía = válido.

const KINDS: readonly Kind[] = ["movie", "series", "special", "short", "one-shot", "ova"];
const IMPORTANCE = ["essential", "recommended", "optional", "skippable"];
const CANON = ["main", "semicanon", "alternate", "non-canon"];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const HEX = /^#[0-9a-fA-F]{6}$/;

export function validateCatalog(catalog: Catalog): string[] {
  const errors: string[] = [];
  const titleIds = new Set<string>();
  const tmdbKeys = new Map<string, string>();

  for (const t of catalog.titles) {
    const at = `título "${t.id}"`;
    if (!SLUG.test(t.id)) errors.push(`${at}: el id debe ser un slug en minúsculas`);
    if (titleIds.has(t.id)) errors.push(`${at}: id duplicado`);
    titleIds.add(t.id);

    const key = `${t.tmdbType}:${t.tmdbId}`;
    const other = tmdbKeys.get(key);
    if (other) errors.push(`${at}: comparte tmdb ${key} con "${other}" (un título existe una sola vez)`);
    tmdbKeys.set(key, t.id);

    if (!Number.isInteger(t.tmdbId) || t.tmdbId <= 0) errors.push(`${at}: tmdbId inválido`);
    if (!KINDS.includes(t.kind)) errors.push(`${at}: kind "${t.kind}" desconocido`);
    if (!ISO_DATE.test(t.releaseDate) || Number.isNaN(Date.parse(t.releaseDate)))
      errors.push(`${at}: releaseDate "${t.releaseDate}" no es una fecha ISO`);
    if (t.versions && t.versions.filter((v) => v.default).length > 1)
      errors.push(`${at}: más de una versión marcada como default`);
  }

  const franchiseIds = new Set<string>();
  for (const f of catalog.franchises) {
    if (franchiseIds.has(f.id)) errors.push(`franquicia "${f.id}": id duplicado`);
    franchiseIds.add(f.id);
    errors.push(...validateFranchise(f, titleIds));
  }
  return errors;
}

function validateFranchise(f: Franchise, titleIds: ReadonlySet<string>): string[] {
  const errors: string[] = [];
  const at = (what: string) => `franquicia "${f.id}" → ${what}`;
  const requireTitle = (id: string, where: string) => {
    if (!titleIds.has(id)) errors.push(at(`${where}: el título "${id}" no existe en titles.json`));
  };

  if (!SLUG.test(f.id)) errors.push(at("el id debe ser un slug en minúsculas"));
  if (!HEX.test(f.accentColor)) errors.push(at(`accentColor "${f.accentColor}" no es #rrggbb`));

  const continuityIds = new Set<string>();
  for (const c of f.continuities) {
    if (continuityIds.has(c.id)) errors.push(at(`continuidad "${c.id}" duplicada`));
    continuityIds.add(c.id);
    if (!CANON.includes(c.canonLevel)) errors.push(at(`continuidad "${c.id}": canonLevel "${c.canonLevel}" desconocido`));
  }
  for (const c of f.continuities) {
    if (!c.branchesFrom) continue;
    if (!continuityIds.has(c.branchesFrom.continuityId))
      errors.push(at(`continuidad "${c.id}": branchesFrom apunta a "${c.branchesFrom.continuityId}", que no existe`));
    requireTitle(c.branchesFrom.afterTitleId, `continuidad "${c.id}" branchesFrom`);
  }

  const characterIds = new Set<string>();
  const teamIds = new Set<string>();
  for (const [kind, defs, ids] of [
    ["personaje", f.tags.characters, characterIds],
    ["equipo", f.tags.teams, teamIds],
  ] as const) {
    for (const tag of defs) {
      if (!SLUG.test(tag.id)) errors.push(at(`${kind} "${tag.id}": el id debe ser un slug en minúsculas`));
      if (ids.has(tag.id)) errors.push(at(`${kind} "${tag.id}" duplicado`));
      ids.add(tag.id);
    }
  }

  const entryIds = new Set<string>();
  const chronoSeen = new Map<string, string>();
  const groups = new Set<string>();
  for (const e of f.entries) {
    const where = `entry "${e.titleId}"`;
    requireTitle(e.titleId, where);
    if (entryIds.has(e.titleId)) errors.push(at(`${where}: aparece más de una vez`));
    entryIds.add(e.titleId);
    if (!continuityIds.has(e.continuityId)) errors.push(at(`${where}: la continuidad "${e.continuityId}" no existe`));
    if (!IMPORTANCE.includes(e.importance)) errors.push(at(`${where}: importance "${e.importance}" desconocida`));
    if (e.group) groups.add(e.group);
    if (e.chronoOrder !== undefined) {
      const key = `${e.continuityId}#${e.chronoOrder}`;
      const other = chronoSeen.get(key);
      if (other) errors.push(at(`${where}: chronoOrder ${e.chronoOrder} repetido en "${e.continuityId}" (también "${other}")`));
      chronoSeen.set(key, e.titleId);
    }
    for (const c of e.characters ?? [])
      if (!characterIds.has(c)) errors.push(at(`${where}: el personaje "${c}" no está en tags.characters`));
    for (const t of e.teams ?? []) if (!teamIds.has(t)) errors.push(at(`${where}: el equipo "${t}" no está en tags.teams`));
    const pc = e.postCredits;
    if (pc && ![pc.mid, pc.end].every((n) => Number.isInteger(n) && n >= 0))
      errors.push(at(`${where}: postCredits debe tener enteros ≥ 0`));
  }

  const orderIds = new Set<string>();
  for (const o of f.orders) {
    if (orderIds.has(o.id)) errors.push(at(`orden "${o.id}" duplicado`));
    orderIds.add(o.id);
    if (o.id === "custom") errors.push(at(`el id de orden "custom" está reservado para el orden personalizado`));
    if (o.type === "curated") {
      for (const id of o.titleIds) {
        requireTitle(id, `orden "${o.id}"`);
        if (titleIds.has(id) && !entryIds.has(id))
          errors.push(at(`orden "${o.id}": "${id}" no es entry de esta franquicia`));
      }
    }
    if (o.type === "grouped") {
      for (const g of groups)
        if (!(g in o.groupLabels)) errors.push(at(`orden "${o.id}": falta la etiqueta del grupo "${g}"`));
    }
  }
  if (!f.orders.some((o) => o.type === "release")) errors.push(at("falta un orden de tipo release"));
  if (!f.orders.some((o) => o.type === "chronological")) errors.push(at("falta un orden de tipo chronological"));

  const routeIds = new Set<string>();
  for (const r of f.routes) {
    if (routeIds.has(r.id)) errors.push(at(`ruta "${r.id}" duplicada`));
    routeIds.add(r.id);
    // Las rutas pueden cruzar franquicias: solo exigen que el título exista.
    for (const id of r.titleIds) requireTitle(id, `ruta "${r.id}"`);
    if (new Set(r.titleIds).size !== r.titleIds.length) errors.push(at(`ruta "${r.id}": tiene títulos repetidos`));
    if (r.kind === "prep") {
      if (!r.targetTitleId) errors.push(at(`ruta "${r.id}": una ruta "prep" necesita targetTitleId`));
      else if (r.titleIds.includes(r.targetTitleId))
        errors.push(at(`ruta "${r.id}": el título objetivo no va dentro de su propia preparación`));
    }
    if (r.targetTitleId) requireTitle(r.targetTitleId, `ruta "${r.id}" targetTitleId`);
  }

  return errors;
}
