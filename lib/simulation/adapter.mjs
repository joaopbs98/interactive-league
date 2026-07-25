export function toPlayerIds(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => typeof item === "string" ? item : item?.player_id || item?.playerId).filter(Boolean);
}

const ATTRIBUTE_MAP = {
  finishing: "finishing", heading_accuracy: "headingAccuracy", long_shots: "longShots",
  short_passing: "shortPassing", long_passing: "longPassing", vision: "vision",
  crossing: "crossing", ball_control: "ballControl", composure: "composure",
  positioning: "positioning", acceleration: "acceleration", sprint_speed: "sprintSpeed",
  stamina: "stamina", aggression: "aggression", interceptions: "interceptions",
  defensive_awareness: "defensiveAwareness", standing_tackle: "standingTackle",
  sliding_tackle: "slidingTackle", gk_diving: "gkDiving", gk_handling: "gkHandling",
  gk_kicking: "gkKicking", gk_positioning: "gkPositioning", gk_reflexes: "gkReflexes",
  shot_power: "shotPower", jumping: "jumping", strength: "strength", penalties: "penalties",
  reactions: "reactions", dribbling: "dribbling", curve: "curve", volleys: "volleys",
};

export function buildSimulationPlayer(row) {
  const rating = Number(row.rating ?? 60);
  const result = {
    playerId: row.player_id,
    name: row.full_name || row.player_name || "Unknown player",
    position: String(row.positions || "ST").split(/[,/]/)[0].trim(),
    positions: String(row.positions || "ST"),
    rating,
    fatigue: Number(row.fatigue ?? 0),
    injuryGamesRemaining: Number(row.injury_games_remaining ?? 0),
    suspensionGamesRemaining: Number(row.suspension_games_remaining ?? 0),
  };
  for (const [databaseName, engineName] of Object.entries(ATTRIBUTE_MAP)) {
    result[engineName] = Number(row[databaseName] ?? rating);
  }
  return result;
}

const DEFAULT_SETTINGS = {
  overallInfluence: 60, tacticalInfluence: 25, homeAdvantage: 5, variance: 50,
  fogStrength: 40, fatigueEffect: 50, injuryFrequency: 50,
  disciplineFrequency: 50, goalEnvironment: 50,
};

export function mapSimulationSettings(row) {
  if (!row) return { ...DEFAULT_SETTINGS };
  return {
    overallInfluence: row.overall_influence ?? DEFAULT_SETTINGS.overallInfluence,
    tacticalInfluence: row.tactical_influence ?? DEFAULT_SETTINGS.tacticalInfluence,
    homeAdvantage: row.home_advantage ?? DEFAULT_SETTINGS.homeAdvantage,
    variance: row.variance ?? DEFAULT_SETTINGS.variance,
    fogStrength: row.fog_strength ?? DEFAULT_SETTINGS.fogStrength,
    fatigueEffect: row.fatigue_effect ?? DEFAULT_SETTINGS.fatigueEffect,
    injuryFrequency: row.injury_frequency ?? DEFAULT_SETTINGS.injuryFrequency,
    disciplineFrequency: row.discipline_frequency ?? DEFAULT_SETTINGS.disciplineFrequency,
    goalEnvironment: row.goal_environment ?? DEFAULT_SETTINGS.goalEnvironment,
  };
}
