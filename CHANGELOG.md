# Cambios

Formato libre, lo más reciente primero. Las versiones siguen a `package.json`.

## Sin publicar
- **GEO:** páginas públicas `/faq` (con FAQPage) y `/guide` (cómo funciona, con la relación con Letterboxd/IMDb/Trakt), en español e inglés, y las 116 rutas curadas (`/f/{franquicia}/r/{ruta}`) servidas como HTML con ItemList; todo en el sitemap, `llms.txt` y enlazado desde el pie.
- **SEO/GEO:** meta por ruta, página 404, HTML indexable para `/f/{id}` y `/t/{id}` con JSON-LD, `sitemap.xml`, `robots.txt`, `llms.txt`, Open Graph en la portada.
- **Seguridad:** CSP en modo report-only, `X-Robots-Tag` en rutas privadas, vulnerabilidades de dependencias resueltas, límite de intentos en `groups/join`, Dependabot.
- **Analítica:** Google Analytics 4 con consentimiento previo (opcional con `VITE_GA_ID`).
- **Datos:** *Exportar todos mis datos* (progreso, planes, logros, ajustes y cuenta).
- **UX:** pestañas Detalles/Reparto en cada título, búsqueda de sagas con tarjeta, progreso por orden, instalar la PWA, Cuenta en dos columnas, estados vacíos y errores más descriptivos.
- **Operación:** `/api/health`, `notify-releases` sin avisos duplicados, `docs/OPERATIONS.md` y `docs/LAUNCH-AUDIT.md`.

## 0.1.0
Primera versión: catálogo de franquicias, órdenes y rutas, progreso, planes, logros, grupos, links compartidos, avisos push y PWA.
