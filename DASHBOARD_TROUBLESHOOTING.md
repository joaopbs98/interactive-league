# Dashboard & Saves Page Troubleshooting Guide

## Current Issues
1. **Saves page shows**: "Error: Failed to fetch user teams"
2. **Dashboard shows**: "Error: No league selected" with "League ID: Not provided"

## Step-by-Step Resolution

### Step 1: Check Environment Variables

First, test if your environment variables are properly set:

1. **Visit**: `http://localhost:3001/api/test-env`
2. **Expected Response**: All environment variables should show `true`
3. **If any show `false`**: You need to set up your `.env.local` file

### Step 2: Create/Update .env.local File

Create a `.env.local` file in your project root with:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_actual_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_actual_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_actual_supabase_service_role_key

# Site Configuration
NEXT_PUBLIC_SITE_URL=http://localhost:3001
```

**How to get these values**:
1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Go to Settings → API
4. Copy the values from there

### Step 3: Apply Database Migrations

Run these SQL commands in your Supabase SQL Editor:

```sql
-- Migration 1: RLS Policies
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- RLS Policies for leagues table
CREATE POLICY "Users can view leagues they participate in" ON leagues
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM teams 
    WHERE teams.league_id = leagues.id 
    AND teams.user_id = auth.uid()
  )
);

-- RLS Policies for teams table
CREATE POLICY "Users can view their own teams" ON teams
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own teams" ON teams
FOR UPDATE USING (user_id = auth.uid());

-- Migration 2: Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  is_host BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON profiles
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON profiles
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON profiles
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create function to handle user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create indexes
CREATE INDEX IF NOT EXISTS profiles_user_id_idx ON profiles(user_id);
CREATE INDEX IF NOT EXISTS profiles_username_idx ON profiles(username);
```

### Step 4: Restart Development Server

After updating environment variables:

```bash
# Stop the current server (Ctrl+C)
# Then restart
npm run dev
```

### Step 5: Test the Flow

1. **Go to**: `http://localhost:3001/saves`
2. **Check**: If you see your leagues or an error with debug info
3. **If error**: Check the debug information for specific issues

### Step 6: Debug Information

The improved error pages now show detailed debug information:

- **Environment Variables**: Shows which env vars are missing
- **Session Status**: Shows if you're properly authenticated
- **API Responses**: Shows what the APIs are returning
- **Database Errors**: Shows specific database issues

## Common Issues & Solutions

### Issue 1: "Missing Supabase URL configuration"
**Solution**: Set `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`

### Issue 2: "Missing Supabase anon key configuration"
**Solution**: Set `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`

### Issue 3: "Missing service role key configuration"
**Solution**: Set `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`

### Issue 4: "Authentication required"
**Solution**: 
1. Make sure you're logged in
2. Check if your session is valid
3. Try logging out and back in

### Issue 5: "No teams found for user"
**Solution**: 
1. Create a team in a league first
2. Or create a league and join it
3. Check if you have the proper RLS policies

### Issue 6: "League not found"
**Solution**:
1. Make sure the league exists in your database
2. Check if you have a team in that league
3. Verify RLS policies allow access

## Testing the Complete Flow

1. **Login**: Go to `/login` and authenticate
2. **Saves Page**: Should show your leagues or allow you to create one
3. **Create League**: If no leagues, create one
4. **Select League**: Click on a league card
5. **Dashboard**: Should load with real data

## Next Steps After Fix

Once the basic flow works:

1. **Connect Player Data**: Link the existing player database
2. **Implement Contracts**: Use real team squad data
3. **Add Trades**: Connect the trade system
4. **Enable Auctions**: Link auction functionality
5. **Pack System**: Connect pack opening

## Support

If you're still having issues:

1. **Check Browser Console**: Look for JavaScript errors
2. **Check Network Tab**: See which API calls are failing
3. **Check Server Logs**: Look at the terminal where `npm run dev` is running
4. **Share Debug Info**: The error pages now show detailed debug information

The improved error handling will help identify exactly what's going wrong and guide you to the solution. 