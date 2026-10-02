# Watch Order — Especificación

PWA para seguir sagas y franquicias de cine y TV (Marvel, Star Wars, DC, Wizarding World, etc.) en varios órdenes de visualización, con seguimiento de progreso por perfil y sincronización entre dispositivos.

La arquitectura es **genérica desde el día uno**: una franquicia nueva se agrega con datos (JSON), sin tocar código. Marvel es la primera franquicia y sirve como referencia de complejidad máxima.

## 1. Stack

- **Frontend:** Vite + React + TypeScript
- **PWA:** `vite-plugin-pwa` (Workbox), instalable y funcional offline
- **Estado/UI:** React Router, Zustand (estado de UI), Tailwind CSS, `@dnd-kit` (orden personalizado)
- **i18n:** `react-i18next` (español e inglés)
- **Visualizaciones:** línea de tiempo en SVG propio; grafo de conexiones con Cytoscape.js o `react-force-graph`
- **Imágenes compartibles:** `@vercel/og` (tarjetas de logros, resumen anual y previews de links)
- **Notificaciones:** Firebase Cloud Messaging (Web Push)
- **Backend:** Firebase — Auth (Google) + Firestore con caché offline persistente (`persistentLocalCache` + `persistentMultipleTabManager`)
- **Hosting:** Vercel (incluye funciones serverless para proxy de TMDB)
- **Datos externos:** API de TMDB (pósters, duración, sinopsis, dónde ver)

## 2. Principios

1. **Offline-first:** la app abre y funciona sin conexión. Firestore maneja la cola de escrituras y la sincronización.
2. **Data-driven:** franquicias, continuidades, órdenes y rutas son datos. El código solo sabe interpretarlos.
3. **Un título existe una sola vez:** si *Logan* pertenece a X-Men y a Marvel, o *Batman v Superman* a DC y a Batman, es el mismo título con metadatos distintos por franquicia. Verlo una vez cuenta en todas.
4. **Catálogo separado del progreso:** el catálogo es JSON versionado en el repo; el progreso vive en Firestore.
5. **Sin spoilers por defecto:** sinopsis de lo no visto oculta hasta que el usuario la revela.
6. **La API key de TMDB nunca llega al cliente.**

## 3. Franquicias

### 3.1 Lanzamiento (v1)
1. **Marvel** — MCU, semicanon (Netflix, ABC), X-Men de Fox, Sony Spider-Verse, Spider-Man de Raimi y Webb
2. **Star Wars** — películas, series live-action, animadas (Clone Wars, Rebels, Bad Batch)
3. **DC** — DCEU/Snyderverse, nuevo DCU, Batman (continuidades separadas), Arrowverse
4. **Wizarding World** — Harry Potter y Animales Fantásticos
5. **Middle-earth** — El Hobbit, El Señor de los Anillos, Los Anillos de Poder, animadas
6. **MonsterVerse** — Godzilla, Kong, Monarch

### 3.2 Backlog completo

★ = orden complejo o disputado (varias continuidades, líneas temporales, reinicios o precuelas). Son las que más valor aportan y se priorizan.

**Superhéroes** (además de Marvel y DC)
The Boys (Gen V, Vought Rising) · Invincible · Hellboy ★ · Unbreakable (trilogía Eastrail 177) · Kick-Ass · Teenage Mutant Ninja Turtles ★ · Power Rangers ★ · Umbrella Academy

**Ciencia ficción**
Star Trek ★ · Alien ★ · Predator ★ · Alien vs. Predator (crossover) · Terminator ★ · Planet of the Apes ★ · Jurassic Park/World · Dune · Avatar · Mad Max ★ · The Matrix · Back to the Future · Men in Black · Tron · Transformers ★ · Godzilla de Toho (eras Showa, Heisei, Millennium, Reiwa) ★ · Gamera · Pacific Rim · Cloverfield ★ · Doctor Who (Torchwood, Sarah Jane) ★ · Stargate ★ · Battlestar Galactica ★ · RoboCop · Independence Day · Riddick · A Quiet Place · Los Juegos del Hambre ★ · Maze Runner · Divergente

