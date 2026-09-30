# Watch Order

PWA para seguir sagas y franquicias de cine y TV en varios órdenes de visualización.
La especificación completa está en [docs/SPEC.md](docs/SPEC.md).

**Estado:** fase 10 — oleadas del backlog. Oleada 1: Star Trek, Alien, Predator, Terminator, Godzilla (Toho), Halloween, El Conjuro, Rápidos y furiosos, James Bond, Juego de tronos, Breaking Bad, Dragon Ball y Fate.

## Desarrollo

```bash
pnpm install
pnpm dev                 # http://localhost:5173
pnpm test                # Vitest
pnpm test:coverage       # con cobertura; orders, planner, achievements y el validador ≥ 95%
pnpm typecheck
pnpm build && pnpm preview
pnpm check:bundle        # después del build: ningún secreto ni código de servidor en dist/
```

### Rendimiento

- El arranque como invitado no descarga Firebase: `session.ts` solo carga `sessionCloud.ts`
  si el dispositivo tiene una cuenta iniciada (`watch-order:account`) o al iniciar sesión.
- El catálogo se carga por partes (`catalogData` en `vite.config.ts`, `src/lib/catalog.ts`):
  al abrir la app solo llega un manifiesto (nombre, color, continuidades y `[id, continuidad,
  fecha]` de cada título, más los próximos estrenos). Cada franquicia completa es un chunk que
  se descarga cuando una pantalla la pide con `useCatalog`, y sus sinopsis otro, por idioma.
  Búsqueda, estadísticas, logros y mapa cargan todo al abrirse. Así el arranque crece unos
  45 bytes por título nuevo, no con la franquicia entera.
- Todo menos el Hub va en chunks propios, que se precargan cuando la página termina de cargar.
- `index.html` trae un *app shell* (cabecera y titular del Hub) que se pinta antes del JS.
- Lighthouse (móvil, `pnpm build && pnpm preview`): rendimiento ≥ 90; accesibilidad, buenas
  prácticas y SEO 100. Lighthouse 12+ ya no tiene categoría PWA: la instalabilidad
  (manifest con íconos 192/512 y maskable, service worker, offline) se revisa aparte.

## Firebase

Auth (Google) y Firestore con caché offline persistente. Proyecto: `watchlist-97b25`.
La config web va en `.env.local` (ver `.env.example`); son identificadores públicos, la
seguridad vive en [firestore.rules](firestore.rules).

```bash
pnpm test:rules          # reglas de Firestore contra el emulador (requiere Java)
pnpm emulators           # Auth + Firestore locales (proyecto demo-watch-order)
pnpm dev:emulators       # la app y /api conectadas a los emuladores, con cuentas de prueba
pnpm rules:deploy        # publica firestore.rules e índices en el proyecto real
```

- Sin sesión, el progreso vive en `localStorage` (modo invitado). Al entrar, la app ofrece
  pasarlo al perfil activo; por documento gana el cambio más reciente.
- Cerrar sesión borra la caché local de Firestore del dispositivo.
- En producción, `vercel.json` sirve `/__/auth/*` desde el propio dominio (necesario para el
  login por redirect en Safari / PWA de iOS). Al desplegar, cambiar `VITE_FIREBASE_AUTH_DOMAIN`
  al dominio de la app y agregarlo a los dominios autorizados de Firebase Auth.

## Anuncios

`AdSlot` (`src/components/AdSlot.tsx`) está listo pero apagado: sin `VITE_ADS_CLIENT` no
renderiza ni carga nada. Para activarlos: definir `VITE_ADS_CLIENT` (ca-pub-…) y
`VITE_ADS_SLOT_HUB`, poner la línea de la red en `public/ads.txt`, y antes publicar una
política de privacidad y un aviso de consentimiento (obligatorio en UE/UK). Si se añade una
CSP, permitir `pagead2.googlesyndication.com`. Los anuncios no van sobre controles ni en el
flujo de marcar como visto.

