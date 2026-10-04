# Lista de salida a producción

Lo automático corre en CI (`check`, `e2e`, `rules`). Esto es lo que falta hacer a mano.

## Configuración (una vez)
- [x] Vercel: `TMDB_API_KEY`, `CRON_SECRET`, `FIREBASE_SERVICE_ACCOUNT` y las `VITE_FIREBASE_*`
      (con `VITE_FIREBASE_AUTH_DOMAIN` = el dominio de la app y `VITE_FIREBASE_VAPID_KEY`).
- [x] Firebase Auth → dominios autorizados: el dominio de la app.
- [ ] Vercel usa Node 24 (`engines` en package.json y `.nvmrc`; Project Settings → Node.js Version).
- [ ] `pnpm rules:deploy`.
- [x] Revisar `legal.*` en `src/locales/` (contacto, jurisdicción) y la fecha de "Última actualización".
- [x] `VITE_SITE_URL` con el dominio definitivo (canonical, Open Graph, sitemap y robots).
- [x] Vercel → Firewall: una regla de rate limit para `/api/` (60 req/min por IP; en Hobby solo cabe
      una). Los intentos de código en `/api/groups/join` se limitan en código (5 fallos / 15 min).
- [x] Monitor de uptime (UptimeRobot, Better Stack…) sobre `/api/health`, con alerta por correo.
- [x] Search Console: dominio verificado y `/sitemap.xml` enviado (Google tarda en leerlo; "No se pudo obtener" al principio es normal).
- [ ] Bing Webmaster Tools: importar el sitio desde Search Console.
- [ ] Revisar `[csp-report]` en los logs unos días y pasar `Content-Security-Policy-Report-Only`
      a `Content-Security-Policy` en `vercel.json`.
- [x] Google Analytics 4: propiedad creada y `VITE_GA_ID` puesto (ya recibe usuarios).
- [ ] GA4 → Admin: desactivar *Google signals*, retención de datos en 2 meses, aceptar los *Data
      Processing Terms* y marcar `first_title_watched`, `follow_franchise` e `install_accepted`
      como eventos clave.
- [ ] Restringir la clave web de Firebase por dominio (Google Cloud → APIs y servicios → Credenciales).
- [x] 2FA en GitHub, Vercel, Google/Firebase, TMDB y el registrador.
- [ ] Backups de Firestore (plan Blaze con presupuesto y alerta, PITR y backups programados) y una
      restauración de prueba. **Pospuesto** por decisión: ver docs/OPERATIONS.md.
- [ ] Entorno de pruebas (proyecto de Firebase aparte para Preview): **pospuesto**, no hay por ahora.
- [ ] **Anuncios (AdSense).** El código ya está listo y apagado hasta tener las variables:
  1. Dar de alta el sitio en AdSense (`watchlist.wxlter.dev`) y poner su ID (`ca-pub-…`) en
     `VITE_ADS_CLIENT` (Production). Eso publica `/ads.txt` y la meta `google-adsense-account`
     (verificación sin scripts). Redesplegar y comprobar `https://<dominio>/ads.txt`.
  2. Esperar la aprobación (días o semanas). AdSense revisa que haya contenido propio suficiente,
     política de privacidad y términos (ya existen) y navegación clara.
  3. Con el sitio aprobado: crear dos bloques de anuncios (portada y contenido), poner sus IDs en
     `VITE_ADS_SLOT_HUB` y `VITE_ADS_SLOT_CONTENT`, y redesplegar.
  4. **Consentimiento en la UE, Reino Unido y Suiza:** Google exige una plataforma de
     consentimiento certificada (TCF) para servir anuncios allí. El aviso propio de la app sirve
     para GA4 y para el resto del mundo, pero **no** es una CMP certificada. Antes de abrir anuncios
     a tráfico europeo, activar en AdSense → Privacidad y mensajes el mensaje de Google
     (gratuito) y decidir cómo convive con el aviso propio (puedo integrarlo cuando exista la
     cuenta).
  5. Con anuncios en vivo, la CSP debe revisarse con `[csp-report]` antes de pasarla a enforce.

## Prueba manual en dispositivos (cada versión importante)
En un Android (Chrome) y un iPhone (Safari), con la PWA **desinstalada** antes:

1. Instalar ("Añadir a pantalla de inicio"). El ícono se ve amarillo con la O negra, también en
   modo oscuro y con íconos temáticos.
2. Abrir desde el ícono: arranca en español, sin barra del navegador.
3. Cuenta → Iniciar sesión con Google: al terminar vuelve a la app **con la sesión iniciada**
   y con tu progreso.
4. Marcar un título como visto; abrir en otro dispositivo y verlo sincronizado.
5. Modo avión: cerrar y abrir la app. Abre el Hub, una franquicia ya visitada y el progreso;
   marcar algo como visto y, al volver la conexión, sincroniza.
6. Seguir una ruta ("Prepárate para…") y verla en el Hub.
7. Activar avisos y recibir uno de prueba.
8. Cuenta → Eliminar cuenta (con una cuenta de prueba): pide volver a entrar si el login es
   viejo; después borra todo y vuelve como invitado.

## Verificar en producción (hecho el 4 oct 2026: rutas, canonical, sitemap y robots responden bien)
- `curl -I https://<dominio>/` → `strict-transport-security` presente.
- `curl -s https://<dominio>/f/saw | grep -E "<title>|canonical|ld\+json"` → metadatos de la franquicia.
- `curl -s -o /dev/null -w "%{http_code}" https://<dominio>/f/no-existe` → 404.
- `/sitemap.xml`, `/robots.txt` y `/llms.txt` con el dominio real; vista previa del link en WhatsApp/X.

## Después de publicar
- Vercel → Logs: buscar `[client-error]` los primeros días.
- Vercel → Cron: comprobar que `notify-releases` y `notify-streaming` corren sin error.
