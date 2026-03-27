-- Test script to check the actual schema of league_players table
-- This will help identify any schema mismatches

-- Check the actual table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'league_players' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check if the table exists and has data
SELECT COUNT(*) as total_players FROM league_players;

-- Check a sample row to see the actual structure
SELECT * FROM league_players LIMIT 1;

-- Check if there are any constraints or issues
SELECT conname, contype, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'league_players'::regclass;






