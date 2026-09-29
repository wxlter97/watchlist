/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_FIREBASE_VAPID_KEY?: string;
  /** "1" conecta Auth y Firestore a los emuladores locales. */
  readonly VITE_FIREBASE_EMULATORS?: string;
}

// Generados por catalogSplit() en vite.config.ts a partir de src/data/titles.json.
declare module "virtual:catalog-titles" {
  const titles: import("./lib/types").Title[];
  export default titles;
}
declare module "virtual:overviews/*" {
  /** Sinopsis por id de título, ya resueltas para el idioma. */
  const overviews: Record<string, string>;
  export default overviews;
}