## Funciones (`/api`)

Funciones de Vercel con la firma Web estándar (`export function GET(request: Request)`).
En desarrollo, `pnpm dev` las sirve con un middleware de Vite: no hace falta `vercel dev`.

| Ruta | Qué hace | Caché CDN |
|---|---|---|
| `GET /api/providers?tmdbId=&type=movie\|tv&region=SV` | Dónde ver (JustWatch vía TMDB) | 24 h |
| `GET /api/upcoming?franchise=marvel,dc` | Estrenos por venir y temporadas/episodios nuevos de series en emisión | 6 h |
| `GET /api/calendar/{planId}.ics?u=&p=&k=` | Feed iCalendar de un plan de maratón, suscribible | privada, 5 min |
| `GET /api/og?kind=achievement\|franchise\|stats\|wrapped&lang=…` | Tarjeta PNG 1080×1080 para compartir (satori + resvg) | 1 año |
| `GET /api/og?kind=share&id=…` | Vista previa Open Graph (1200×630) de un link compartido | 1 h |
| `GET /{es,en}/s/{shareId}` → `/api/share` | Página pública de solo lectura, renderizada en el servidor | 1 min |
| `POST /api/groups/join` | Unirse a un grupo con el código de invitación (token de Firebase) | — |
| `GET /api/cron/notify-releases` | Cron diario: estrenos de hoy y en 7 días | — |
| `GET /api/cron/notify-streaming` | Cron diario: pendientes que llegaron a streaming en la región | — |

Variables de entorno de Vercel (solo servidor):

- `TMDB_API_KEY`: providers, upcoming y el cron de streaming.
- `CRON_SECRET`: cualquier cadena larga aleatoria; Vercel la manda a los crons.
- `FIREBASE_SERVICE_ACCOUNT`: el JSON completo de una cuenta de servicio del proyecto
  (Consola de Firebase → Configuración del proyecto → Cuentas de servicio → Generar nueva
  clave privada). La usan el feed de calendario, los links compartidos, unirse a grupos,
  los crons de avisos y `pnpm catalog:notify` (también como secreto de GitHub Actions).
  En desarrollo no hace falta: `pnpm dev:emulators` apunta `firebase-admin` al emulador.

### Feed de calendario

El planificador guarda en el plan (`users/{uid}/profiles/{pid}/plans/{planId}`) el calendario
recalculado y un `feedToken` aleatorio de 256 bits. La URL del feed incluye ese token: quien la
tenga ve el plan, y revocarla borra el token (la URL vieja da 404). La app mantiene el
calendario guardado al día mientras está abierta (al marcar vistos o al pasar los días).

## Social y avisos

- **Links compartidos** (`shares/`): una foto de solo lectura de una ruta, un orden
  personalizado o el progreso de una franquicia. Re-compartir actualiza el mismo link; se
  revocan o borran desde Cuenta. La página pública tiene prefijo de idioma (`/es/s/…`).
- **Grupos** (`groups/`): la meta es una franquicia o una ruta. Cada miembro publica en
  `groups/{id}/progress` solo lo que vio de esa meta. Unirse pasa por `/api/groups/join`;
  las reglas solo dejan al dueño editar y sacar miembros, y a cada miembro salirse.
- **Comparar** (`/compare`): dos perfiles de la misma cuenta, lado a lado.
- **Notificaciones push** (FCM): hace falta `VITE_FIREBASE_VAPID_KEY` (Consola de Firebase →
  Configuración del proyecto → Cloud Messaging → Certificados push web → Generar par de
  claves). El service worker de avisos es `public/firebase-messaging-sw.js`. En iOS solo
  funcionan con la PWA instalada (iOS 16.4+). Los crons están en `vercel.json`.
