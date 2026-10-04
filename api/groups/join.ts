// POST /api/groups/join { groupId, code, profileId, name } con Authorization: Bearer <idToken>
// → agrega al usuario al grupo si el código de invitación es correcto (SPEC §7). Las reglas
// no dejan que nadie se agregue solo: esto corre con firebase-admin.
import { timingSafeEqual } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { MAX_MEMBERS } from "../../src/lib/groupLimits.js";
import { adminDb } from "../_lib/admin.js";
import { errorResponse, HttpError, json } from "../_lib/tmdb.js";

const ID = /^[A-Za-z0-9_-]{1,128}$/;

/** Códigos equivocados permitidos por usuario antes de bloquear, y cuánto dura el bloqueo. */
const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60_000;

function sameCode(a: string, b: string): boolean {
  const x = Buffer.from(a.toUpperCase());
  const y = Buffer.from(b.toUpperCase());
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function POST(request: Request): Promise<Response> {
  try {
    const token = /^Bearer (.+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
    if (!token) throw new HttpError(401, "Falta la sesión");
    const db = adminDb(); // inicializa firebase-admin
    let uid: string;
    try {
      uid = (await getAuth().verifyIdToken(token)).uid;
    } catch {
      throw new HttpError(401, "Sesión inválida");
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const { groupId, code, profileId } = body;
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 30) : "";
    if (typeof groupId !== "string" || !ID.test(groupId)) throw new HttpError(400, "groupId inválido");
    if (typeof profileId !== "string" || !ID.test(profileId)) throw new HttpError(400, "profileId inválido");
    if (typeof code !== "string" || !/^[A-Za-z0-9]{4,16}$/.test(code)) throw new HttpError(400, "code inválido");
    if (!name) throw new HttpError(400, "name requerido");

    // El perfil tiene que ser de quien se une.
    const profile = await db.doc(`users/${uid}/profiles/${profileId}`).get();
    if (!profile.exists) throw new HttpError(400, "Ese perfil no es tuyo");

    // Contador de códigos equivocados (system/ solo lo toca firebase-admin): frena probar códigos a ciegas.
    const attempts = db.doc(`system/joinAttempts/users/${uid}`);
    const prior = (await attempts.get()).data() as { fails?: number; since?: number } | undefined;
    const active = prior?.since !== undefined && Date.now() - prior.since < WINDOW_MS;
    if (active && (prior?.fails ?? 0) >= MAX_FAILS) throw new HttpError(429, "Demasiados intentos. Prueba de nuevo en unos minutos.");

    const ref = db.doc(`groups/${groupId}`);
    try {
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const group = snap.data();
        // Mismo error si no existe o si el código no coincide: no revela qué grupos hay.
        if (!group || typeof group.inviteCode !== "string" || !sameCode(group.inviteCode, code)) {
          throw new HttpError(404, "Invitación inválida o vencida");
        }
        const memberUids: string[] = group.memberUids ?? [];
        if (!memberUids.includes(uid) && memberUids.length >= MAX_MEMBERS) throw new HttpError(409, "El grupo está lleno");
        tx.update(ref, {
          [`members.${uid}`]: profileId,
          [`memberNames.${uid}`]: name,
          memberUids: FieldValue.arrayUnion(uid),
        });
      });
    } catch (err) {
      // Solo el código equivocado cuenta como intento; la ventana se reinicia cuando vence.
      if (err instanceof HttpError && err.status === 404) {
        await attempts.set({ fails: active ? (prior?.fails ?? 0) + 1 : 1, since: active ? prior!.since : Date.now() }).catch(() => undefined);
      }
      throw err;
    }
    await attempts.delete().catch(() => undefined);
    return json({ ok: true, groupId });
  } catch (err) {
    return errorResponse(err);
  }
}