**Fantasía y aventura**
Game of Thrones (House of the Dragon, A Knight of the Seven Kingdoms) ★ · Narnia ★ · The Witcher ★ · Piratas del Caribe · Indiana Jones · The Mummy ★ · Crepúsculo · Percy Jackson · Jumanji · Night at the Museum · Ghostbusters ★ · National Treasure · Highlander ★ · Conan

**Acción y espías**
James Bond (por actor y continuidad Craig) ★ · Mission: Impossible · Fast & Furious ★ · John Wick (Ballerina, The Continental) ★ · Bourne · Die Hard · Rambo · Rocky/Creed · Karate Kid/Cobra Kai ★ · Lethal Weapon · Bad Boys · The Expendables · Taken · Jack Ryan ★ · Jack Reacher · Kingsman ★ · Top Gun · The Equalizer · Ocean's · Ip Man

**Terror**
Conjuring Universe ★ · Halloween ★ · Scream · Saw ★ · Friday the 13th ★ · A Nightmare on Elm Street ★ · Texas Chainsaw Massacre ★ · Child's Play/Chucky ★ · Insidious ★ · Paranormal Activity ★ · Final Destination · The Exorcist ★ · Evil Dead ★ · Hellraiser · It · The Purge ★ · Terrifier · Candyman ★ · 28 Days Later ★ · The Ring (y Ringu) ★ · Ju-On/The Grudge ★ · Jaws · Universal Classic Monsters ★ · Hammer Horror · Hannibal Lecter (películas y serie) ★ · Scary Movie

**Series con universo propio**
Breaking Bad (Better Call Saul, El Camino) ★ · The Walking Dead Universe ★ · Yellowstone (1883, 1923) ★ · Dexter (New Blood, Original Sin, Resurrection) ★ · Buffy/Angel ★ · The X-Files ★ · Twin Peaks ★ · Vikings/Valhalla · Spartacus ★ · Downton Abbey (serie y películas) · The Sopranos (The Many Saints of Newark) · Peaky Blinders · Stranger Things · La Casa de Papel (Berlín) · Dark ★ · One Chicago ★ · Law & Order ★ · CSI ★ · NCIS ★ · Grey's Anatomy (Station 19, Private Practice) ★ · Bridgerton (Queen Charlotte) · Outlander ★

**Adaptaciones de videojuegos**
Resident Evil (live-action, animadas y reboot) ★ · Mortal Kombat ★ · Sonic · Silent Hill · Tomb Raider ★ · Halo · Fallout · The Last of Us · Arcane · Castlevania ★ · Five Nights at Freddy's · Street Fighter · Super Mario

**Animación occidental**
Pixar (incluida la "teoría Pixar") ★ · Toy Story · Shrek ★ · Madagascar ★ · Ice Age · Kung Fu Panda ★ · How to Train Your Dragon (animada y live-action) ★ · Despicable Me/Minions ★ · The Lego Movie ★ · Hotel Transylvania · Wallace & Gromit · Avatar: The Last Airbender/Korra ★ · Spider-Verse · Clásicos de Disney y sus secuelas ★

**Anime**
Dragon Ball ★ · Gundam ★ · Fate ★ · Evangelion ★ · Monogatari ★ · Haruhi Suzumiya ★ · Naruto/Boruto ★ · One Piece (películas y relleno) ★ · Bleach ★ · Attack on Titan · JoJo's Bizarre Adventure · Ghost in the Shell ★ · Macross ★ · Lupin III ★ · Detective Conan ★ · Pokémon ★ · Digimon ★ · Sailor Moon ★ · Yu-Gi-Oh! ★ · Code Geass ★ · Steins;Gate ★ · Demon Slayer ★ · Jujutsu Kaisen ★ · My Hero Academia ★ · Fullmetal Alchemist (2003 vs. Brotherhood) ★ · Hunter x Hunter ★ · Rurouni Kenshin ★ · Gintama ★ · Studio Ghibli

