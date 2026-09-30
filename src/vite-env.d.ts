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

// Generados por catalogData() en vite.config.ts a partir de src/data/ (ver src/lib/catalog.ts).
declare module "virtual:catalog-manifest" {
  const manifest: import("./lib/catalog").ManifestData;
  export default manifest;
}
declare module "virtual:catalog-loaders" {
  type Load<T> = () => Promise<{ default: T }>;
  export const franchises: Record<string, Load<import("./lib/catalog").FranchiseChunk | null>>;
  /** Sinopsis por idioma y franquicia: id de título → texto. */
  export const overviews: Record<"es" | "en", Record<string, Load<Record<string, string>>>>;
}
