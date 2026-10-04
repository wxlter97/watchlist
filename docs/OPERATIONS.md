# Operación

Qué hacer cuando algo falla. Pensado para una sola persona: pasos cortos, en orden.

## Dónde mirar
- **Errores del cliente:** Vercel → proyecto → Logs, buscar `[client-error]`.
- **Violaciones de la CSP:** mismos logs, `[csp-report]` (la CSP está en modo `report-only` hasta decidir lo contrario).
- **Funciones y crons:** Vercel → Logs / Cron (`notify-releases`, `notify-streaming`).
- **Salud:** `GET /api/health` debe responder `{"ok":true}`. Conectarlo a un monitor de uptime.
- **Base de datos y auth:** Firebase Console → Firestore / Authentication / Usage.

## La app no carga o falla tras un deploy
1. Vercel → Deployments: ¿el último está en *Ready*? Si falló el build, ver el log.
2. **Rollback:** en Deployments, abrir el último deploy bueno → *Promote to Production* (Instant Rollback). No hace falta tocar git.
3. La PWA instalada recoge la versión nueva sola (`skipWaiting` + `clientsClaim`), también la del rollback, en la siguiente apertura.
4. Arreglar en una rama, abrir PR, esperar CI y volver a desplegar.

## Un endpoint de `/api` responde 5xx
- `providers`, `credits`, `upcoming`: casi siempre TMDB. Comprobar `TMDB_API_KEY` en Vercel y el estado de TMDB; la app muestra el mensaje de "no se pudo cargar" y el service worker sirve lo último guardado.
- `groups/join`, `calendar`, crons: Firebase. Comprobar `FIREBASE_SERVICE_ACCOUNT` y los límites de cuota.
- `og` (tarjetas): carga `satori`/`resvg` al vuelo; el error queda en los logs como `[og]`.
- `page` (HTML de `/f/…` y `/t/…`): lee `/index.html` del propio deploy; un 503 aquí significa que el deploy no sirve ese archivo.

## Crons
- Si falta un aviso: Vercel → Cron → ejecutar a mano `notify-releases` / `notify-streaming` (necesitan `CRON_SECRET`).
- `notify-releases` reserva el día por usuario en `system/releases/sent/{fecha}_{uid}`: no repite avisos. Para reenviar a alguien, borrar ese documento.

## Backups de Firestore y restauración
Requiere el plan Blaze de Firebase (con presupuesto y alerta en Google Cloud).
1. Firebase/Google Cloud Console → Firestore → *Disaster recovery*: activar **PITR** (7 días) y una **programación de backups** diaria (retención 7–14 días).
2. **Restaurar** (probarlo una vez antes de necesitarlo): *Backups* → el backup → *Restore* hacia una **base nueva** (nunca sobre la de producción). Comprobar los datos, y recién entonces apuntar la app a esa base o copiar lo necesario.
3. Para recuperar un documento borrado por error dentro de 7 días, usar PITR: leer el documento al instante anterior y reescribirlo.
4. Reglas e índices viven en el repo: `pnpm rules:deploy` los vuelve a publicar.

## Sospecha de filtración o acceso indebido
1. **Contener:** rotar lo que pudo exponerse — `TMDB_API_KEY`, `CRON_SECRET`, la cuenta de servicio de Firebase (Google Cloud → IAM → Service accounts → crear clave nueva y borrar la vieja), y actualizar las variables en Vercel y el secreto `FIREBASE_SERVICE_ACCOUNT` en GitHub. Redesplegar.
2. Si es una cuenta (GitHub, Vercel, Google, dominio): cambiar contraseña, cerrar todas las sesiones, revisar claves de acceso y colaboradores.
3. **Evaluar:** Firebase → Authentication y Firestore → Usage para ver actividad rara; Vercel → Logs; el historial de git.
4. **Avisar:** si se expusieron datos personales de usuarios (nombre, correo, foto, progreso), avisarles por un medio que tengas y a la autoridad de protección de datos que corresponda dentro de las 72 horas (GDPR) cuando haya usuarios de la UE. Contacto público: work@wxlter.dev.
5. **Cerrar:** anotar qué pasó, la causa y qué se cambió en `docs/` o en el CHANGELOG.

## Cuenta, datos y solicitudes de usuarios
- Un usuario puede **exportar** sus datos (Cuenta → Tus datos → *Exportar todos mis datos*) y **eliminar** su cuenta (Cuenta → Eliminar cuenta). Si pide ayuda por correo, indicarle esos botones; si no puede, borrar `users/{uid}` (subcolecciones incluidas), sus `shares` y sus grupos desde la consola, y el usuario en Authentication.
- Abusos (links o grupos): desactivar el documento en `shares/{id}` (`revoked: true`) o borrar el grupo en `groups/{id}`.

## Problemas conocidos
- **Login con Google en iPhone/PWA:** usa redirect y `/__/auth`; verificar `VITE_FIREBASE_AUTH_DOMAIN` y los dominios autorizados.
- **El sitemap no muestra páginas nuevas:** se genera desde `src/data` en cada petición con caché de un día en el CDN.
- **Anuncios o analítica sin cargar:** necesitan el ID configurado (`VITE_ADS_CLIENT`, `VITE_GA_ID`) **y** que la persona haya aceptado el aviso.
