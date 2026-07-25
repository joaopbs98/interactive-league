export function visiblePlayerScope(leagueId) {
  if (!leagueId) throw new Error("leagueId is required");
  return `source_league_id.is.null,source_league_id.eq.${leagueId}`;
}

export function isPlayerVisibleInLeague(sourceLeagueId, leagueId) {
  return sourceLeagueId == null || sourceLeagueId === leagueId;
}
