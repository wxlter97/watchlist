# Watch Order

PWA para seguir sagas y franquicias de cine y TV en varios órdenes de visualización.
La especificación completa está en [docs/SPEC.md](docs/SPEC.md).

**Estado:** fase 1 (base genérica + MCU con progreso local).

## Desarrollo

```bash
pnpm install
pnpm dev                 # http://localhost:5173
pnpm test                # Vitest
pnpm typecheck
pnpm build && pnpm preview
```

## Catálogo

El catálogo es JSON versionado en `src/data/`:

- `titles.json`: cada título existe una sola vez, aunque pertenezca a varias franquicias.
- `franchises/<id>.json`: continuidades, pertenencia de títulos (`entries`), órdenes y rutas.

Agregar una franquicia = agregar su JSON (y sus títulos a `titles.json`). No hay que tocar código.

```bash
pnpm catalog:validate    # referencias, chronoOrder duplicados, órdenes obligatorios (corre en CI)
pnpm catalog:enrich      # trae de TMDB duración, pósters, sinopsis (es/en), temporadas, imdbId
pnpm catalog:enrich --only loki-2021 --dry-run
```

`catalog:enrich` necesita `TMDB_API_KEY` (el *API Read Access Token* de TMDB) en `.env.local`.
Esa variable solo la leen los scripts y, más adelante, las funciones de `/api`; nunca llega al cliente.
El script también verifica el catálogo: reporta cada nombre o fecha que difiera de TMDB.

## Nota legal

This product uses the TMDB API but is not endorsed or certified by TMDB.
