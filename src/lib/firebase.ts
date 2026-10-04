import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

// Config web de Firebase: identificadores públicos (la seguridad vive en firestore.rules).
const env = import.meta.env;
const useEmulators = env.VITE_FIREBASE_EMULATORS === "1";

// Sin config, Firebase se inicializa con valores de relleno: initializeApp/getAuth fallan con
// "invalid-api-key" si falta la clave, y eso rompía cualquier pantalla que importe este módulo
// (Cuenta, grupos…). Con relleno, solo fallan las operaciones de red; la UI avisa (FIREBASE_CONFIGURED).
const PLACEHOLDER = "not-configured";

export const firebaseApp = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY || PLACEHOLDER,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  // En emulador se usa un proyecto demo-*: nunca toca el proyecto real.
  projectId: useEmulators ? "demo-watch-order" : env.VITE_FIREBASE_PROJECT_ID || PLACEHOLDER,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});

export const auth = getAuth(firebaseApp);

// Offline-first (SPEC §2.1): caché persistente en IndexedDB compartida entre pestañas.
// Firestore encola las escrituras sin conexión y las sincroniza al volver.
export const db = initializeFirestore(firebaseApp, {
  ignoreUndefinedProperties: true,
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

if (useEmulators) {
  // Mismo hostname que la app: con 127.0.0.1 vs localhost el resultado del redirect de Auth
  // viaja por almacenamiento de terceros y el navegador lo bloquea.
  const host = location.hostname;
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
}
