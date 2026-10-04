// ¿Esta instalación trae la config web de Firebase? Sin ella (CI, un preview sin variables, un
// entorno de desarrollo nuevo) la app funciona como invitado y la cuenta queda desactivada.
// Va aparte de firebase.ts para poder consultarlo sin cargar Firebase.
export const FIREBASE_CONFIGURED = Boolean(import.meta.env.VITE_FIREBASE_API_KEY);
