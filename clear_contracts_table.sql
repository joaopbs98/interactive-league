-- Clear contracts table if it exists
-- This ensures we're using squad data directly

-- Drop contracts table if it exists
DROP TABLE IF EXISTS contracts CASCADE;

-- Drop related tables if they exist
DROP TABLE IF EXISTS player_origins CASCADE;
DROP TABLE IF EXISTS wage_discounts CASCADE;

-- Verify teams table has squad data
SELECT 
  id, 
  name, 
  squad,
  CASE 
    WHEN squad IS NULL THEN 'No squad data'
    WHEN jsonb_typeof(squad) = 'array' THEN 'Has squad array'
    ELSE 'Invalid squad data'
  END as squad_status
FROM teams 
LIMIT 5; 