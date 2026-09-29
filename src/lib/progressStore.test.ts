import { loadGuest, setBackend, guestBackend, useProgressStore, type ProgressBackend } from "./progressStore";

beforeEach(() => {
  localStorage.clear();
  setBackend(guestBackend);
  useProgressStore.getState().replace({ progress: {}, franchiseState: {} });
});

describe("progressStore", () => {
  it("marca, conserva la fecha de visto y desmarca", () => {
    const { setStatus } = useProgressStore.getState();
    setStatus("logan-2017", "watched");
    const first = useProgressStore.getState().progress["logan-2017"]!;
    expect(first.status).toBe("watched");
    expect(first.watchedAt).toBeDefined();

    setStatus("logan-2017", "watched");
    expect(useProgressStore.getState().progress["logan-2017"]!.watchedAt).toBe(first.watchedAt);

    setStatus("logan-2017", null);
    expect(useProgressStore.getState().progress["logan-2017"]).toBeUndefined();
  });

  it("actualiza el estado de franquicia sin perder campos previos", () => {
    const { setFranchiseState } = useProgressStore.getState();
    setFranchiseState("marvel", { lastOrderId: "chronological" });
    setFranchiseState("marvel", { hiddenContinuities: ["mcu-multiverse"] });
    expect(useProgressStore.getState().franchiseState.marvel).toMatchObject({
      lastOrderId: "chronological",
      hiddenContinuities: ["mcu-multiverse"],
    });
  });

  it("en modo invitado persiste en localStorage", () => {
    useProgressStore.getState().setStatus("iron-man-2008", "planned");
    expect(loadGuest().progress["iron-man-2008"]!.status).toBe("planned");
  });

  it("con otro backend escribe ahí y no toca los datos de invitado", () => {
    const writes: unknown[] = [];
    const cloud: ProgressBackend = {
      writeProgress: (id, doc) => writes.push([id, doc?.status ?? null]),
      writeFranchiseState: (id) => writes.push([id]),
    };
    setBackend(cloud);
    useProgressStore.getState().setStatus("thor-2011", "watched");
    useProgressStore.getState().setStatus("thor-2011", null);
    expect(writes).toEqual([
      ["thor-2011", "watched"],
      ["thor-2011", null],
    ]);
    expect(loadGuest().progress).toEqual({});
  });
});