**Cine internacional**
YRF Spy Universe (Tiger, War, Pathaan) ★ · Lokesh Cinematic Universe ★ · Cop Universe de Rohit Shetty ★ · Baahubali · KGF · Dhoom · Infernal Affairs ★ · Detective Chinatown · Wolf Warrior · Train to Busan/Peninsula · Trilogía de la venganza de Park Chan-wook · Zatoichi ★

**Comedia y familiares**
Home Alone · Paddington · Spy Kids · Austin Powers · American Pie ★ · Meet the Parents · The Hangover · Rush Hour · Bill & Ted · Pitch Perfect · Legally Blonde · Diary of a Wimpy Kid ★ · Jackass · Cornetto Trilogy · View Askewniverse (Kevin Smith) ★ · Monty Python

**Clásicos y autor**
The Godfather ★ · Trilogía del dólar (Leone) · Before Trilogy · Tres Colores (Kieślowski) · Pink Panther ★ · The Dark Knight Trilogy (dentro de DC) · Kill Bill · Sherlock Holmes (Ritchie)

### 3.3 Priorización del backlog
1. Franquicias ★ con alta búsqueda (Star Trek, Alien/Predator, Terminator, Halloween, Conjuring, Godzilla, Fast & Furious, Bond, Game of Thrones, Breaking Bad, Dragon Ball, Fate).
2. Franquicias con estreno próximo (aprovechar picos de interés).
3. El resto, por categoría.

Algunas "franquicias" son pequeñas (trilogías sin continuidades): se agregan con solo órdenes de estreno y cronológico. El modelo lo soporta sin cambios.

> **Importante para Claude:** verificar cada título, fecha y temporada contra TMDB. No confiar solo en conocimiento previo; incluir estrenos recientes y anunciados.

## 4. Modelo del catálogo

```
src/data/
  titles.json              # todos los títulos, una vez cada uno
  franchises/
    marvel.json
    star-wars.json
    ...
```

### 4.1 Título (global)
```ts
type Kind = "movie" | "series" | "special" | "short" | "one-shot" | "ova";

interface Title {
  id: string;               // slug estable: "iron-man-2008"
  tmdbId: number;
  tmdbType: "movie" | "tv";
  imdbId?: string;          // enriquecido por script (external_ids de TMDB)
  title: string;
  kind: Kind;
  releaseDate: string;      // ISO
  seasons?: { number: number; episodes: number }[];
  runtimeMin?: number;      // enriquecido por script
  posterPath?: string;      // enriquecido por script
  overview?: string;        // enriquecido por script
  localized?: {             // enriquecido por script (TMDB con language=es-MX / en-US)
    [lang: string]: { title: string; overview?: string };
  };
  versions?: {              // cortes y ediciones alternativas
    id: string;             // "theatrical", "extended", "snyder-cut"
    name: string;
    runtimeMin: number;
    default?: boolean;
  }[];
}
```

### 4.2 Franquicia
```ts
type Importance = "essential" | "recommended" | "optional" | "skippable";

interface Franchise {
  id: string;               // "marvel"
  name: string;
  description: string;
  accentColor: string;      // tema visual de la franquicia
  continuities: Continuity[];
  entries: Entry[];         // pertenencia de títulos a la franquicia
  orders: OrderDef[];
  routes: Route[];
  tags: { characters: string[]; teams: string[] };
}

interface Continuity {
  id: string;               // "mcu", "fox-xmen", "halloween-2018-timeline"
  name: string;
  canonLevel: "main" | "semicanon" | "alternate" | "non-canon";
  description?: string;
  branchesFrom?: {          // para la línea de tiempo: de dónde se separa esta continuidad
    continuityId: string;
    afterTitleId: string;   // "Halloween (2018)" se separa después de "Halloween (1978)"
  };
}

interface Entry {
  titleId: string;
  continuityId: string;
  group?: string;           // fase, era, saga: "phase-3", "prequel-trilogy"
  chronoOrder?: number;     // posición in-universe dentro de la continuidad
  chronoNote?: string;      // "ambientada en 1995"
  importance: Importance;
  characters?: string[];
  teams?: string[];
  postCredits?: { mid: number; end: number };  // cantidad, nunca contenido
}
```

