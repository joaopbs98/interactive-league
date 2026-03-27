# League Players Setup Guide

## Current Issue
The player dropdown is empty and team management shows the same players because:
1. The `league_players` table exists but is empty
2. Teams are still using the old `squad` field instead of the new league-specific players
3. No league players have been generated yet

## Step-by-Step Solution

### Step 1: Generate League Players
1. Go to your league dashboard
2. Navigate to "Host Controls" (you need to be the league commissioner)
3. Click "Generate League Players" button
4. This will create 1000 players with ratings 40-60 (max 60 as requested)

### Step 2: Generate Starter Squads for Teams
After generating league players, you need to assign players to teams. You can do this by:

**Option A: Using the API directly**
```bash
# For each team in your league, call this API:
curl -X POST http://localhost:3000/api/league/players \
  -H "Content-Type: application/json" \
  -d '{
    "action": "generate_starter_squad",
    "leagueId": "YOUR_LEAGUE_ID",
    "teamId": "TEAM_ID"
  }'
```

**Option B: Add a button to host controls (I can help with this)**

### Step 3: Update Team Management
The team management page needs to be updated to use the new `league_players` table instead of the old `squad` field.

## Quick Fix Script
I can create a script to automatically set up everything for you. Would you like me to:

1. Add a "Generate Starter Squads" button to the host controls
2. Update the team API to use league_players
3. Create a setup script that does everything automatically

## Verification
After setup, you should see:
- ✅ Different players in different leagues
- ✅ Player dropdown populated in injuries page
- ✅ Players with ratings 40-60 (not all 60)
- ✅ League-specific data

## Next Steps
Let me know if you want me to:
1. Add the missing functionality to host controls
2. Update the team management to use league_players
3. Create an automated setup script 