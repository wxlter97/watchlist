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

describe("viewing", () => {
  const doc = (viewing: unknown) =>
    JSON.stringify({
      app: "watch-order",
      version: 1,
      exportedAt: "2026-01-01T00:00:00.000Z",
      profile: "p",
      progress: { "a-2001": { status: "watched", rewatchCount: 0, updatedAt: "2026-01-01T00:00:00.000Z", viewing } },
      franchiseState: {},
    });

  it("conserva solo los campos válidos del registro de visionado", () => {
    const r = parseBackup(doc({ date: "2026-03-04", place: " Cinépolis ", medium: "cinema", formats: ["3d", "x", "dubbed"], junk: 1 }));
    expect(r.ok && r.data.progress["a-2001"]!.viewing).toEqual({ date: "2026-03-04", place: "Cinépolis", medium: "cinema", formats: ["3d", "dubbed"] });
  });

  it("descarta un registro vacío o inválido", () => {
    const r = parseBackup(doc({ date: "ayer", medium: "tv", formats: [] }));
    expect(r.ok && r.data.progress["a-2001"]!.viewing).toBeUndefined();
  });
});
