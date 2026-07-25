export type SimulationSettingsForm = {
  overallInfluence: number; tacticalInfluence: number; homeAdvantage: number;
  variance: number; fogStrength: number; fatigueEffect: number;
  injuryFrequency: number; disciplineFrequency: number; goalEnvironment: number;
  previewRerolls: number;
};
export const SIMULATION_PRESETS: Record<string, SimulationSettingsForm>;
export const SIMULATION_SETTING_BOUNDS: Record<keyof SimulationSettingsForm, [number, number]>;
export function applySimulationPreset(preset: string): SimulationSettingsForm;
export function validateSimulationSettings(settings: SimulationSettingsForm): string[];
