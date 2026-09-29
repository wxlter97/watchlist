// firebase-admin para las funciones: lee Firestore saltándose las reglas, así que cada
// endpoint valida por su cuenta qué puede leer.
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { HttpError } from "./tmdb";

export function adminDb(): Firestore {
  if (!getApps().length) {
    if (process.env.FIRESTORE_EMULATOR_HOST) {
      // Emulador (pnpm dev:emulators): proyecto demo, sin credenciales.
      initializeApp({ projectId: "demo-watch-order" });
    } else {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
      if (!raw) throw new HttpError(503, "FIREBASE_SERVICE_ACCOUNT no está configurada");
      initializeApp({ credential: cert(JSON.parse(raw) as Parameters<typeof cert>[0]) });
    }
  }
  return getFirestore();
}
