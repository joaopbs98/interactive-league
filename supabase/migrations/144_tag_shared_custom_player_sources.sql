-- Historical custom rows could be copied into multiple saves through the
-- master catalogue. Keep every league_players copy intact and tag the
-- compatibility master row to its earliest owning save. Global discovery now
-- excludes custom IDs, so no further cross-save copies can occur.
UPDATE player p
SET source_league_id = owner.league_id
FROM (
  SELECT DISTINCT ON (lp.player_id) lp.player_id, lp.league_id
  FROM league_players lp
  WHERE lp.player_id LIKE 'custom_%'
  ORDER BY lp.player_id, lp.created_at ASC
) owner
WHERE p.player_id = owner.player_id
  AND p.source_league_id IS NULL;
