export const SIMULATION_PRESETS = {
  balanced: {
    overallInfluence: 60, tacticalInfluence: 25, homeAdvantage: 5,
    variance: 50, fogStrength: 40, fatigueEffect: 50, injuryFrequency: 50,
    disciplineFrequency: 50, goalEnvironment: 50, previewRerolls: 1,
  },
  rating_heavy: {
    overallInfluence: 72, tacticalInfluence: 15, homeAdvantage: 5,
    variance: 45, fogStrength: 30, fatigueEffect: 40, injuryFrequency: 50,
    disciplineFrequency: 50, goalEnvironment: 50, previewRerolls: 1,
  },
  tactical: {
    overallInfluence: 50, tacticalInfluence: 35, homeAdvantage: 5,
    variance: 50, fogStrength: 40, fatigueEffect: 60, injuryFrequency: 50,
    disciplineFrequency: 50, goalEnvironment: 50, previewRerolls: 1,
  },
};

export const SIMULATION_SETTING_BOUNDS = {
  overallInfluence: [35, 80], tacticalInfluence: [10, 45], homeAdvantage: [0, 12],
  variance: [20, 80], fogStrength: [0, 80], fatigueEffect: [0, 100],
  injuryFrequency: [0, 100], disciplineFrequency: [0, 100], goalEnvironment: [20, 80],
  previewRerolls: [0, 3],
};

export function applySimulationPreset(preset) {
  return { ...(SIMULATION_PRESETS[preset] || SIMULATION_PRESETS.balanced) };
}

export function validateSimulationSettings(settings) {
  const errors = [];
  for (const [key, [min, max]] of Object.entries(SIMULATION_SETTING_BOUNDS)) {
    const value = Number(settings[key]);
    if (!Number.isFinite(value) || value < min || value > max) errors.push(`${key} must be between ${min} and ${max}`);
  }
  if (Number(settings.overallInfluence) + Number(settings.tacticalInfluence) > 100) errors.push("overall and tactical influence combined cannot exceed 100");
  return errors;
}
