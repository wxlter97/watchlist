// Cron diario: avisa de estrenos de las franquicias seguidas, hoy y en 7 días (SPEC §7, §9.6).
import { join } from "node:path";
import { releasesDue, releasesMessage, type CatalogTitleLite } from "../../src/lib/notifications";
import type { Lang } from "../../src/lib/types";
import { adminDb } from "../_lib/admin";
import { readData, titlesById } from "../_lib/catalog";
import { assertCron, sendToUser } from "../_lib/push";
import { errorResponse, json } from "../_lib/tmdb";

export async function GET(request: Request): Promise<Response> {
  try {
    assertCron(request);
    const today = new Date().toISOString().slice(0, 10);
    const titles = titlesById() as ReadonlyMap<string, CatalogTitleLite>;
    const franchises = new Map<string, { entries: { titleId: string }[] }>();
    const franchise = (id: string) => {
      if (!franchises.has(id)) {
        try {
          franchises.set(id, readData(join("franchises", `${id}.json`)));
        } catch {
          franchises.set(id, { entries: [] });
        }
      }
      return franchises;
    };

    const users = await adminDb().collection("users").where("settings.notifications.releases", "==", true).get();
    let sent = 0;
    for (const user of users.docs) {
      const settings = user.get("settings") ?? {};
      const followed: string[] = (settings.followedFranchises ?? []).filter((id: unknown) => typeof id === "string" && /^[a-z0-9-]+$/.test(id));
      followed.forEach(franchise);
      const lang: Lang = settings.language === "en" ? "en" : "es";
      const message = releasesMessage(releasesDue(followed, franchises, titles, today), titles, lang, today);
      if (message) sent += await sendToUser(user.id, message).catch(() => 0);
    }
    return json({ users: users.size, sent });
  } catch (err) {
    return errorResponse(err);
  }
}
