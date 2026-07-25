import type { SimulationPlayer, SimulationSettings } from "./engine";
export function toPlayerIds(value: unknown): string[];
export function buildSimulationPlayer(row: Record<string, unknown>): SimulationPlayer;
export function mapSimulationSettings(row: Record<string, number> | null): SimulationSettings;
