# Database Migration Guide

## Issue
The player dropdown is empty because the `league_players` table doesn't exist yet. The migration needs to be applied first.

## Solution
You need to apply the database migration to create the `league_players` table and related functions.

## Option 1: Using Supabase CLI (Recommended)
```bash
# Make sure you're in the project directory
cd /c/Users/joaop/OneDrive/Desktop/interactive-league

# Apply the migration
supabase db push
```

## Option 2: Using Supabase Dashboard SQL Editor
1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the entire content of `supabase/migrations/014_fix_league_specific_data.sql`
4. Click "Run" to execute the migration

## After Migration
Once the migration is applied:
1. The `league_players` table will be created
2. League-specific player functions will be available
3. The injuries page should work correctly

## Next Steps
After applying the migration, you'll need to:
1. Generate league players (via host controls)
2. Generate starter squads for teams
3. Test the injuries functionality

## Verification
You can verify the migration was applied by checking if the `league_players` table exists in your database types file after running `supabase gen types typescript --local > database.types.ts` 