-- Remove rating constraint from league_players table to allow higher ratings
-- The constraint was limiting ratings to <= 60, but EAFC players can have higher ratings

-- Drop the existing constraint
ALTER TABLE league_players DROP CONSTRAINT IF EXISTS league_players_rating_check;

-- Verify the constraint is removed
-- The rating column will now accept any INTEGER value 