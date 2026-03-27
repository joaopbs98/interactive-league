-- 039: Drop rating CHECK constraint from league_players (partitioned table)
-- The constraint (rating <= 60) was blocking inserts of real EAFC players (ratings 70-99).
-- Migration 029 removed it from the old table, but migration 030 recreated the table
-- with the constraint. This fixes auto_starter_squad to work with real player data.

DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  -- Find the constraint name on league_players (could be on parent or inherited from creation)
  SELECT conname INTO v_constraint_name
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  WHERE t.relname = 'league_players'
    AND c.contype = 'c'
    AND c.conname LIKE '%rating%'
  LIMIT 1;

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE league_players DROP CONSTRAINT IF EXISTS %I', v_constraint_name);
    RAISE NOTICE 'Dropped constraint % from league_players', v_constraint_name;
  ELSE
    -- Try known constraint names from migration history
    ALTER TABLE league_players DROP CONSTRAINT IF EXISTS league_players_partitioned_rating_check;
    ALTER TABLE league_players DROP CONSTRAINT IF EXISTS league_players_rating_check;
    RAISE NOTICE 'Attempted to drop rating constraints (may have been already removed)';
  END IF;
END $$;
