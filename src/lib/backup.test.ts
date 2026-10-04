import { backupFileName, buildBackup, parseBackup } from "./backup";

const data = {
  progress: {
    "iron-man-2008": { status: "watched" as const, rewatchCount: 1, rating: 5, watchedAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
    "loki-2021": { status: "watching" as const, rewatchCount: 0, episodes: { 1: [1, 2] }, updatedAt: "2026-02-01T00:00:00.000Z" },
  },
  franchiseState: { marvel: { lastOrderId: "chronological", shownContinuities: ["fox-xmen"], updatedAt: "2026-01-01T00:00:00.000Z" } },
};

describe("respaldo", () => {
  it("ida y vuelta sin pérdida", () => {
    const text = JSON.stringify(buildBackup("Ana", data, new Date("2026-09-28T00:00:00Z")));
    const parsed = parseBackup(text);
    expect(parsed).toEqual({ ok: true, data, profile: "Ana", skipped: 0 });
  });

  it("rechaza lo que no es un respaldo de Watch Order", () => {
    expect(parseBackup("no es json")).toEqual({ ok: false, error: "invalidJson" });
    expect(parseBackup(JSON.stringify({ progress: {} }))).toEqual({ ok: false, error: "notBackup" });
    expect(parseBackup(JSON.stringify({ app: "watch-order", version: 99 }))).toEqual({ ok: false, error: "newerVersion" });
  });

  it("descarta documentos inválidos y los cuenta", () => {
    const backup = buildBackup("Ana", data);
    (backup.progress as Record<string, unknown>)["bad-status"] = { status: "loved", updatedAt: "2026-01-01T00:00:00Z" };
    (backup.progress as Record<string, unknown>)["Bad ID!"] = { status: "watched", updatedAt: "2026-01-01T00:00:00Z" };
    (backup.progress as Record<string, unknown>)["bad-rating"] = { status: "watched", rating: 11, updatedAt: "2026-01-01T00:00:00Z" };
    const parsed = parseBackup(JSON.stringify(backup));
    expect(parsed.ok && parsed.skipped).toBe(3);
    expect(parsed.ok && Object.keys(parsed.data.progress).sort()).toEqual(["iron-man-2008", "loki-2021"]);
  });

  it("nombra el archivo con el perfil y la fecha", () => {
    expect(backupFileName("José Ángel", new Date("2026-09-28T10:00:00Z"))).toBe("watch-order-jose-angel-2026-09-28.json");
  });
});

describe("viewings", () => {
  const doc = (extra: Record<string, unknown>, franchiseState: unknown = {}) =>
    JSON.stringify({
      app: "watch-order",
      version: 1,
      exportedAt: "2026-01-01T00:00:00.000Z",
      profile: "p",
      progress: { "a-2001": { status: "watched", rewatchCount: 0, updatedAt: "2026-01-01T00:00:00.000Z", ...extra } },
      franchiseState,
    });
  const viewings = (json: string) => {
    const r = parseBackup(json);
    return r.ok ? r.data.progress["a-2001"]!.viewings : "invalid";
  };

  it("conserva solo los campos válidos de cada visualización", () => {
    const list = [{ date: "2026-03-04", place: " Cinépolis ", medium: "cinema", formats: ["3d", "x", "dubbed"], season: 2, note: " con amigos ", junk: 1 }];
    expect(viewings(doc({ viewings: list }))).toEqual([
      { date: "2026-03-04", place: "Cinépolis", medium: "cinema", formats: ["3d", "dubbed"], season: 2, note: "con amigos" },
    ]);
  });

  it("guarda varias visualizaciones (replays) en orden y descarta las vacías", () => {
    const list = [{ date: "2026-01-01" }, { date: "ayer", medium: "nada" }, { medium: "tv", note: "replay" }];
    expect(viewings(doc({ viewings: list }))).toEqual([{ date: "2026-01-01" }, { medium: "tv", note: "replay" }]);
  });

  it("migra la visualización única del formato anterior a una lista", () => {
    expect(viewings(doc({ viewing: { date: "2026-03-04", medium: "streaming" } }))).toEqual([{ date: "2026-03-04", medium: "streaming" }]);
  });

  it("sin visualizaciones válidas no deja el campo", () => {
    expect(viewings(doc({ viewings: [{ date: "ayer" }] }))).toBeUndefined();
  });

  it("conserva startedAt, la ruta activa y los niveles de Prepárate para válidos", () => {
    const r = parseBackup(
      doc(
        { status: "watching", startedAt: "2026-02-01T00:00:00.000Z" },
        { marvel: { updatedAt: "2026-01-01T00:00:00.000Z", activeRoute: "/f/marvel/prep/x", prepLevels: { "doom-2026": "all", other: "mucho" } } },
      ),
    );
    expect(r.ok && r.data.progress["a-2001"]!.startedAt).toBe("2026-02-01T00:00:00.000Z");
    expect(r.ok && r.data.franchiseState.marvel).toMatchObject({ activeRoute: "/f/marvel/prep/x", prepLevels: { "doom-2026": "all" } });
    expect(r.ok && r.data.franchiseState.marvel!.prepLevels).not.toHaveProperty("other");
  });
});

describe("exportación completa", () => {
  it("incluye plan, logros, ajustes y cuenta, sin el secreto del feed, y no se importa como respaldo", async () => {
    const { buildFullExport, fullExportFileName, parseBackup } = await import("./backup");
    const plan = { id: "p1", name: "Maratón", feedToken: "secreto", startDate: "2026-10-04" } as never;
    const all = buildFullExport(
      "Ana",
      {
        progress: {},
        franchiseState: {},
        plans: { p1: plan },
        achievements: { first: { unlockedAt: "2026-10-04T00:00:00.000Z" } },
        settings: { spoilerFree: true } as never,
        account: { name: "Ana", email: "ana@example.com" },
      },
      new Date("2026-10-04T12:00:00Z"),
    );
    expect(all.app).toBe("watch-order-export");
    expect(all.plans).toEqual([{ id: "p1", name: "Maratón", startDate: "2026-10-04" }]);
    expect(JSON.stringify(all)).not.toContain("secreto");
    expect(all.achievements).toHaveProperty("first");
    expect(all.account?.email).toBe("ana@example.com");
    expect(fullExportFileName("Ana", new Date("2026-10-04T12:00:00Z"))).toBe("watch-order-todos-mis-datos-ana-2026-10-04.json");
    expect(parseBackup(JSON.stringify(all))).toEqual({ ok: false, error: "notBackup" });
  });
});
