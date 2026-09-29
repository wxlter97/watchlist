# Watch Order

PWA para seguir sagas y franquicias de cine y TV en varios órdenes de visualización.
La especificación completa está en [docs/SPEC.md](docs/SPEC.md).

**Estado:** fase 4 — 6 franquicias (Marvel completo, Star Wars, DC, Wizarding World, Middle-earth, MonsterVerse), Hub y búsqueda global.

## Desarrollo

```bash
pnpm install
pnpm dev                 # http://localhost:5173
pnpm test                # Vitest
pnpm typecheck
pnpm build && pnpm preview
```

## Firebase

Auth (Google) y Firestore con caché offline persistente. Proyecto: `watchlist-97b25`.
La config web va en `.env.local` (ver `.env.example`); son identificadores públicos, la
seguridad vive en [firestore.rules](firestore.rules).

```bash
pnpm test:rules          # reglas de Firestore contra el emulador (requiere Java)
pnpm emulators           # Auth + Firestore locales (proyecto demo-watch-order)
pnpm dev:emulators       # la app conectada a los emuladores, con cuentas de prueba
pnpm rules:deploy        # publica firestore.rules e índices en el proyecto real
```

- Sin sesión, el progreso vive en `localStorage` (modo invitado). Al entrar, la app ofrece
  pasarlo al perfil activo; por documento gana el cambio más reciente.
- Cerrar sesión borra la caché local de Firestore del dispositivo.
- En producción, `vercel.json` sirve `/__/auth/*` desde el propio dominio (necesario para el
  login por redirect en Safari / PWA de iOS). Al desplegar, cambiar `VITE_FIREBASE_AUTH_DOMAIN`
  al dominio de la app y agregarlo a los dominios autorizados de Firebase Auth.

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
