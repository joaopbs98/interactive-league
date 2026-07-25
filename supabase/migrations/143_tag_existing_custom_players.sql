-- Existing custom IDs were generated uniquely and belong to the single save
-- where their league_players row was created.
UPDATE player p
SET source_league_id = owned.league_id
FROM (
  SELECT player_id, MIN(league_id::TEXT)::UUID AS league_id
  FROM league_players
  WHERE player_id LIKE 'custom_%'
  GROUP BY player_id
  HAVING COUNT(DISTINCT league_id) = 1
) owned
WHERE p.player_id = owned.player_id
  AND p.source_league_id IS NULL;
