// Íconos de los logros como datos (viewBox 24×24): los dibuja la app en React y la función
// /api/og en las tarjetas, sin depender de emojis ni de fuentes de íconos.

export type IconShape =
  | { tag: "path"; d: string; mode: "fill" | "stroke" }
  | { tag: "rect"; x: number; y: number; width: number; height: number }
  | { tag: "circle"; cx: number; cy: number; r: number; mode: "fill" | "stroke" };

export const ACHIEVEMENT_ICONS: Record<string, IconShape[]> = {
  play: [{ tag: "path", d: "M7 4.5v15l12-7.5z", mode: "fill" }],
  stack: [
    { tag: "rect", x: 3, y: 4, width: 18, height: 4 },
    { tag: "rect", x: 3, y: 10, width: 18, height: 4 },
    { tag: "rect", x: 3, y: 16, width: 18, height: 4 },
  ],
  clock: [
    { tag: "circle", cx: 12, cy: 12, r: 8.5, mode: "stroke" },
    { tag: "path", d: "M12 7v5.5l3.5 2.5", mode: "stroke" },
  ],
  globe: [
    { tag: "circle", cx: 12, cy: 12, r: 8.5, mode: "stroke" },
    { tag: "path", d: "M3.5 12h17M12 3.5c3.5 3.5 3.5 13.5 0 17M12 3.5c-3.5 3.5-3.5 13.5 0 17", mode: "stroke" },
  ],
  flame: [
    {
      tag: "path",
      d: "M12 2.5c1 4 5.5 6 5.5 11.5a5.5 5.5 0 0 1-11 0c0-2.7 1.3-4.4 2.7-5.5.3 2.2 1.4 3.3 2.7 3.8-1.1-3.3-.2-6.6.1-9.8z",
      mode: "fill",
    },
  ],
  star: [{ tag: "path", d: "M12 2.5l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17.4l-6.1 3.5 1.5-6.8-5.2-4.6 6.9-.7z", mode: "fill" }],
  shield: [{ tag: "path", d: "M12 2.5l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10v-6z", mode: "fill" }],
  route: [
    { tag: "path", d: "M6 18V10a4 4 0 0 1 4-4h8", mode: "stroke" },
    { tag: "circle", cx: 6, cy: 18.5, r: 2.5, mode: "fill" },
    { tag: "circle", cx: 18.5, cy: 6, r: 2.5, mode: "fill" },
  ],
  order: [{ tag: "path", d: "M3.5 6h3M3.5 12h3M3.5 18h3M9.5 6h11M9.5 12h11M9.5 18h11", mode: "stroke" }],
};

export const ICON_STROKE = 2.5;
