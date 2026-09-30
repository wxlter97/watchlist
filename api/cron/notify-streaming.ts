// Cron diario: revisa dónde ver los títulos pendientes (planeados o en curso) de quien activó
// el aviso, y avisa cuando uno llega a un servicio de suscripción de su región (SPEC §7, §9.6).
// El último estado conocido vive en system/providers (solo firebase-admin), así el primer
// chequeo de un título solo registra y nunca avisa de algo que ya estaba.
import { newlyStreaming, streamingMessage, type CatalogTitleLite } from "../../src/lib/notifications.js";
import type { Lang } from "../../src/lib/types.js";
import { adminDb } from "../_lib/admin.js";
import { titlesById } from "../_lib/catalog.js";
import { assertCron, sendToUser } from "../_lib/push.js";
import { errorResponse, json, tmdb } from "../_lib/tmdb.js";

/** Tope de consultas a TMDB por corrida (límites de la API y del tiempo de la función). */
const MAX_CHECKS = 250;

interface Watcher {
  uid: string;
  lang: Lang;
}

export async function GET(request: Request): Promise<Response> {
  try {
    assertCron(request);
    const db = adminDb();
    const today = new Date().toISOString().slice(0, 10);
    const titles = titlesById();

    // (título, región) → quiénes lo tienen pendiente.
    const pending = new Map<string, { titleId: string; region: string; watchers: Watcher[] }>();
    const users = await db.collection("users").where("settings.notifications.streamingAvailable", "==", true).get();
    for (const user of users.docs) {
      const settings = user.get("settings") ?? {};
      const region = typeof settings.streamingRegion === "string" && /^[A-Z]{2}$/.test(settings.streamingRegion) ? settings.streamingRegion : "SV";
      const lang: Lang = settings.language === "en" ? "en" : "es";
      const profiles = await db.collection(`users/${user.id}/profiles`).get();
      for (const profile of profiles.docs) {
        const progress = await profile.ref.collection("progress").where("status", "in", ["planned", "watching"]).get();
        for (const doc of progress.docs) {
          const title = titles.get(doc.id);
          if (!title || title.releaseDate > today) continue;
          const key = `${doc.id}:${region}`;
          const entry = pending.get(key) ?? { titleId: doc.id, region, watchers: [] as Watcher[] };
          if (!entry.watchers.some((w) => w.uid === user.id)) entry.watchers.push({ uid: user.id, lang });
          pending.set(key, entry);
        }
      }
    }

    const notify = new Map<string, { lang: Lang; titleIds: string[] }>();
    let checked = 0;
    for (const { titleId, region, watchers } of [...pending.values()].slice(0, MAX_CHECKS)) {
      const t = titles.get(titleId)!;
      const data = await tmdb<{ results?: Record<string, { flatrate?: { provider_id: number }[] }> }>(
        `/${t.tmdbType}/${t.tmdbId}/watch/providers`,
      ).catch(() => null);
      if (!data) continue;
      checked++;
      const current = (data.results?.[region]?.flatrate ?? []).map((p) => p.provider_id).sort((a, b) => a - b);
      const ref = db.doc(`system/providers/checks/${t.tmdbType}-${t.tmdbId}-${region}`);
      const previous = (await ref.get()).get("flatrate") as number[] | undefined;
      if (newlyStreaming(previous, current)) {
        for (const w of watchers) {
          const entry = notify.get(w.uid) ?? { lang: w.lang, titleIds: [] };
          entry.titleIds.push(titleId);
          notify.set(w.uid, entry);
        }
      }
      await ref.set({ flatrate: current, checkedAt: new Date() });
    }

    let sent = 0;
    for (const [uid, { lang, titleIds }] of notify) {
      const message = streamingMessage(titleIds, titles as ReadonlyMap<string, CatalogTitleLite>, lang, today);
      if (message) sent += await sendToUser(uid, message).catch(() => 0);
    }
    return json({ users: users.size, pending: pending.size, checked, notified: notify.size, sent });
  } catch (err) {
    return errorResponse(err);
  }
}