### 4.3 Órdenes
Los órdenes son de dos tipos: **calculados** (a partir de campos) o **curados** (lista explícita).

```ts
type OrderDef =
  | { id: string; name: string; type: "release" }
  | { id: string; name: string; type: "chronological" }
  | { id: string; name: string; type: "grouped"; groupLabels: Record<string, string> }
  | { id: string; name: string; type: "curated"; description: string; titleIds: string[] };
```

Ejemplos de curados: "Machete order" (Star Wars), "Ruta esencial" (Marvel), orden recomendado de Fate, Bond por actor.

Todas las franquicias tienen además, sin definirlo:
- **Personalizado** (drag & drop, por perfil)
- **Filtro por personaje/equipo** (dinámico, desde `tags`)

### 4.4 Rutas
```ts
interface Route {
  id: string;               // "spider-man", "prep-<titleId>"
  name: string;
  description: string;
  kind: "character" | "prep" | "theme";
  targetTitleId?: string;   // para "Prepárate para…"
  titleIds: string[];
}
```

Las rutas pueden referenciar títulos de otras franquicias (crossovers: *Alien vs. Predator*, *Godzilla vs. Kong*).

### 4.5 Enriquecimiento
- `scripts/enrich-catalog.ts`: consulta TMDB y completa `runtimeMin`, `posterPath`, `overview` y episodios en `titles.json`.
- `scripts/validate-catalog.ts`: verifica que todo `titleId` referenciado exista, que no haya `chronoOrder` duplicados por continuidad y que cada franquicia tenga al menos los órdenes de estreno y cronológico. Corre en CI.
- Pósters cacheados por el service worker (CacheFirst, con límite de entradas).

## 5. Autenticación y perfiles

- Login con Google (`signInWithPopup`; fallback a `signInWithRedirect` en iOS PWA instalada).
- Una cuenta puede tener **varios perfiles**, cada uno con su propio progreso.
- Modo invitado opcional con persistencia local; al iniciar sesión, ofrecer migrar el progreso.

## 6. Modelo de datos en Firestore

```
users/{uid}
  displayName, createdAt,
  settings {
    spoilerFree, streamingRegion, language: "es" | "en", followedFranchises[],
    externalLinks { letterboxd, imdb, trakt, letterboxdToast },
    notifications { releases, streamingAvailable, catalogUpdates }
  }

users/{uid}/devices/{fcmToken}
  platform, createdAt, lastSeenAt

users/{uid}/profiles/{profileId}
  name, avatar, color, createdAt

users/{uid}/profiles/{profileId}/progress/{titleId}
  status: "watched" | "watching" | "dropped" | "planned"
  watchedAt?: Timestamp
  rewatchCount: number
  rating?: number
  notes?: string
  episodes?: { [season: string]: number[] }
  versionId?: string        // corte visto; si falta, el default
  updatedAt: Timestamp

users/{uid}/profiles/{profileId}/franchiseState/{franchiseId}
  lastOrderId: string
  customOrder?: string[]
  hiddenContinuities?: string[]
  updatedAt: Timestamp

users/{uid}/profiles/{profileId}/plans/{planId}          # planificador de maratón
  name, goal { type: "route" | "franchise" | "order", refId }, deadline?: Timestamp,
  weeklyHours: number, availableDays: string[],
  schedule: { date: string; titleIds: string[] }[],
  calendarExported: boolean, createdAt, updatedAt

users/{uid}/profiles/{profileId}/achievements/{achievementId}
  unlockedAt: Timestamp

shares/{shareId}                                          # links públicos de solo lectura
  ownerUid, profileId, kind: "route" | "custom-order" | "progress",
  franchiseId?, title, snapshot, createdAt, revoked: boolean

groups/{groupId}                                          # ver en pareja o en grupo
  name, ownerUid, members: { [uid]: profileId }, franchiseId?, routeId?,
  inviteCode, createdAt

groups/{groupId}/progress/{titleId}
  watchedBy: { [uid]: Timestamp }, watchedTogether: boolean, updatedAt
```

