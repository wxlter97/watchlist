import { catalog, catalogIndex } from "./catalogFull";
import { effectiveHidden } from "./filters";
import { computeOrder, resolveOrder } from "./orders";

// El cronológico de Marvel sigue el "MCU Complete Timeline" oficial de Marvel Studios en
// Disney+ (marvel.com/articles/movies/mcu-timeline-order-disney-plus, 2 de junio de 2026),
// con las series por temporada. Le suma Agent Carter, que el timeline oficial omite pero
// Rotten Tomatoes y marvelwatchlist.com incluyen, en el mismo lugar que ellos. Lo estrenado
// después del timeline va al final.
const OFFICIAL = [
  "eyes-of-wakanda-2025",
  "captain-america-the-first-avenger-2011",
  "marvel-one-shot-agent-carter-2013",
  "captain-marvel-2019",
  "iron-man-2008",
  "iron-man-2-2010",
  "the-incredible-hulk-2008",
  "marvel-one-shot-a-funny-thing-happened-on-the-way-to-thors-hammer-2011",
  "thor-2011",
  "marvel-one-shot-the-consultant-2011",
  "the-avengers-2012",
  "marvel-one-shot-item-47-2012",
  "thor-the-dark-world-2013",
  "iron-man-3-2013",
  "marvel-one-shot-all-hail-the-king-2014",
  "captain-america-the-winter-soldier-2014",
  "guardians-of-the-galaxy-2014",
  "guardians-of-the-galaxy-vol-2-2017",
  "i-am-groot-2022#1",
  "i-am-groot-2022#2",
  "daredevil-2015#1",
  "jessica-jones-2015#1",
  "avengers-age-of-ultron-2015",
  "ant-man-2015",
  "daredevil-2015#2",
  "luke-cage-2016#1",
  "iron-fist-2017#1",
  "the-defenders-2017",
  "captain-america-civil-war-2016",
  "black-widow-2021",
  "black-panther-2018",
  "spider-man-homecoming-2017",
  "the-punisher-2017#1",
  "doctor-strange-2016",
  "jessica-jones-2015#2",
  "luke-cage-2016#2",
  "iron-fist-2017#2",
  "daredevil-2015#3",
  "thor-ragnarok-2017",
  "the-punisher-2017#2",
  "jessica-jones-2015#3",
  "ant-man-and-the-wasp-2018",
  "avengers-infinity-war-2018",
  "avengers-endgame-2019",
  "loki-2021#1",
  "what-if-2021#1",
  "marvel-zombies-2025",
  "wandavision-2021",
  "shang-chi-and-the-legend-of-the-ten-rings-2021",
  "the-falcon-and-the-winter-soldier-2021",
  "spider-man-far-from-home-2019",
  "eternals-2021",
  "spider-man-no-way-home-2021",
  "doctor-strange-in-the-multiverse-of-madness-2022",
  "hawkeye-2021",
  "moon-knight-2022",
  "black-panther-wakanda-forever-2022",
  "echo-2024",
  "she-hulk-attorney-at-law-2022",
  "ms-marvel-2022",
  "thor-love-and-thunder-2022",
  "ironheart-2025",
  "werewolf-by-night-2022",
  "the-guardians-of-the-galaxy-holiday-special-2022",
  "ant-man-and-the-wasp-quantumania-2023",
  "guardians-of-the-galaxy-vol-3-2023",
  "secret-invasion-2023",
  "the-marvels-2023",
  "loki-2021#2",
  "what-if-2021#2",
  "deadpool-and-wolverine-2024",
  "agatha-all-along-2024",
  "what-if-2021#3",
  "daredevil-born-again-2025#1",
  "captain-america-brave-new-world-2025",
  "thunderbolts-2025",
  "the-fantastic-4-first-steps-2025",
  "wonder-man-2026",
  "daredevil-born-again-2025#2",
  "the-punisher-one-last-kill-2026",
];

const marvel = catalog.franchises.find((f) => f.id === "marvel")!;
const chrono = (hidden: string[]) =>
  computeOrder(marvel, resolveOrder(marvel, "chronological"), catalogIndex.titlesById, { hiddenContinuities: hidden }).map((i) => i.key);

describe("cronológico de Marvel", () => {
  // El oficial con Agent Carter después del One-Shot, como Rotten Tomatoes y marvelwatchlist.
  const EXPECTED = OFFICIAL.flatMap((k) =>
    k === "marvel-one-shot-agent-carter-2013" ? [k, "marvels-agent-carter-2015#1", "marvels-agent-carter-2015#2"] : [k],
  );

  it("empieza exactamente como el timeline oficial de Disney+, más Agent Carter", () => {
    expect(chrono(effectiveHidden(marvel)).slice(0, EXPECTED.length)).toEqual(EXPECTED);
  });

  it("después vienen los estrenos posteriores al timeline, en orden", () => {
    const rest = chrono(effectiveHidden(marvel)).slice(EXPECTED.length);
    expect(rest.slice(0, 3)).toEqual(["spider-man-brand-new-day-2026", "visionquest-2026", "avengers-doomsday-2026"]);
  });

  it("al activar ABC, sus temporadas se intercalan sin mover lo oficial", () => {
    const all = chrono(effectiveHidden(marvel).filter((c) => c !== "marvel-abc"));
    expect(all.filter((k) => EXPECTED.includes(k))).toEqual(EXPECTED);
    const at = (k: string) => all.indexOf(k);
    expect(at("agents-of-shield-2013#1")).toBeLessThan(at("captain-america-the-winter-soldier-2014"));
    expect(at("agents-of-shield-2013#7")).toBeLessThan(at("spider-man-far-from-home-2019"));
  });
});
