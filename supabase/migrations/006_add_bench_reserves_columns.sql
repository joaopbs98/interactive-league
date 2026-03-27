-- Add bench and reserves columns to teams table
ALTER TABLE teams 
ADD COLUMN IF NOT EXISTS bench JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS reserves JSONB DEFAULT '[]';

-- Create indexes for bench and reserves queries
CREATE INDEX IF NOT EXISTS teams_bench_idx ON teams USING GIN(bench);
CREATE INDEX IF NOT EXISTS teams_reserves_idx ON teams USING GIN(reserves);

-- Update existing teams to have default bench and reserves
UPDATE teams 
SET bench = '[]', reserves = '[]' 
WHERE bench IS NULL OR reserves IS NULL;