- Logros se calculan en el cliente a partir del progreso; solo se persiste la fecha de desbloqueo.
- Los `shares` guardan un snapshot al momento de compartir (y se actualizan al re-compartir), para no exponer el progreso vivo.

- El progreso es **por título, no por franquicia**: marcar *Logan* como visto se refleja en Marvel y en X-Men.
- Conflictos: "gana el último cambio" por documento.

### Reglas de seguridad
```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    match /shares/{shareId} {
      allow read: if resource.data.revoked == false;
      allow create: if request.auth != null && request.resource.data.ownerUid == request.auth.uid;
      allow update, delete: if request.auth != null && resource.data.ownerUid == request.auth.uid;
    }
    match /groups/{groupId} {
      allow read: if request.auth != null && request.auth.uid in resource.data.members;
      allow create: if request.auth != null && request.resource.data.ownerUid == request.auth.uid;
      allow update: if request.auth != null && request.auth.uid in resource.data.members;
      // unirse a un grupo pasa por /api/groups/join (valida inviteCode con firebase-admin)
      allow delete: if request.auth != null && resource.data.ownerUid == request.auth.uid;
      match /progress/{titleId} {
        allow read, write: if request.auth != null
          && request.auth.uid in get(/databases/$(db)/documents/groups/$(groupId)).data.members;
      }
    }
  }
}
```

## 7. Funciones de Vercel (`/api`)

- `GET /api/providers?tmdbId=&type=&region=SV` → dónde ver. Cache `s-maxage=86400`.
- `GET /api/upcoming?franchise=` → próximos estrenos de las franquicias seguidas.
- `GET /api/og?kind=achievement|wrapped|share&id=` → imágenes compartibles y previews de links (`@vercel/og`).
- `GET /api/share/{shareId}` → página pública server-rendered con metadatos Open Graph.
- `POST /api/groups/join` → valida `inviteCode` y agrega al usuario al grupo (firebase-admin).
- `GET /api/calendar/{planId}.ics` → feed iCalendar del planificador (URL con token firmado, suscribible desde Google Calendar o Apple Calendar).
- **Cron diario** (`vercel.json`, compatible con plan Hobby: una vez al día):
  - `/api/cron/notify-releases` → push de estrenos de franquicias seguidas (hoy y en 7 días).
  - `/api/cron/notify-streaming` → revisa proveedores de los títulos pendientes de cada usuario y avisa cuando llegan a su región (cachear resultados para no exceder límites de TMDB).
- Push de "catálogo actualizado": se dispara desde CI al desplegar cambios en `src/data/`.
- Variables de entorno (solo servidor): `TMDB_API_KEY`, `FIREBASE_SERVICE_ACCOUNT`, `SHARE_SIGNING_SECRET`, `CRON_SECRET`.

## 8. Pantallas

