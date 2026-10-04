# Auditoría pre-lanzamiento

Fecha: 4 de octubre de 2026. Revisado el código del repo (rama `main` + PR #23), `vercel.json`,
`firestore.rules`, la API, los textos legales y `pnpm audit`. **No** se tocó nada fuera del repo:
Vercel, Firebase, DNS, Search Console y cuentas de terceros quedan como pendientes manuales.
No se corrió Lighthouse en esta revisión (el README declara ≥90 en rendimiento y 100 en las demás
categorías para la portada).

Leyenda: ✅ listo · ⚠️ parcial · ❌ falta · ➖ no aplica · 🔧 manual (fuera del repo)

## Estado tras la primera pasada (rama `chore/launch-seo-security`)

Hecho en código (las tablas de abajo describen el estado **antes** de esta pasada):

- **SEO/GEO:** título, descripción, canonical y `noindex` por ruta (`src/lib/meta.ts`); página 404
  propia; `/f/{id}` y `/t/{id}` salen de `api/page.ts` con HTML real, Open Graph, Twitter Card,
  JSON-LD (`ItemList`, `Movie`/`TVSeries`, `BreadcrumbList`) y el listado en texto, y **responden
  404 de verdad** si el id no existe; portada con Open Graph y `WebApplication` en el HTML
  estático; `/sitemap.xml`, `/robots.txt` (con `Sitemap:`) y `/llms.txt` dinámicos desde el catálogo;
  tarjeta OG genérica (`/api/og?kind=page`); `X-Robots-Tag: noindex` en las rutas privadas.
- **Seguridad:** CSP en modo `report-only` (las violaciones llegan a `/api/log` como
  `[csp-report]`); vulnerabilidades de `pnpm audit --prod` resueltas con `pnpm.overrides`
  (0 conocidas); `.github/dependabot.yml`.
- **Monitoreo:** `GET /api/health`; `notify-releases` ya no repite el aviso si el cron se reintenta.
- **Legal/soporte:** política con base legal, transferencias y retención de logs; Términos con
  donaciones y reporte de abusos; enlace "Contacto y reportes" (mailto work@wxlter.dev) en el pie (correo work@wxlter.dev).

- **Analytics:** GA4 con consentimiento previo (`src/lib/analytics.ts`, `VITE_GA_ID`): páginas vistas
  y los eventos `follow_franchise`, `title_watched`, `first_title_watched` (activación),
  `sign_in_started`, `install_accepted`/`install_dismissed`, `notifications_enabled`,
  `share_created` y `search_no_results`. Sin señales de Google ni datos de cuenta; política y aviso
  actualizados. **Logo de TMDB** en el pie.

- **Datos y docs:** exportación completa de datos de la persona; `docs/OPERATIONS.md` (rollback,
  backups y restauración, incidentes, filtración, solicitudes de usuarios) y `CHANGELOG.md`.

## Estado a 4 de octubre de 2026 (producción: https://watchlist.wxlter.dev)

**Hecho y verificado:** dominio y `VITE_SITE_URL`; sitemap, robots y llms.txt con el dominio real;
rutas, canonical y 404 en producción; Vercel en 11 funciones; rate limit (una regla en Firewall);
uptime monitor sobre `/api/health`; 2FA en las cuentas administrativas; GA4 recibiendo datos; logo
de TMDB y contacto work@wxlter.dev; textos legales revisados; e2e de flujos críticos en CI.

**Pendiente, tuyo**
- GA4: desactivar Google signals, retención de 2 meses, aceptar los términos de procesamiento de
  datos y marcar los eventos clave (`first_title_watched`, `follow_franchise`, `install_accepted`).
- Bing Webmaster Tools (importar desde Search Console) y confirmar que Google lea el sitemap.
- Restringir la clave web de Firebase por dominio.
- CSP: revisar `[csp-report]` unos días y pasarla de report-only a enforce (probar el login).
- Prueba manual en Android e iPhone (lista de RELEASE.md).
- **Pospuesto:** backups y restauración de Firestore (plan Blaze); entorno de pruebas/Preview con
  Firebase aparte; App Check (opcional).

**Pendiente, mío**
- Lighthouse y accesibilidad sobre producción; reducir el precache del service worker (~2000
  archivos); pasada de textos de avisos (toasts) y del login; e2e de login, borrado de cuenta y
  sincronización con los emuladores de Firebase (requiere Java).

**Pospuesto a propósito (dependen de tener tráfico o de decisiones de marca)**
- Landing con casos de uso, FAQ pública y comparativas/alternativas (GEO avanzado).
- Lanzamiento: Product Hunt, Reddit/comunidades, redes sociales, anuncio y email de lanzamiento.
- Redirigir automáticamente a `/en` a quien llega con navegador en inglés (hoy no se hace adrede).
- Revisar cómo aparece el producto en ChatGPT, Gemini, Perplexity y Google AI, cuando esté indexado.

**Después del lanzamiento:** primeras 24 h (errores `[client-error]`, los dos crons, cuota de
TMDB, eventos en GA4); primera semana (indexación, consultas de búsqueda, `search_no_results`,
conversión a `first_title_watched`); primer mes (retención y cohortes).

## Lo que importa antes de lanzar (por prioridad)

| # | Hallazgo | Área | Esfuerzo |
|---|----------|------|----------|
| 1 | **Todas las rutas comparten el mismo `<title>`, descripción y HTML.** Es una SPA sin prerender: Google ve solo "Watch Order" y los rastreadores de IA (que no ejecutan JS) ven solo el app shell. Las 46 páginas de franquicia, que son el contenido indexable, no existen para un buscador. | SEO / GEO | Alto |
| 2 | **No hay `sitemap.xml`, canonical, JSON-LD ni Open Graph/Twitter en la app** (solo en los links compartidos `/es/s/…`). Compartir el dominio raíz en WhatsApp/X no muestra imagen ni título propios. | SEO | Medio |
| 3 | **Rutas desconocidas responden 200** (rewrite a `index.html` + `path: "*"` → Hub): soft 404. | SEO | Bajo |
| 4 | **Sin CSP.** Hay `nosniff`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, pero no CSP. | Seguridad | Medio |
| 5 | **Sin rate limiting** en `/api/*`. `/api/og` renderiza PNG con satori por cada combinación de parámetros; `/api/providers`, `/api/credits` y `/api/upcoming` gastan cuota de TMDB; `/api/log` acepta cualquier POST; `/api/groups/join` permite probar códigos de invitación (con sesión). | Seguridad / costo | Medio |
| 6 | **`pnpm audit --prod`: 1 alta, 2 moderadas, 1 baja** (`@grpc/grpc-js` vía firebase, `uuid` vía firebase-admin, `fflate` vía satori). No hay Dependabot/Renovate. | Seguridad | Bajo |
| 7 | **Sin alertas ni uptime.** Los errores del cliente van a los logs de Vercel (`[client-error]`) pero nadie se entera; los crons y la API no tienen monitoreo; no hay `/api/health`. | Monitoreo | Medio |
| 8 | **Sin analytics.** Es una decisión coherente con la política de privacidad, pero no sabrás si alguien activa la app. | Analytics | Medio |
| 9 | **Contacto solo "desde wxlter.dev"**; no hay correo de soporte, ni forma de reportar un bug o abuso. | Soporte / legal | Bajo |
| 10 | Textos legales: falta base legal (GDPR), transferencias internacionales (Firebase/Vercel en EE. UU.), retención de logs y el logo de TMDB. | Legal | Bajo |

---

## 1. SEO

| Ítem | Estado | Detalle |
|---|---|---|
| `title` y description por página | ❌ | Un solo `<title>Watch Order</title>` y una description en [index.html](../index.html); no hay `document.title` por ruta. Solo las páginas `/s/…` de [api/share.ts](../api/share.ts) tienen título propio. |
| Open Graph / Twitter Cards | ⚠️ | Solo en `/s/…` (og:title, og:image 1200×630, og:locale, hreflang). En el dominio raíz y en `/f/…` no hay nada. |
| Favicon / apple-touch / manifest | ✅ | `favicon.png`, `apple-touch-icon.png`, íconos 192/512/maskable. |
| `sitemap.xml` | ❌ | No existe, y `robots.txt` no lo declara. |
| `robots.txt` | ⚠️ | Existe (`Disallow: /api/`). Falta `Sitemap:` y decidir postura frente a bots de IA. |
| Canonical | ❌ | Ninguno. |
| URLs limpias | ✅ | `/f/{franquicia}`, `/t/{título}`, `/f/{f}/r/{ruta}`. Estables mientras no cambien los ids del catálogo. |
| H1/H2/H3 | ✅ | Un H1 por pantalla (el shell lo trae en `/`). No auditado con herramienta. |
| Alt text | ✅ | Los pósters son decorativos (`alt=""`) y el título va en texto al lado; correcto. Los íconos de `ui.tsx` son `aria-hidden`. |
| Structured data | ❌ | Sin JSON-LD. |
| Página 404 | ❌ | `path: "*"` renderiza el Hub con 200 ([App.tsx](../src/App.tsx)). |
| Redirecciones 301 | ➖ | No hay URLs viejas. `vercel.json` solo reescribe. |
| Contenido duplicado | ⚠️ | ES y EN comparten la misma URL (el idioma sale de localStorage/navegador), así que no hay duplicado, pero tampoco se puede indexar en dos idiomas. |
| Search Console / Bing | 🔧 | Verificar el dominio y enviar el sitemap cuando exista. |
| Core Web Vitals | ⚠️ | App shell + chunks + precarga de fuente están bien pensados; falta medir en campo (Vercel Speed Insights) y correr Lighthouse en la versión desplegada. |
| SEO local / blog | ➖ | — |

**Recomendación.** Es el cambio más grande y el que más rinde: generar HTML estático por franquicia
en el build (un plugin de Vite, o una función `/api/page` como la de `share.ts`, con el catálogo ya
disponible) con `<title>`, description, canonical, OG, JSON-LD y el contenido visible (nombre,
descripción, lista de títulos en orden). React lo reemplaza al montar, igual que el shell actual.
Mientras tanto, lo mínimo: `document.title` por ruta, sitemap generado desde `src/data/`, 404 real
para rutas que no existan y `noindex` en `/account`, `/plans`, `/groups`, `/join`, `/compare`, `/wrapped`.

## 2. GEO / AI search

| Ítem | Estado | Detalle |
|---|---|---|
| Qué hace el producto, claro | ⚠️ | La tagline y la description de una línea existen, pero solo en el shell; no hay una página pública que explique el producto. |
| Contenido que responda preguntas | ❌ | Lo valioso (descripciones de franquicia, "por qué importa", resúmenes en `src/data/why` y `recaps`) vive dentro del JS, invisible para bots. Preguntas como "¿en qué orden ver Marvel?" son justo lo que la app resuelve. |
| FAQ pública / casos de uso / comparaciones | ❌ | Ninguna. |
| Schema.org | ❌ | Ver SEO. `WebApplication` (portada), `ItemList` + `Movie`/`TVSeries` (franquicias) y `FAQPage`. |
| `llms.txt` | ❌ | Opcional y barato: describir el producto y enlazar el sitemap y las páginas de franquicia. |
| Datos consistentes de contacto | ⚠️ | Contacto solo por wxlter.dev. |
| Cómo aparece en ChatGPT/Gemini/Perplexity | 🔧 | Revisar tras publicar y tener el HTML indexable. |

## 3. Legal

Las páginas `/privacy` y `/terms` existen ([es.json `legal.*`](../src/locales/es.json)), con fecha
(30 sep 2026), y el texto es honesto con lo que la app hace. Lo revisado contra el código:

| Ítem | Estado | Detalle |
|---|---|---|
| Privacy / Terms | ✅ | En ES y EN. Cubren invitado vs. cuenta, terceros (Firebase, Vercel, TMDB/JustWatch, AdSense), registro de errores, retención, derechos, menores. |
| Cookie policy / consent | ✅ | No se usan cookies de terceros; solo localStorage/IndexedDB para funcionar. El consentimiento ([ConsentBanner](../src/components/ConsentBanner.tsx)) solo aparece con anuncios activos y el script no carga sin «Aceptar». Hoy los anuncios están apagados. |
| Reembolsos / suscripciones / cancelación | ➖ | No se cobra nada. El botón de donación es un enlace externo; conviene una línea en Términos aclarando que no es una compra ni da derechos. |
| Disclaimer | ✅ | "Tal cual", orden orientativo, sin alojar contenido. |
| Contenido de usuarios | ⚠️ | Se menciona que links y grupos son visibles; no hay política de contenido ni vía para reportar abuso. |
| Propiedad intelectual / marcas | ✅ | Marcas de sus dueños, no avalada por TMDB. ⚠️ TMDB pide además mostrar su **logo** en la sección de créditos; hoy es solo texto. |
| Licencias de fuentes/íconos | ✅ | Archivo, Archivo Black y JetBrains Mono vía Fontsource (SIL OFL). Íconos propios. No hay `LICENSE` en el repo (`"private": true`), lo cual es consistente. |
| GDPR / CCPA | ⚠️ | Hay derechos, exportación, borrado y reclamación ante la autoridad. Faltan: base legal por tratamiento, responsable con dirección o correo, transferencias a EE. UU., cuánto se retienen los logs de Vercel. CCPA no aplica hoy (no se vende ni comparte). |
| Edad mínima | ✅ | "No dirigida a menores de 13". |
| Emails de marketing | ➖ | No se envían correos. |
| Eliminar cuenta / exportar datos | ✅ / ⚠️ | Eliminar: perfiles, progreso, links, grupos propios y usuario de Auth. Exportar: el JSON de Cuenta → Copia de seguridad cubre el progreso y el estado de franquicias, no planes, logros ni ajustes; la política dice "tu progreso", así que es coherente, pero un reclamo GDPR de portabilidad pediría todo. |
| DPA con proveedores | 🔧 | Aceptar los DPA de Google (Firebase) y Vercel desde sus consolas. |
| Leyes locales | 🔧 | Confirmar con quien corresponda según tu jurisdicción; esto no es asesoría legal. |

## 4. Seguridad

| Ítem | Estado | Detalle |
|---|---|---|
| HTTPS / HSTS | ✅ / 🔧 | Vercel sirve HTTPS y, por defecto, `Strict-Transport-Security`. Verificar con `curl -I https://<dominio>` en el dominio final. |
| Security headers | ⚠️ | [vercel.json](../vercel.json): `nosniff`, `Referrer-Policy`, `X-Frame-Options: SAMEORIGIN`, `Permissions-Policy`. |
| CSP | ❌ | Sin CSP. Hay que permitir Firebase (Auth/Firestore/FCM), `image.tmdb.org`, Google Fonts (solo `/s/…`) y, con anuncios, `pagead2.googlesyndication.com` (ya anotado en el README). Empezar con `Content-Security-Policy-Report-Only`. |
| CORS | ✅ | Sin cabeceras CORS: las funciones solo responden al mismo origen. |
| CSRF | ✅ | `groups/join` usa `Authorization: Bearer` (no cookies); el resto son GET públicos. |
| XSS | ✅ | React escapa; las páginas HTML de [api/share.ts](../api/share.ts) usan `esc()` en todo lo que viene del snapshot. |
| Inyección NoSQL | ✅ | Rutas de Firestore armadas con ids validados con regex (`^[A-Za-z0-9_-]{1,128}$`). |
| Rate limiting / brute force | ❌ | Ninguno. Ver hallazgo 5. En `groups/join` el código es de 4–16 caracteres alfanuméricos y exige sesión, pero un usuario autenticado puede intentar sin límite. Las reglas de Vercel Firewall (rate limit) lo cubren sin código. |
| Validación de inputs | ✅ | Todas las funciones validan parámetros y recortan tamaños (`api/log.ts`: 8 kB, campos truncados). |
| Reglas de Firestore | ✅ | Por usuario, links públicos solo por id, grupos con membresía, `system/` cerrado, con pruebas en emulador ([firestore.rules](../firestore.rules)). |
| Secrets | ✅ | `.env*.local` ignorado; `TMDB_API_KEY` solo en servidor; [check-bundle](../scripts/check-bundle.ts) falla el CI si un secreto llega a `dist/`. 🔧 Rotar `CRON_SECRET` y `TMDB_API_KEY` si alguna vez se pegaron en un chat o log. |
| Feeds `.ics` | ✅ | URL con token de 64 hex, comparación en tiempo constante, rotable por el usuario. |
| Stack traces / logs | ✅ | `errorResponse` devuelve "Error interno" en 500; `/api/log` no guarda cuenta ni progreso. Nota: `HttpError` sí devuelve su mensaje (son mensajes propios, no internos). |
| Dependencias | ⚠️ | `pnpm audit --prod`: alta `@grpc/grpc-js <1.13.6` (vía `firebase`, ruta de Node; el navegador no la usa), moderadas `uuid` (firebase-admin) y `fflate` (satori), baja grpc. Satori tiene 0.35.0 disponible. Resolver con `pnpm update firebase firebase-admin satori` o `pnpm.overrides`. El CI ya corre `audit` (informativo). |
| Dependabot/Renovate | ❌ | No hay `.github/dependabot.yml`. |
| 2FA, roles | 🔧 | Activar 2FA en GitHub, Vercel, Firebase/Google Cloud, TMDB y el registrador del dominio. No hay panel de admin en la app. |
| Clave web de Firebase | 🔧 | Es pública por diseño, pero conviene restringirla por referrer en Google Cloud y considerar App Check. |
| Backups / restauración | 🔧 | Firestore no tiene backups configurados desde el repo: activar PITR o exportaciones programadas y probar una restauración. |
| Plan ante filtración | ❌ | No hay procedimiento escrito (ver Documentación). |

## 5. Analytics

| Ítem | Estado | Detalle |
|---|---|---|
| Analytics / product analytics | ❌ | Ninguno, por diseño. Solo `[client-error]` en logs. |
| Eventos / funnels / activación | ❌ | Sin medición. |
| Revenue / churn / conversiones | ➖ | No hay cobro. |
| UTM / atribución | ➖ | Hasta que haya campañas. |

**Recomendación.** Una herramienta sin cookies (Vercel Web Analytics + Speed Insights, Plausible o
Umami) evita el banner de consentimiento y encaja con la política actual; actualizar `legal.privacy`
si se añade. Embudo útil para esta app: `hub_view → follow_franchise → first_title_watched`
(activación) `→ signup_completed → push_enabled`; más `install_prompt_accepted`, `share_created` y
`search_no_results` (qué sagas faltan en el catálogo).

## 6. Monitoreo de errores

| Ítem | Estado | Detalle |
|---|---|---|
| Errores del cliente | ⚠️ | Capturados (`error`, `unhandledrejection`, render) y enviados a `/api/log`; sin agrupar ni alertar. |
| Errores del backend | ⚠️ | `console.error` en las funciones; quedan en logs de Vercel. |
| Alertas / uptime / health / status page | ❌ | Ninguno. Mínimo viable: un `GET /api/health`, un monitor externo gratuito (UptimeRobot, Better Stack) y alerta por correo si falla; opcionalmente Sentry (plan gratuito) o un log drain de Vercel con filtro `[client-error]`. |
| Cron jobs | ⚠️ | `notify-releases` y `notify-streaming` corren una vez al día sin alerta si fallan. |

## 7. Infraestructura

| Ítem | Estado | Detalle |
|---|---|---|
| Hosting, CDN, SSL, compresión | ✅ | Vercel (Brotli, CDN, caché inmutable para `/assets`, `s-maxage` en la API). |
| CI/CD | ✅ | GitHub Actions: catálogo, tipos, pruebas con cobertura, build, bundle, funciones ESM, e2e, reglas, auditoría. |
| Deploy / rollback | ✅ / 🔧 | Deploy automático por Vercel; rollback con "Instant Rollback" (no documentado). |
| Staging separado | ⚠️ | Los previews de Vercel hacen de staging, pero usan las mismas variables y, probablemente, el mismo proyecto de Firebase que producción. Conviene un proyecto de Firebase de pruebas para Preview. |
| Dominio / DNS | 🔧 | Pendiente: dominio definitivo, `VITE_FIREBASE_AUTH_DOMAIN` y dominios autorizados en Firebase Auth (ya está en [RELEASE.md](RELEASE.md)). |
| Cron duplicados | ⚠️ | `notify-streaming` guarda estado en `system/` para no repetir; `notify-releases` no lo hace, así que un reintento de Vercel enviaría el aviso dos veces. |
| Migraciones | ➖ | Firestore sin esquema; `migrate.ts` cubre el progreso local. |
| Imágenes | ✅ | Pósters desde el CDN de TMDB en `w92–w342` con caché de 90 días en el service worker. |

## 8. Email y 9. Pagos

➖ No aplican: no se envían correos propios (el login es solo Google y los avisos son push) y no
se cobra. Solo queda la nota sobre la donación en Términos.

## 10. Cuenta / identidad

| Ítem | Estado | Detalle |
|---|---|---|
| Login Google / logout | ✅ | Con redirect propio (`/__/auth`) para Safari/PWA. |
| Eliminar cuenta | ✅ | Pide reautenticación si el login es viejo. |
| Exportar datos | ⚠️ | Solo progreso y franquicias (ver Legal). |
| Contraseñas, cambio de email, 2FA, enumeración | ➖ | Los gestiona Google. |
| Sesiones activas / cerrar en todos | ➖ | Firebase Auth; no hay pantalla propia. |

## 11–13. UX, responsive y accesibilidad

Revisado en esta sesión (cambios del PR #23): estados de carga, vacío, error y offline existen; el
overflow horizontal a 375 px y la pantalla de Cuenta a 1280 px quedaron probados. Hay
`prefers-reduced-motion` ([index.css](../src/index.css)), estados de foco visibles, tabs con
`role="radiogroup"` y un `errorElement` global. **No** se hizo en esta auditoría: pruebas en
Safari/Firefox/Edge, iPhone pequeño, landscape, texto ampliado, lector de pantalla ni revisión
WCAG completa. Eso queda como pasada manual (la lista de RELEASE.md cubre Android + iPhone).

## 14–15. Performance y QA

- ✅ Code splitting por página, catálogo por partes, shell en HTML, precarga de fuente, límite de
  bundle (`check:bundle`). El chunk de Firebase (~620 kB) es el más pesado y ya está aislado.
- ✅ 444 pruebas unitarias, pruebas de reglas de Firestore y e2e de PWA (manifest, español,
  offline, rutas seguidas). ⚠️ El e2e no recorre aún los viajes críticos (login, marcar visto,
  sincronizar, borrar cuenta); esos van en la lista manual. Playwright no está instalado en este
  equipo (`pnpm install` lo trae).

## 16–17. Documentación y soporte

| Ítem | Estado |
|---|---|
| README, SPEC, BRAND, RELEASE | ✅ |
| Variables de entorno | ✅ ([.env.example](../.env.example)) |
| Backup / restauración / rollback / incidentes / troubleshooting | ❌ No documentados |
| Changelog / versionado | ❌ (`version: 0.1.0`, sin CHANGELOG) |
| Soporte: correo, FAQ, reportar bug o abuso, feedback | ❌ Solo "wxlter.dev". Un `mailto:` o GitHub Issues enlazado desde el pie y Cuenta bastaría. |

## 18–20. Marketing, branding e internacionalización

- ✅ Branding: logo, favicon, íconos PWA, paleta y tipografía en BRAND.md, nombre consistente,
  imagen OG para links compartidos.
- ❌ No hay landing pública con propuesta de valor, capturas, FAQ ni casos de uso: la portada es
  la app. Es lo mismo que pide el punto 1 de GEO.
- ⚠️ i18n: ES/EN con plurales, fechas y regiones vía `Intl`; falta URL por idioma y `hreflang`
  (salvo en `/s/…`).

## 21. Datos · 22. IA · 23. Basura de desarrollo

- **Datos:** PII identificada (nombre, correo, foto, token de push); cifrado en reposo por Google;
  borrado completo disponible; sin datos de prueba en el repo. Falta definir retención de logs.
- **IA:** ➖ el producto no usa modelos.
- **Basura:** ✅ limpio. Sin `console.log`, `debugger` ni TODO en `src/` ni `api/` (solo en
  `scripts/`, que no se despliega); sin URLs de staging; `localhost` aparece solo en un comentario.

## 24–25. Go-live y después

El checklist manual de [RELEASE.md](RELEASE.md) cubre variables, dominios de Auth, reglas, prueba
en dispositivos, borrado de cuenta y revisión de logs/crons. Añadir a esa lista: backup de
Firestore antes del primer deploy, `curl -I` para verificar headers, enviar sitemap a Search
Console/Bing, probar la vista previa del link en WhatsApp/X, y (si se añade analytics) comprobar
que los eventos llegan. Para las primeras 24 h: errores `[client-error]`, ejecución de los dos
crons y consumo de cuota de TMDB.

---

## Orden de trabajo sugerido

1. **SEO/GEO base:** títulos y descripción por ruta, 404 real, `noindex` en rutas privadas,
   sitemap + `robots.txt`, OG/Twitter y canonical en el HTML raíz, `llms.txt`.
2. **HTML indexable por franquicia** con JSON-LD (el cambio grande).
3. **Seguridad:** CSP en modo report-only → enforce, rate limiting en Vercel Firewall,
   `dependabot.yml` y actualizar firebase/firebase-admin/satori.
4. **Monitoreo:** `/api/health`, uptime y alertas; dedupe en `notify-releases`.
5. **Legal y soporte:** correo de contacto, logo de TMDB, base legal/transferencias, nota de
   donación, vía para reportar abuso.
6. **Analytics sin cookies** con el embudo de arriba.
7. **Manual (🔧):** 2FA, backups de Firestore + prueba de restauración, restricción de la clave
   web, DPA, Search Console/Bing, proyecto de Firebase para Preview, pasada en dispositivos.
