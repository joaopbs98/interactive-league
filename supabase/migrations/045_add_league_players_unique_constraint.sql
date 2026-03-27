-- 045: Add UNIQUE(league_id, player_id) to league_players for ON CONFLICT support
-- Required by auto_starter_squad and other functions that use ON CONFLICT (league_id, player_id)
-- Architecture: player = master/reference (read-only); league_players = per-league copies (each league has its own copy of players)

-- Remove any duplicate (league_id, player_id) rows first, keeping one per pair
DELETE FROM league_players a
USING league_players b
WHERE a.league_id = b.league_id
  AND a.player_id = b.player_id
  AND a.id > b.id;

-- Add unique constraint (partition key league_id included, so valid for partitioned table)
ALTER TABLE league_players
  ADD CONSTRAINT league_players_league_player_unique UNIQUE (league_id, player_id);

-- One-time: credit initial budget for teams that have 0 (e.g. from failed squad generation before this fix)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT t.id, t.league_id FROM teams t
    WHERE COALESCE(t.budget, 0) = 0
  LOOP
    PERFORM write_finance_entry(
      r.id, r.league_id, 250000000,
      'Initial Budget', 'Starting budget (backfill)',
      1
    );
  END LOOP;
END $$;
