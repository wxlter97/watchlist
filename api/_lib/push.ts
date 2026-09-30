// Envío de avisos con FCM desde el servidor. Tokens vencidos se borran solos.
import { getMessaging } from "firebase-admin/messaging";
import type { PushMessage } from "../../src/lib/notifications.js";
import { adminDb } from "./admin.js";
import { HttpError } from "./tmdb.js";

const DEAD = new Set(["messaging/registration-token-not-registered", "messaging/invalid-registration-token", "messaging/invalid-argument"]);

/** Manda el aviso a todos los dispositivos del usuario. Devuelve cuántos lo recibieron. */
export async function sendToUser(uid: string, message: PushMessage): Promise<number> {
  const db = adminDb();
  const devices = await db.collection(`users/${uid}/devices`).get();
  const tokens = devices.docs.map((d) => d.id);
  if (!tokens.length) return 0;
  const res = await getMessaging().sendEachForMulticast({
    tokens,
    // Solo datos: el service worker arma la notificación (firebase-messaging-sw.js).
    data: { title: message.title, body: message.body, url: message.url, tag: message.tag },
    webpush: { headers: { Urgency: "normal", TTL: String(60 * 60 * 24) } },
  });
  await Promise.all(
    res.responses.map((r, i) => (r.error && DEAD.has(r.error.code) ? db.doc(`users/${uid}/devices/${tokens[i]}`).delete() : null)),
  );
  return res.successCount;
}

/** Los crons de Vercel mandan "Authorization: Bearer <CRON_SECRET>". */
export function assertCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new HttpError(503, "CRON_SECRET no está configurada");
  if (request.headers.get("authorization") !== `Bearer ${secret}`) throw new HttpError(401, "No autorizado");
}
