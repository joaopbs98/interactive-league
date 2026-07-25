export function validateRosterSelection({ starting, bench, reserves, ownedPlayers }) {
  const errors = [];
  if (starting.length !== 11) errors.push("A complete starting XI of 11 players is required");
  const selected = [...starting, ...bench, ...reserves];
  const duplicates = [...new Set(selected.filter((id, index) => selected.indexOf(id) !== index))];
  if (duplicates.length) errors.push(`Players cannot appear more than once: ${duplicates.join(", ")}`);
  const owned = new Map(ownedPlayers.map((player) => [player.player_id, player]));
  const foreign = [...new Set(selected.filter((id) => !owned.has(id)))];
  if (foreign.length) errors.push(`Players do not belong to this team: ${foreign.join(", ")}`);
  for (const id of starting) {
    const player = owned.get(id);
    if (!player) continue;
    const injury = Number(player.injury_games_remaining || 0);
    const suspension = Number(player.suspension_games_remaining || 0);
    if (injury > 0) errors.push(`${player.player_name || id} is injured for ${injury} more game${injury === 1 ? "" : "s"}`);
    if (suspension > 0) errors.push(`${player.player_name || id} is suspended for ${suspension} more game${suspension === 1 ? "" : "s"}`);
  }
  return errors;
}
