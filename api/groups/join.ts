// POST /api/groups/join { groupId, code, profileId, name } con Authorization: Bearer <idToken>
// → agrega al usuario al grupo si el código de invitación es correcto (SPEC §7). Las reglas
// no dejan que nadie se agregue solo: esto corre con firebase-admin.
import { timingSafeEqual } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { MAX_MEMBERS } from "../../src/lib/groups";
import { adminDb } from "../_lib/admin";
import { errorResponse, HttpError, json } from "../_lib/tmdb";

const ID = /^[A-Za-z0-9_-]{1,128}$/;

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

    const ref = db.doc(`groups/${groupId}`);
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
    return json({ ok: true, groupId });
  } catch (err) {
    return errorResponse(err);
  }
}