- **Recaps**: `src/data/recaps/{es,en}/{titleId}.md`, escritos desde cero (nunca copiados),
  en viñetas. El validador exige los dos idiomas y un título existente.

## Logros

`src/data/achievements.json` define los logros (reglas de SPEC §9.4); `lib/achievements.ts`
los evalúa en el cliente y solo se guarda la fecha de desbloqueo por perfil. El validador
revisa que cada regla apunte a franquicias, grupos, rutas y órdenes que existen. Los íconos
viven como datos en `lib/achievementIcons.ts` y los usan la app y `/api/og`.

## Catálogo

El catálogo es JSON versionado en `src/data/`:

- `titles.json`: cada título existe una sola vez, aunque pertenezca a varias franquicias.
- `franchises/<id>.json`: continuidades, pertenencia de títulos (`entries`), órdenes y rutas.

Agregar una franquicia = agregar su JSON (y sus títulos a `titles.json`). No hay que tocar código.

- **Series por temporada:** una entry puede llevar `"season": 2` para ubicar cada temporada en
  su lugar del orden (la T2 de Loki va años después de la T1). Si una serie se reparte, todas
  sus temporadas van así (el validador lo exige). En órdenes curados y rutas, `"loki-2021#2"`
  nombra una temporada y `"loki-2021"` la serie entera. El progreso sigue siendo del título:
  una temporada está vista si están todos sus episodios.
- **Líneas de tiempo compartidas:** una continuidad con `"timelineOf": "mcu"` se intercala con
  esa en el cronológico (mismo espacio de `chronoOrder`), como Netflix y ABC con el MCU.
- **Marvel:** el cronológico sigue el "MCU Complete Timeline" oficial de Marvel en Disney+
  (junio de 2026), más Agent Carter donde lo ponen Rotten Tomatoes y marvelwatchlist;
  `src/lib/marvelTimeline.test.ts` lo verifica.

```bash
pnpm catalog:validate    # referencias, chronoOrder duplicados, órdenes obligatorios (corre en CI)
pnpm catalog:enrich      # trae de TMDB duración, pósters, sinopsis (es/en), temporadas, imdbId
pnpm catalog:enrich --only loki-2021 --dry-run
pnpm catalog:lookup search collection Star Trek   # ids de TMDB para títulos nuevos
pnpm catalog:lookup collection 528                # películas de una colección, por fecha
```

Para agregar una franquicia: buscar los ids con `catalog:lookup`, agregar los títulos a
`titles.json` con lo mínimo (`id`, `tmdbId`, `tmdbType`, `title`, `kind`, `releaseDate`), escribir
`franchises/<id>.json` y correr `catalog:enrich --only <ids>` y `catalog:validate`. El color de
acento tiene que dar 4.5:1 de contraste con el texto encima (el validador lo exige).

`catalog:enrich` necesita `TMDB_API_KEY` (el *API Read Access Token* de TMDB) en `.env.local`.
Esa variable solo la leen los scripts y, más adelante, las funciones de `/api`; nunca llega al cliente.
El script también verifica el catálogo: reporta cada nombre o fecha que difiera de TMDB.

## Deploy (Vercel)

1. `vercel login` y `vercel link` (o importar el repo desde vercel.com). `vercel.json` ya fija
   framework, build (`pnpm build` → `dist/`), headers, rewrites y crons; Node 24.
2. Variables de entorno (Production y Preview): las `VITE_FIREBASE_*` de `.env.example`, con
   `VITE_FIREBASE_AUTH_DOMAIN` = dominio de la app, más `TMDB_API_KEY`,
   `FIREBASE_SERVICE_ACCOUNT` y `CRON_SECRET`.
3. Firebase: agregar el dominio a *Authentication → Settings → Authorized domains* y
   publicar las reglas con `pnpm rules:deploy`.
4. `vercel deploy --prod`. Los crons solo corren en producción.

## Nota legal

This product uses the TMDB API but is not endorsed or certified by TMDB.
