import { useProgressStore } from "./progressStore";

beforeEach(() => useProgressStore.setState({ progress: {}, franchiseState: {} }));

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

  it("persiste en localStorage", () => {
    useProgressStore.getState().setStatus("iron-man-2008", "planned");
    const saved = JSON.parse(localStorage.getItem("watch-order:guest")!);
    expect(saved.state.progress["iron-man-2008"].status).toBe("planned");
  });
});
