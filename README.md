# Watch Order

PWA para seguir sagas y franquicias de cine y TV en varios órdenes de visualización.
La especificación completa está en [docs/SPEC.md](docs/SPEC.md).

**Estado:** fase 8 — links compartibles, grupos, comparar progreso, notificaciones push y recaps.

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
pnpm dev:emulators       # la app y /api conectadas a los emuladores, con cuentas de prueba
pnpm rules:deploy        # publica firestore.rules e índices en el proyecto real
```

- Sin sesión, el progreso vive en `localStorage` (modo invitado). Al entrar, la app ofrece
  pasarlo al perfil activo; por documento gana el cambio más reciente.
- Cerrar sesión borra la caché local de Firestore del dispositivo.
- En producción, `vercel.json` sirve `/__/auth/*` desde el propio dominio (necesario para el
  login por redirect en Safari / PWA de iOS). Al desplegar, cambiar `VITE_FIREBASE_AUTH_DOMAIN`
  al dominio de la app y agregarlo a los dominios autorizados de Firebase Auth.

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
