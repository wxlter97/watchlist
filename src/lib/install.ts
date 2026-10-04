import { useSyncExternalStore } from "react";
import { isIos, isStandalone } from "./pushSupport";

// Instalar la PWA. Chrome/Edge/Android avisan con `beforeinstallprompt` (se guarda para lanzarlo
// con un botón); iOS no tiene ese evento: ahí solo se pueden dar las instrucciones. El aviso
// que recuerda que no está instalada espacia sus apariciones (ver `shouldRemind`).

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** `installed`: ya se usa como app; `prompt`: el navegador la puede instalar; `ios`: a mano desde Compartir. */
export type InstallKind = "installed" | "prompt" | "ios" | "unavailable";

const REMINDER_KEY = "watch-order:install-reminder";
const DAY = 86_400_000;
/** Espera tras cerrar el recordatorio la 1.ª, 2.ª y 3.ª vez; después no vuelve (queda el botón en Cuenta). */
export const REMINDER_WAITS_DAYS = [7, 30] as const;

interface Reminder {
  /** Veces que se cerró. */
  dismissed: number;
  /** Última vez que se cerró (ms). */
  at: number;
}

export function shouldRemind(reminder: Reminder | undefined, now: number): boolean {
  if (!reminder) return true;
  const wait = REMINDER_WAITS_DAYS[reminder.dismissed - 1];
  return wait !== undefined && now - reminder.at >= wait * DAY;
}

function loadReminder(): Reminder | undefined {
  try {
    const raw = JSON.parse(localStorage.getItem(REMINDER_KEY) ?? "null") as Partial<Reminder> | null;
    return raw && Number.isFinite(raw.dismissed) && Number.isFinite(raw.at) ? (raw as Reminder) : undefined;
  } catch {
    return undefined;
  }
}

export function dismissReminder(now = Date.now()) {
  const next: Reminder = { dismissed: (loadReminder()?.dismissed ?? 0) + 1, at: now };
  try {
    localStorage.setItem(REMINDER_KEY, JSON.stringify(next));
  } catch {
    /* sin almacenamiento: el recordatorio vuelve en la próxima visita */
  }
  emit();
}

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
let version = 0;
const listeners = new Set<() => void>();
const emit = () => {
  version++;
  listeners.forEach((l) => l());
};

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    // Sin esto Chrome muestra su propia mini-barra: el botón de la app es el que lo lanza.
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    emit();
  });
}

function kind(): InstallKind {
  if (installed || isStandalone()) return "installed";
  if (deferred) return "prompt";
  if (isIos()) return "ios";
  return "unavailable";
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => void listeners.delete(cb);
};

/** El estado de instalación del dispositivo y, para el recordatorio, si toca mostrarlo. */
export function useInstall(): { kind: InstallKind; remind: boolean } {
  useSyncExternalStore(subscribe, () => version);
  const k = kind();
  return { kind: k, remind: (k === "prompt" || k === "ios") && shouldRemind(loadReminder(), Date.now()) };
}

/** Lanza el diálogo de instalación del navegador (solo con `kind === "prompt"`). */
export async function promptInstall(): Promise<boolean> {
  const event = deferred;
  if (!event) return false;
  deferred = null;
  emit();
  await event.prompt();
  return (await event.userChoice).outcome === "accepted";
}
