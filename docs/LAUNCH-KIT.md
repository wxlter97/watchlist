# Kit de lanzamiento

Material para explicar Watch Order en 10 segundos y para publicarlo. Todo sale de lo que la app
hace hoy; no hay cifras ni testimonios inventados. Dominio: https://watchlist.wxlter.dev

## En 10 segundos
**Watch Order te dice en qué orden ver una saga y guarda por dónde vas.**
Elige estreno, cronológico, curado o el tuyo; sigue rutas por personaje y «Prepárate para…» antes
de un estreno; funciona sin conexión. Gratis, en español e inglés.

- **Titular (el de la portada):** Tus sagas, en el orden que prefieras. / Your sagas, in the order you like.
- **Subtitular:** Más de 40 franquicias de cine y TV con órdenes de estreno, cronológico y rutas, y tu progreso en cada una.
- **CTA principal:** «Busca tu saga» (lleva al buscador). **CTA secundaria:** «Instalar la app».

## Para quién
- Quien quiere empezar una saga larga (Marvel, Star Wars, Star Trek, Saw…) sin perderse.
- Quien llega a un estreno y no recuerda qué ver antes («Prepárate para…»).
- Parejas y grupos que ven una saga juntos, cada quien a su ritmo.

## Casos de uso (cada uno es una página indexable)
- «¿Qué veo antes de Avengers: Doomsday?» → `/f/marvel/r/prep-avengers-doomsday-2026`
- «¿En qué orden veo Saw?» → `/f/saw`
- «Todo sobre un personaje» → las 57 rutas por personaje; «un tema» → 21 rutas por tema
- «¿Cómo funciona?» → `/guide` · «Preguntas frecuentes» → `/faq`

## Textos listos
**Bio (X / Mastodon / Instagram), ES:** Sagas de cine y TV en el orden que prefieras: estreno, cronológico y rutas. Gratis, sin cuenta. watchlist.wxlter.dev
**Bio, EN:** Movie & TV sagas in the order you like: release, chronological and routes. Free, no account needed.

**Product Hunt — tagline (≤60):** Watch any saga in the order you like — and track it
**Descripción corta:** Watch Order helps you follow movie and TV franchises: release, chronological or curated orders, “Get ready for…” routes before a release, a marathon planner and offline progress. Free, in English and Spanish.
**Primer comentario (maker):** Cuento por qué lo hice (me perdía al empezar sagas largas), qué hace distinto (órdenes + rutas curadas a mano + progreso por orden), qué falta (más franquicias; pídeme la tuya) y pido una cosa concreta: «dime qué saga te gustaría ver aquí».

**Anuncio (ES), plantilla:**
> Lancé Watch Order: eliges una saga, eliges el orden (estreno, cronológico, curado o el tuyo) y la app guarda por dónde vas. También tiene rutas «Prepárate para…» para llegar a un estreno sin perderte. Es gratis, funciona sin conexión y no pide cuenta. Pruébala con tu saga favorita: https://watchlist.wxlter.dev — y dime cuál falta.

**Reddit / comunidades:** lee primero las reglas de autopromoción de cada subreddit (muchos exigen participar antes o usar un hilo semanal). Publica como pregunta/utilidad («armé esto para no perderme en las sagas, ¿qué le falta?»), no como anuncio. Evita publicar el mismo texto en varios sitios el mismo día.

## Prueba social (cuando exista, de verdad)
No hay testimonios todavía y no se deben inventar. Cómo conseguirlos:
1. Tras ~2 semanas, escribe a quienes te hayan dado feedback por correo y pídeles permiso por escrito para citarlos.
2. Mide con GA4 el porcentaje que llega a `first_title_watched` y cuántas franquicias siguen: son datos reales para el anuncio.
3. Pon la cita (con nombre o alias y permiso) en la portada o en `/guide`, y márcala con fecha.

## Material gráfico
- **Capturas** (`public/screenshots/`, también en el manifiesto de la PWA): se regeneran con `pnpm build && pnpm preview --port 4173` y `pnpm screenshots`.
- **Imagen para compartir (1200×630):** `https://watchlist.wxlter.dev/api/og?kind=page&lang=es` (y `lang=en`); por franquicia, añade `&f=marvel`.
- **Íconos y marca:** `docs/BRAND.md`, `public/pwa-512.png`.

## Día del lanzamiento
1. `curl` a `/api/health` (debe traer el `commit` desplegado) y abrir `/`, `/f/saw`, `/en/f/saw`, `/faq`.
2. GA4 → Tiempo real: acepta el aviso y comprueba que llega un evento.
3. Publicar el anuncio; responder todos los comentarios el mismo día.
4. Revisar Vercel → Logs (`[client-error]`) cada pocas horas el primer día.
5. Anotar qué sagas piden (`search_no_results` en GA4 y correos) para la siguiente oleada del catálogo.
