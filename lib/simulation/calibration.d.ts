import type { SimulationSettings } from "./engine";
export function runCalibration(options?: { seasons?: number; seed?: string; settings?: SimulationSettings }): Record<string, unknown> & { matches: number; goalsPerMatch: number; homeWinRate: number; drawRate: number; awayWinRate: number; ratingPointsCorrelation: number; invariants: { goalEventMismatch: number; possessionMismatch: number } };
