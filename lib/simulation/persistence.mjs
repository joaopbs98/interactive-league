const TEAM_FIELDS = {
  fieldTilt: "field_tilt", xgot: "xgot", bigChances: "big_chances",
  bigChancesMissed: "big_chances_missed", progressivePasses: "progressive_passes",
  keyPasses: "key_passes", crosses: "crosses", completedCrosses: "completed_crosses",
  carries: "carries", progressiveCarries: "progressive_carries", dribbles: "dribbles",
  successfulDribbles: "successful_dribbles", pressures: "pressures", tackles: "tackles",
  interceptions: "interceptions", recoveries: "recoveries", blocks: "blocks",
  clearances: "clearances", duels: "duels", duelsWon: "duels_won",
  aerialDuels: "aerial_duels", aerialDuelsWon: "aerial_duels_won",
  yellowCards: "yellow_cards", redCards: "red_cards", goalsPrevented: "goals_prevented",
  longBalls: "long_balls", completedLongBalls: "completed_long_balls",
  passesOwnThird: "passes_own_third", passesMiddleThird: "passes_middle_third",
  passesFinalThird: "passes_final_third",
};

const PLAYER_FIELDS = {
  xg: "xg", xgot: "xgot", xa: "xa", bigChances: "big_chances",
  bigChancesMissed: "big_chances_missed", progressivePasses: "progressive_passes",
  crosses: "crosses", completedCrosses: "completed_crosses", touches: "touches",
  carries: "carries", progressiveCarries: "progressive_carries", dribbles: "dribbles",
  successfulDribbles: "successful_dribbles", dispossessed: "dispossessed",
  pressures: "pressures", recoveries: "recoveries", blocks: "blocks",
  clearances: "clearances", duels: "duels", duelsWon: "duels_won",
  aerialDuels: "aerial_duels", aerialDuelsWon: "aerial_duels_won",
  errorsLeadingToShot: "errors_leading_to_shot", errorsLeadingToGoal: "errors_leading_to_goal",
  goalsPrevented: "goals_prevented", shotsFaced: "shots_faced",
  goalsConceded: "goals_conceded", distanceKm: "distance_km",
  offsides: "offsides", fouled: "fouled", longBalls: "long_balls",
  completedLongBalls: "completed_long_balls", passesOwnThird: "passes_own_third",
  passesMiddleThird: "passes_middle_third", passesFinalThird: "passes_final_third",
  claims: "claims", successfulClaims: "successful_claims", punches: "punches",
  sweeperActions: "sweeper_actions",
  highSpeedDistanceKm: "high_speed_distance_km", sprintDistanceKm: "sprint_distance_km",
  maxSpeedKmh: "max_speed_kmh", sprintCount: "sprint_count",
  averagePosition: "average_position", heatmap: "heatmap", shotMap: "shot_map",
  passMap: "pass_map", ratingComponents: "rating_components",
};

function pickMapped(source, mapping) {
  return Object.fromEntries(Object.entries(mapping).map(([from, to]) => [to, source[from] ?? 0]));
}

export function buildAnalyticsPersistence(result, context) {
  const sideRows = [["home", result.teamStats.home], ["away", result.teamStats.away]];
  return {
    match: {
      simulation_engine_version: result.engineVersion,
      simulation_calibration_version: result.calibrationVersion,
      analytics_source: result.source || "simulated",
    },
    teamStats: sideRows.map(([side, stats]) => ({
      match_id: result.matchId,
      league_id: context.leagueId,
      team_id: result[`${side}TeamId`] || side,
      ...pickMapped(stats, TEAM_FIELDS),
      spatial_summary: stats.spatialSummary || {},
    })),
    playerStats: result.playerStats.map((line) => ({
      match_id: result.matchId,
      league_id: context.leagueId,
      team_id: line.teamId,
      player_id: line.playerId,
      engine_version: result.engineVersion,
      analytics_source: result.source || "simulated",
      slot_position: line.slotPosition || null,
      ...pickMapped(line, PLAYER_FIELDS),
    })),
    trackingChunks: (result.tracking?.chunks || []).map((chunk) => ({
      match_id: result.matchId,
      league_id: context.leagueId,
      engine_version: result.engineVersion,
      chunk_index: chunk.index,
      starts_at_second: chunk.frames[0]?.second || 0,
      ends_at_second: chunk.frames.at(-1)?.second || 0,
      frame_count: chunk.frames.length,
      payload: chunk,
    })),
  };
}
