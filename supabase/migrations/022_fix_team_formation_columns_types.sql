-- Migration 022: Fix team formation columns types
-- This migration ensures that starting_lineup, bench, and reserves columns
-- are properly typed as JSONB instead of text[]

-- First, drop the existing columns if they exist with wrong types
ALTER TABLE teams DROP COLUMN IF EXISTS starting_lineup;
ALTER TABLE teams DROP COLUMN IF EXISTS bench;
ALTER TABLE teams DROP COLUMN IF EXISTS reserves;

-- Add the columns with correct JSONB type
ALTER TABLE teams 
ADD COLUMN IF NOT EXISTS starting_lineup JSONB DEFAULT '[]'::JSONB,
ADD COLUMN IF NOT EXISTS bench JSONB DEFAULT '[]'::JSONB,
ADD COLUMN IF NOT EXISTS reserves JSONB DEFAULT '[]'::JSONB;

-- Create indexes for the JSONB columns
CREATE INDEX IF NOT EXISTS teams_starting_lineup_idx ON teams USING GIN(starting_lineup);
CREATE INDEX IF NOT EXISTS teams_bench_idx ON teams USING GIN(bench);
CREATE INDEX IF NOT EXISTS teams_reserves_idx ON teams USING GIN(reserves);

-- Update existing teams to have default empty arrays
UPDATE teams 
SET 
  starting_lineup = '[]'::JSONB,
  bench = '[]'::JSONB,
  reserves = '[]'::JSONB
WHERE starting_lineup IS NULL OR bench IS NULL OR reserves IS NULL; 