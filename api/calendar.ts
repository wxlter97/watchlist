// GET /api/calendar/{planId}.ics?u={uid}&p={profileId}&k={feedToken} → feed iCalendar del
// planificador (SPEC §7), suscribible desde Google Calendar o Apple Calendar.
// vercel.json reescribe /api/calendar/:file a /api/calendar?file=:file.
// La URL es un secreto: `k` debe coincidir con plan.feedToken, que el usuario puede rotar.
import { timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildIcs, planEvents } from "../src/lib/ics";
import type { PlanDay } from "../src/lib/planner";
import type { Lang } from "../src/lib/types";
import { adminDb } from "./_lib/admin";
import { errorResponse, HttpError } from "./_lib/tmdb";

interface CatalogTitle {
  id: string;
  title: string;
  localized?: Partial<Record<Lang, { title: string }>>;
}

const ID = /^[A-Za-z0-9_-]{1,128}$/;

function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const planId = /^(.+)\.ics$/.exec(url.searchParams.get("file") ?? "")?.[1] ?? "";
    const uid = url.searchParams.get("u") ?? "";
    const pid = url.searchParams.get("p") ?? "";
    const key = url.searchParams.get("k") ?? "";
    if (![planId, uid, pid].every((v) => ID.test(v)) || !/^[a-f0-9]{64}$/.test(key)) throw new HttpError(404, "No existe");

    const snap = await adminDb().doc(`users/${uid}/profiles/${pid}/plans/${planId}`).get();
    const plan = snap.data();
    // Mismo 404 si el plan no existe o si el token no coincide: no revela qué planes hay.
    if (!plan || typeof plan.feedToken !== "string" || !sameSecret(plan.feedToken, key)) throw new HttpError(404, "No existe");

    const lang: Lang = plan.lang === "en" ? "en" : "es";
    const titles = new Map(
      (JSON.parse(readFileSync(join(process.cwd(), "src", "data", "titles.json"), "utf8")) as CatalogTitle[]).map((t) => [t.id, t]),
    );
    const nameOf = (id: string) => {
      const t = titles.get(id);
      return t ? (t.localized?.[lang]?.title ?? t.title) : id;
    };
    const events = planEvents(
      { id: planId, startTime: typeof plan.startTime === "string" ? plan.startTime : "20:00", lang },
      (plan.schedule ?? []) as PlanDay[],
      nameOf,
      url.origin,
    );

    return new Response(buildIcs(String(plan.name ?? "Watch Order"), events), {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `inline; filename="${planId}.ics"`,
        // Los calendarios consultan cada varias horas; el feed es privado, sin caché compartida.
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
