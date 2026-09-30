# Lista de salida a producción

Lo automático corre en CI (`check`, `e2e`, `rules`). Esto es lo que falta hacer a mano.

## Configuración (una vez)
- [ ] Vercel: `TMDB_API_KEY`, `CRON_SECRET`, `FIREBASE_SERVICE_ACCOUNT` y las `VITE_FIREBASE_*`
      (con `VITE_FIREBASE_AUTH_DOMAIN` = el dominio de la app y `VITE_FIREBASE_VAPID_KEY`).
- [ ] Firebase Auth → dominios autorizados: el dominio de la app.
- [ ] Vercel usa Node 24 (`engines` en package.json y `.nvmrc`; Project Settings → Node.js Version).
- [ ] `pnpm rules:deploy`.
- [ ] Revisar `legal.*` en `src/locales/` (contacto, jurisdicción) y la fecha de "Última actualización".
- [ ] Con anuncios: `VITE_ADS_CLIENT`, `VITE_ADS_SLOT_HUB`, `public/ads.txt`.

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

## Después de publicar
- Vercel → Logs: buscar `[client-error]` los primeros días.
- Vercel → Cron: comprobar que `notify-releases` y `notify-streaming` corren sin error.
