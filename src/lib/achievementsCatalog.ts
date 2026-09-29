import achievementsJson from "../data/achievements.json";
import type { Achievement } from "./types";

export const ACHIEVEMENTS = achievementsJson as Achievement[];
export const achievementsById = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