1. **Hub:** franquicias seguidas con su progreso, "continuar viendo" (siguiente título por franquicia según el último orden usado), próximos estrenos, explorar franquicias.
2. **Franquicia:** selector de orden, filtro de continuidades, filtros (tipo, importancia, estado, personaje/equipo), progreso por grupo, tarjetas con póster, estado, importancia y post-créditos. Tema según `accentColor`.
3. **Detalle de título:** datos, sinopsis (oculta si aplica), dónde verlo, calificación, notas, episodios, rewatch, **"aparece en"** (otras franquicias o rutas que lo incluyen) y **enlaces externos** (sección 9.1).
4. **Rutas:** por personaje, temáticas, "Prepárate para…" y crossovers.
5. **Búsqueda global** de títulos en todas las franquicias.
6. **Estadísticas:** horas totales y por franquicia, títulos completados, racha, promedio de calificación, franquicia más vista.
7. **Perfiles** y **Ajustes:** modo sin spoilers, región de streaming, franquicias seguidas, exportar/importar JSON, cerrar sesión.
8. **Línea de tiempo:** vista por franquicia con continuidades como carriles paralelos (sección 9.3).
9. **Mapa de conexiones:** grafo explorable de títulos, personajes, equipos y crossovers.
10. **Planificador:** crear y ver planes de maratón, calendario semanal, exportar.
11. **Logros:** insignias desbloqueadas y por desbloquear, tarjetas compartibles.
12. **Resumen anual:** disponible en diciembre y bajo demanda.
13. **Grupos:** crear, invitar, progreso compartido.
14. **Página pública compartida:** vista de solo lectura sin login (ruta, orden o progreso).

## 9. Extras

- Etiquetas de importancia visibles y filtrables.
- Post-créditos: solo cantidad (mid/end), nunca contenido.
- Explicación breve de cada orden y continuidad (por qué existe, a quién le conviene).
- Exportar/importar progreso en JSON por perfil.
- Tema oscuro por defecto, identidad visual propia; sin logos ni arte oficial de estudios fuera de los pósters de TMDB.
- Móvil primero, accesible.

### 9.1 Enlaces externos (sin integración por API)
Botones en el detalle de título, construidos a partir de los IDs que ya guarda el catálogo:

| Servicio | URL | Disponible en |
|---|---|---|
| Letterboxd | `https://letterboxd.com/tmdb/{tmdbId}/` | Solo películas |
| IMDb | `https://www.imdb.com/title/{imdbId}/` | Películas y series con `imdbId` |
| Trakt | `https://trakt.tv/search/tmdb/{tmdbId}?id_type={movie\|show}` | Películas y series |

- Enlaces normales `https` con `target="_blank"` y `rel="noopener"`. Si el usuario tiene la app nativa instalada, el sistema decide si abrirla (Android suele abrirla directo; en iOS desde una PWA puede abrir Safari con el aviso de "abrir en la app").
- **Registrar en Letterboxd:** al marcar una película como vista, mostrar un toast con la acción "Registrar en Letterboxd" que abre el enlace de la película. No existe URL directa a la pantalla de registro; el usuario toca "Log" en Letterboxd.
- Ajuste para ocultar/mostrar cada servicio y para desactivar el toast.
- Verificar durante el desarrollo que las URLs de Letterboxd y Trakt por ID de TMDB sigan funcionando.

### 9.2 Planificación
- **Planificador de maratón:** el usuario elige una meta (ruta, franquicia u orden; opcionalmente con fecha límite, como un estreno), horas disponibles por semana y días. La app reparte los títulos pendientes en un calendario, respetando duración real (y versión elegida). Si no alcanza el tiempo, lo dice y propone la ruta esencial. Se recalcula al marcar vistos o atrasarse.
  - Exportar: archivo .ics, feed suscribible (`/api/calendar/{planId}.ics`) y creación de eventos en Google Calendar.
- **"Tengo X horas":** selector rápido de tiempo disponible; sugiere los siguientes títulos pendientes, en el orden activo, que quepan (películas completas o N episodios).
- **Versiones y cortes:** en el detalle, elegir qué versión se vio o se verá (teatral, extendida, del director). Las estadísticas y el planificador usan su duración.
- **Marcar rápido:** "marcar temporada completa" de un toque y "visto hasta aquí" (marca todo lo anterior en el orden activo, con confirmación y deshacer).

