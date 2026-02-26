-- Add formation and starting_lineup columns to teams table
ALTER TABLE teams 
ADD COLUMN IF NOT EXISTS formation TEXT DEFAULT '3-1-4-2',
ADD COLUMN IF NOT EXISTS starting_lineup JSONB DEFAULT '[]';

-- Create index for formation queries
CREATE INDEX IF NOT EXISTS teams_formation_idx ON teams(formation);

-- Update existing teams to have default formation
UPDATE teams 
SET formation = '3-1-4-2', starting_lineup = '[]' 
WHERE formation IS NULL OR starting_lineup IS NULL; 