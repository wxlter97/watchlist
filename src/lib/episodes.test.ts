import { minutesWatched, setSeason, statusFromEpisodes, toggleEpisode, totalEpisodes, watchedEpisodes } from "./episodes";
import { title } from "../test/fixtures";

const show = title("show-2020", "2020-01-01", {
  kind: "series",
  tmdbType: "tv",
  runtimeMin: 500,
  seasons: [
    { number: 1, episodes: 3 },
    { number: 2, episodes: 2 },
  ],
});

describe("episodios", () => {
  it("marca y desmarca episodios sin duplicar y limpia temporadas vacías", () => {
    let map = toggleEpisode(undefined, 1, 2);
    map = toggleEpisode(map, 1, 1);
    expect(map).toEqual({ 1: [1, 2] });
    map = toggleEpisode(map, 1, 1);
    map = toggleEpisode(map, 1, 2);
    expect(map).toEqual({});
  });

  it("marca y desmarca una temporada completa", () => {
    const map = setSeason({ 2: [1] }, 1, 3, true);
    expect(map).toEqual({ 1: [1, 2, 3], 2: [1] });
    expect(setSeason(map, 1, 3, false)).toEqual({ 2: [1] });
  });

  it("deriva el estado de los episodios vistos", () => {
    expect(totalEpisodes(show)).toBe(5);
    expect(statusFromEpisodes(show, { 1: [1] }, undefined)).toBe("watching");
    expect(statusFromEpisodes(show, { 1: [1, 2, 3], 2: [1, 2] }, "watching")).toBe("watched");
    expect(statusFromEpisodes(show, {}, "watching")).toBeUndefined();
    expect(statusFromEpisodes(show, {}, "planned")).toBe("planned");
    expect(statusFromEpisodes(show, { 1: [1] }, "dropped")).toBe("dropped");
    expect(watchedEpisodes({ 1: [1, 2], 2: [1] })).toBe(3);
  });
});

describe("minutesWatched", () => {
  const film = title("film-2000", "2000-01-01", {
    runtimeMin: 120,
    versions: [
      { id: "theatrical", name: "Cines", runtimeMin: 120, default: true },
      { id: "extended", name: "Extendida", runtimeMin: 180 },
    ],
  });
  const doc = (extra = {}) => ({ status: "watched" as const, rewatchCount: 0, updatedAt: "x", ...extra });

  it("usa la duración de la versión vista y suma rewatches", () => {
    expect(minutesWatched(film, doc())).toBe(120);
    expect(minutesWatched(film, doc({ versionId: "extended" }))).toBe(180);
    expect(minutesWatched(film, doc({ versionId: "extended", rewatchCount: 1 }))).toBe(360);
  });

  it("prorratea las series a medias por episodio", () => {
    expect(minutesWatched(show, { status: "watching", rewatchCount: 0, updatedAt: "x", episodes: { 1: [1, 2] } })).toBe(200);
    expect(minutesWatched(show, undefined)).toBe(0);
    expect(minutesWatched(film, { status: "planned", rewatchCount: 0, updatedAt: "x" })).toBe(0);
  });
});