### 9.3 Visualización del universo
- **Línea de tiempo interactiva:** eje horizontal por `chronoOrder`, un carril por continuidad; las ramas se dibujan desde `branchesFrom`. Zoom, arrastre, tocar un título abre su detalle. Lo visto se resalta; en modo sin spoilers, lo no visto aparece como póster difuminado.
- **Mapa de conexiones:** nodos de títulos, personajes y equipos (desde `tags` y rutas de crossover); aristas por aparición compartida. Filtros por franquicia y continuidad. Útil para descubrir crossovers entre franquicias.
- **Recaps sin spoilers:** "lo que necesitas recordar" antes de ver un título: lista todo lo previo del linaje del título (lo mismo que "Prepárate para…"), visto o no, con el motivo de su relevancia (importancia, selección mínima, continuidad, nota cronológica). El recap de lo no visto queda oculto tras un aviso con el modo sin spoilers activo.
  - Contenido curado y escrito desde cero en `src/data/recaps/{lang}/{titleId}.md` (no copiar sinopsis ni textos de terceros). Se agregan gradualmente, empezando por los títulos `essential`.

### 9.4 Gamificación
- **Logros e insignias** definidos en `src/data/achievements.json`:
  ```ts
  interface Achievement {
    id: string;
    name: Record<string, string>;        // por idioma
    description: Record<string, string>;
    icon: string;
    rule:
      | { type: "complete-group"; franchiseId: string; group: string }
      | { type: "complete-franchise"; franchiseId: string; continuityId?: string }
      | { type: "complete-route"; routeId: string }
      | { type: "watched-in-order"; franchiseId: string; orderId: string }
      | { type: "count"; metric: "titles" | "hours" | "franchises"; value: number }
      | { type: "streak"; days: number };
  }
  ```
  Evaluación pura en `lib/achievements.ts`, con tests.
- **Rachas:** días consecutivos con al menos un título o episodio marcado.
- **Tarjeta compartible:** imagen generada por `/api/og` (logro, franquicia completada, horas, calificación promedio). Compartir con Web Share API; fallback a descargar.
- **Resumen anual (Wrapped):** horas vistas, franquicia del año, título mejor calificado, mes más activo, logros del año. Una secuencia de pantallas deslizables y una tarjeta final compartible.

### 9.5 Social
- **Links compartibles:** compartir una ruta, un orden personalizado o el progreso de una franquicia como página pública de solo lectura, con preview Open Graph. El usuario puede revocar el link.
- **Grupos (ver en pareja o en grupo):** un grupo tiene miembros (cada uno con un perfil) y opcionalmente una franquicia o ruta objetivo. Muestra qué vio cada quien, qué vieron juntos y el "siguiente para ver juntos". Invitación por link con código.
- **Comparar progreso:** vista lado a lado entre perfiles de la misma cuenta o miembros de un grupo.

### 9.6 Notificaciones
- Web Push con FCM. En iOS solo funciona con la PWA instalada en la pantalla de inicio (iOS 16.4+); la app debe explicarlo al pedir permiso.
- Pedir permiso solo tras una acción del usuario (por ejemplo, al seguir una franquicia), nunca al abrir la app.
- Tipos: estrenos de franquicias seguidas, título pendiente disponible en streaming en su región, franquicias o títulos nuevos en el catálogo. Cada tipo se activa por separado en Ajustes.

### 9.7 Idiomas
- Interfaz en español e inglés con `react-i18next`; idioma detectado del navegador y editable en Ajustes.
- Títulos y sinopsis localizados desde `localized` (enriquecido de TMDB); nombres de órdenes, rutas, logros y continuidades traducidos en los JSON.
- Rutas públicas con prefijo de idioma (`/es/...`, `/en/...`).

## 10. Estructura sugerida

