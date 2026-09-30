# Marca en Watch Order

Watch Order usa la marca personal **wxlter** (Design System v1.0). La fuente de verdad visual es
el paquete de handoff de la marca; aquí solo se anota cómo se aplica en esta app y dónde se
aparta del SPEC.

## Tokens
Definidos en [src/index.css](../src/index.css) como variables CSS y expuestos a Tailwind:

- Color: Faro `#FFDB00`, Tinta `#111111`, Papel `#F4F3EF`, Humo `#6B6B63`, Ceniza `#C9C9C2`,
  Alerta `#D92B0C` y Listo `#0B7A45` (solo con significado).
- Tipografía: Archivo Black (titulares, clase `.display`), Archivo (texto), JetBrains Mono
  (etiquetas y datos, clase `.label`). Autoalojadas con `@fontsource` para que funcionen offline.
- Forma: bordes de 2px, radio 0, sin sombras, hover por inversión (≤120ms), foco `3px` Faro.

## Decisiones propias de esta app
| Tema | Decisión |
|---|---|
| Claro / oscuro | Sigue al sistema; el toggle del header fija uno y se guarda. (El SPEC pedía oscuro por defecto.) |
| Color por franquicia | `accentColor` tematiza la franquicia: bloque del encabezado, pestañas activas, barras y "visto". El texto encima se elige por contraste (`src/lib/color.ts`). Nunca se usa el acento como color de texto. |
| Ícono de app | "O" de *Order* en Faro sobre Tinta (fondo oscuro): el sistema oscurece los íconos en modo oscuro y una O negra sobre amarillo oscurecido quedaba negro sobre negro. La W queda reservada para la marca madre. |
| Acento secundario | Ninguno por ahora. |
| Importancia | Badges de la marca: esencial (Faro), recomendado (inverso), opcional (neutro), prescindible (neutro punteado). Sin paleta extendida. |
