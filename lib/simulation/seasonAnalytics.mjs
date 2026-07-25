const SUM_FIELDS = [
  "goals", "assists", "shots", "shots_on_target", "key_passes", "passes", "completed_passes",
  "tackles", "interceptions", "saves", "fouls", "yellow_cards", "red_cards", "xg", "xgot", "xa",
  "progressive_passes", "touches", "carries", "progressive_carries", "dribbles",
  "successful_dribbles", "pressures", "recoveries", "duels", "duels_won",
  "aerial_duels", "aerial_duels_won", "crosses", "completed_crosses", "blocks",
  "clearances", "offsides", "fouled", "long_balls", "completed_long_balls",
  "passes_own_third", "passes_middle_third", "passes_final_third",
  "errors_leading_to_shot", "errors_leading_to_goal", "shots_faced", "goals_conceded",
  "claims", "successful_claims", "punches", "sweeper_actions",
  "distance_km", "high_speed_distance_km", "sprint_distance_km", "sprint_count",
];

export function aggregateSeasonPlayers(rows, { teamMatchesPlayed }) {
  const totals = new Map();
  for (const row of rows) {
    const total = totals.get(row.player_id) || {
      playerId: row.player_id, teamId: row.team_id, appearances: 0, qualifyingAppearances: 0,
      minutes: 0, qualifyingMinutes: 0, ratingMinutes: 0,
      ...Object.fromEntries(SUM_FIELDS.map((field) => [field, 0])),
    };
    total.appearances += 1;
    total.minutes += Number(row.minutes || 0);
    if (Number(row.minutes || 0) >= 15) {
      total.qualifyingAppearances += 1;
      total.qualifyingMinutes += Number(row.minutes || 0);
      total.ratingMinutes += Number(row.rating || 0) * Number(row.minutes || 0);
    }
    for (const field of SUM_FIELDS) total[field] += Number(row[field] || 0);
    totals.set(row.player_id, total);
  }
  return [...totals.values()].map((total) => {
    const teamMinutes = Number(teamMatchesPlayed.get(total.teamId) || 0) * 90;
    return {
      ...total,
      averageRating: total.qualifyingMinutes ? Number((total.ratingMinutes / total.qualifyingMinutes).toFixed(2)) : 0,
      leaderboardEligible: total.qualifyingAppearances >= 3 && total.qualifyingMinutes >= teamMinutes * 0.3,
    };
  });
}