```
src/
  data/           titles.json, franchises/*.json, achievements.json, recaps/{lang}/{titleId}.md
  locales/        es.json, en.json
  lib/            firebase.ts, tmdb.ts, catalog.ts (carga e índices)
                  orders.ts, achievements.ts, planner.ts, streaks.ts, ics.ts (lógica pura, con tests)
  hooks/          useAuth, useProfile, useProgress, useFranchise, useCatalog, usePlan, useGroup
  features/       hub/, franchise/, detail/, routes/, search/, stats/, profiles/, settings/,
                  timeline/, graph/, planner/, achievements/, wrapped/, groups/, share/
  components/     UI compartida
  sw/             firebase-messaging-sw.ts (push en segundo plano)
api/              providers.ts, upcoming.ts, og.tsx, share/[id].ts, groups/join.ts,
                  calendar/[planId].ts, cron/notify-releases.ts, cron/notify-streaming.ts
scripts/          enrich-catalog.ts, validate-catalog.ts, notify-catalog-update.ts
firestore.rules   reglas de seguridad (probadas con el emulador)
vercel.json       crons y headers
```

## 11. Fases de desarrollo

1. **Base genérica:** Vite + React + TS + Tailwind + PWA; modelo de catálogo, `orders.ts` y validador; Marvel (solo MCU) con órdenes de estreno y cronológico; progreso local.
2. **Sync:** Firebase Auth con Google, Firestore con caché offline, perfiles, migración invitado → cuenta.
3. **Marvel completo:** continuidades semicanon, Fox, Sony; enriquecimiento TMDB; filtros; órdenes agrupados y curados; rutas y "Prepárate para…".
4. **Hub y multi-franquicia:** pantalla Hub, búsqueda global, "aparece en"; agregar Star Wars, DC, Wizarding World, Middle-earth y MonsterVerse.
5. **Extras base:** dónde ver, próximos estrenos, estadísticas, modo sin spoilers, export/import, enlaces externos, marcar rápido, versiones y cortes, i18n.
6. **Planificación y visualización:** planificador de maratón con exportación a calendario, "Tengo X horas", línea de tiempo, mapa de conexiones.
7. **Gamificación:** logros, rachas, tarjetas compartibles (`/api/og`), resumen anual.
8. **Social y notificaciones:** links compartibles, grupos, comparar progreso, Web Push con cron diario, recaps (empezando por títulos esenciales).
9. **Pulido:** tests de `orders.ts`, `planner.ts`, `achievements.ts` y del validador (Vitest), reglas probadas con el emulador de Firestore, Lighthouse PWA ≥ 90, deploy en Vercel.
10. **Oleadas siguientes:** franquicias del backlog (sección 3.2) según la priorización de la sección 3.3, en lotes por categoría.

## Nota legal
Proyecto gratuito y no comercial. Incluir en "Acerca de" el logo de TMDB y el aviso: "This product uses the TMDB API but is not endorsed or certified by TMDB."

## 12. Criterios de aceptación

- Agregar una franquicia nueva requiere solo archivos JSON y pasa el validador sin cambios de código.
- Un título compartido entre franquicias se marca una vez y aparece visto en todas.
- La app abre y permite marcar títulos sin conexión; los cambios aparecen en otro dispositivo al reconectar.
- Cambiar de orden, continuidad o filtro no pierde progreso ni posición.
- Ningún secreto aparece en el bundle del cliente.
- Un usuario no puede leer ni escribir datos de otro.
- Un link compartido muestra solo el snapshot, deja de funcionar al revocarlo y nunca expone el progreso vivo ni datos de la cuenta.
- Solo los miembros de un grupo pueden ver y editar su progreso; unirse requiere un código de invitación válido.
- El planificador nunca programa más horas por semana que las indicadas y se recalcula al marcar títulos.
- El recap de un título solo incluye contenido de títulos que el perfil ya marcó como vistos.
- Los logros se desbloquean de forma determinista a partir del progreso (mismo progreso, mismos logros).
- Las notificaciones solo se envían si el usuario activó ese tipo, y nunca se pide permiso al abrir la app.
- Toda la interfaz está disponible en español e inglés.
