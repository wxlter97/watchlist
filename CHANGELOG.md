# Cambios

Formato libre, lo más reciente primero. Las versiones siguen a `package.json`.

## Sin publicar
- **Fix (invitado con varias pestañas):** una pestaña desactualizada pisaba lo que marcaba la otra y se perdía progreso; ahora las pestañas se sincronizan entre sí (progreso, ajustes, planes y logros).
- **Pruebas:** estados de UX (dos pestañas, red lenta o caída, botón Atrás, catálogo entero visto, volver tras meses) y arreglo de la prueba con emuladores en CI.
- **Marketing:** capturas de la app (también en el manifiesto de la PWA para una instalación más rica), script `pnpm screenshots` y `docs/LAUNCH-KIT.md`.
- **Versión:** visible en el pie y en el asunto del correo de contacto; `/api/health` incluye el commit desplegado. Se quitan dos dependencias de desarrollo sin uso.

## 1.0.0 — 4 de octubre de 2026
- **Pruebas:** e2e con cuenta contra los emuladores de Firebase (`pnpm test:e2e:auth`, job `e2e-auth` en CI): login, sincronización entre dispositivos, cerrar sesión y eliminar la cuenta.
- **GEO:** páginas públicas `/faq` (con FAQPage) y `/guide` (cómo funciona, con la relación con Letterboxd/IMDb/Trakt), en español e inglés, y las 116 rutas curadas (`/f/{franquicia}/r/{ruta}`) servidas como HTML con ItemList; todo en el sitemap, `llms.txt` y enlazado desde el pie.
- **SEO/GEO:** meta por ruta, página 404, HTML indexable para `/f/{id}` y `/t/{id}` con JSON-LD, `sitemap.xml`, `robots.txt`, `llms.txt`, Open Graph en la portada.
- **Seguridad:** CSP en modo report-only, `X-Robots-Tag` en rutas privadas, vulnerabilidades de dependencias resueltas, límite de intentos en `groups/join`, Dependabot.
- **Analítica:** Google Analytics 4 con consentimiento previo (opcional con `VITE_GA_ID`).
- **Datos:** *Exportar todos mis datos* (progreso, planes, logros, ajustes y cuenta).
- **UX:** pestañas Detalles/Reparto en cada título, búsqueda de sagas con tarjeta, progreso por orden, instalar la PWA, Cuenta en dos columnas, estados vacíos y errores más descriptivos.
- **Operación:** `/api/health`, `notify-releases` sin avisos duplicados, `docs/OPERATIONS.md` y `docs/LAUNCH-AUDIT.md`.

## 0.1.0
Primera versión: catálogo de franquicias, órdenes y rutas, progreso, planes, logros, grupos, links compartidos, avisos push y PWA.
