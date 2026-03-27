-- Update existing contracts with new wage system based on rating and position
-- This script updates the wage column in the contracts table

-- First, let's see what contracts we have
SELECT 
  c.id,
  c.player_id,
  c.wage as current_wage,
  p.name as player_name,
  p.positions,
  p.overall_rating,
  CASE 
    WHEN LEFT(p.positions, 2) = 'GK' THEN 'DEF'
    WHEN LEFT(p.positions, 3) = 'CDM' THEN 'DEF'
    WHEN LEFT(p.positions, 2) IN ('CB', 'RB', 'LB') THEN 'DEF'
    ELSE 'ATT'
  END as position_type
FROM contracts c
JOIN player p ON c.player_id = p.player_id
LIMIT 10;

-- Now update the wages based on the new system
UPDATE contracts 
SET wage = CASE 
  -- Defensive players (GK, LB, CB, RB, CDM) - check first position only
  WHEN LEFT(p.positions, 2) = 'GK' OR 
       LEFT(p.positions, 3) = 'CDM' OR 
       LEFT(p.positions, 2) IN ('CB', 'RB', 'LB') THEN
    CASE p.overall_rating
      WHEN 95 THEN 48000000
      WHEN 94 THEN 48000000
      WHEN 93 THEN 44800000
      WHEN 92 THEN 41600000
      WHEN 91 THEN 38400000
      WHEN 90 THEN 35200000
      WHEN 89 THEN 32000000
      WHEN 88 THEN 28800000
      WHEN 87 THEN 25600000
      WHEN 86 THEN 22400000
      WHEN 85 THEN 19200000
      WHEN 84 THEN 16000000
      WHEN 83 THEN 14400000
      WHEN 82 THEN 12800000
      WHEN 81 THEN 11200000
      WHEN 80 THEN 10400000
      WHEN 79 THEN 9600000
      WHEN 78 THEN 8800000
      WHEN 77 THEN 8000000
      WHEN 76 THEN 7200000
      WHEN 75 THEN 6400000
      WHEN 74 THEN 5800000
      WHEN 73 THEN 5100000
      WHEN 72 THEN 4500000
      WHEN 71 THEN 3800000
      WHEN 70 THEN 3200000
      WHEN 69 THEN 2900000
      WHEN 68 THEN 2600000
      WHEN 67 THEN 2200000
      WHEN 66 THEN 1900000
      WHEN 65 THEN 1600000
      WHEN 64 THEN 1440000
      WHEN 63 THEN 1280000
      WHEN 62 THEN 1120000
      WHEN 61 THEN 960000
      WHEN 60 THEN 800000
      ELSE 800000 -- Default for ratings below 60
    END
  -- Attacking players (all other positions)
  ELSE
    CASE p.overall_rating
      WHEN 95 THEN 60000000
      WHEN 94 THEN 60000000
      WHEN 93 THEN 56000000
      WHEN 92 THEN 52000000
      WHEN 91 THEN 48000000
      WHEN 90 THEN 44000000
      WHEN 89 THEN 40000000
      WHEN 88 THEN 36000000
      WHEN 87 THEN 32000000
      WHEN 86 THEN 28000000
      WHEN 85 THEN 24000000
      WHEN 84 THEN 20000000
      WHEN 83 THEN 18000000
      WHEN 82 THEN 16000000
      WHEN 81 THEN 14000000
      WHEN 80 THEN 13000000
      WHEN 79 THEN 12000000
      WHEN 78 THEN 11000000
      WHEN 77 THEN 10000000
      WHEN 76 THEN 9000000
      WHEN 75 THEN 8000000
      WHEN 74 THEN 7200000
      WHEN 73 THEN 6400000
      WHEN 72 THEN 5600000
      WHEN 71 THEN 4800000
      WHEN 70 THEN 4000000
      WHEN 69 THEN 3600000
      WHEN 68 THEN 3200000
      WHEN 67 THEN 2800000
      WHEN 66 THEN 2400000
      WHEN 65 THEN 2000000
      WHEN 64 THEN 1800000
      WHEN 63 THEN 1600000
      WHEN 62 THEN 1400000
      WHEN 61 THEN 1200000
      WHEN 60 THEN 1000000
      ELSE 1000000 -- Default for ratings below 60
    END
END
FROM player p
WHERE contracts.player_id = p.player_id;

-- Verify the updates
SELECT 
  c.id,
  c.player_id,
  c.wage as new_wage,
  p.name as player_name,
  p.positions,
  p.overall_rating,
  CASE 
    WHEN LEFT(p.positions, 2) = 'GK' THEN 'DEF'
    WHEN LEFT(p.positions, 3) = 'CDM' THEN 'DEF'
    WHEN LEFT(p.positions, 2) IN ('CB', 'RB', 'LB') THEN 'DEF'
    ELSE 'ATT'
  END as position_type
FROM contracts c
JOIN player p ON c.player_id = p.player_id
ORDER BY p.overall_rating DESC
LIMIT 10; 