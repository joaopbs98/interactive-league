# Troubleshooting Guide: "Team not found" Error

## Problem
You're seeing the error "Team not found" on the dashboard with League ID: `17cc9954-2065-45e7-9065-8c1a56efea4d`

## Root Causes & Solutions

### 1. Missing Environment Variables

**Problem**: The application can't connect to Supabase because environment variables are not set.

**Solution**: Create a `.env.local` file in your project root with the following content:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_actual_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_actual_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_actual_supabase_service_role_key

# Site Configuration
NEXT_PUBLIC_SITE_URL=http://localhost:3001
```

**How to get these values**:
1. Go to your [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Go to Settings → API
4. Copy the values:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role secret** → `SUPABASE_SERVICE_ROLE_KEY`

### 2. User Doesn't Have a Team in the League

**Problem**: The user is authenticated but doesn't have a team in the specified league.

**Solution**: 
1. Go to `/saves` page first
2. Check if you have any leagues listed
3. If no leagues, create one using "Create New League"
4. If you have leagues but no team, join an existing league

### 3. Database Tables Don't Exist

**Problem**: The required database tables (`teams`, `leagues`) don't exist in your Supabase project.

**Solution**: Run the database migrations:

```bash
# Install Supabase CLI if you haven't
npm install -g supabase

# Login to Supabase
supabase login

# Link your project (replace with your project ref)
supabase link --project-ref your-project-ref

# Push the database schema
supabase db push
```

### 4. Row Level Security (RLS) Issues

**Problem**: RLS policies are preventing access to team data.

**Solution**: Check if RLS policies exist for the `teams` table:

```sql
-- Check existing policies
SELECT * FROM pg_policies WHERE tablename = 'teams';

-- If no policies exist, create basic ones:
CREATE POLICY "Users can view their own teams" ON teams
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own teams" ON teams
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own teams" ON teams
FOR UPDATE USING (auth.uid() = user_id);
```

### 5. Authentication Issues

**Problem**: The user session is invalid or expired.

**Solution**:
1. Clear browser cache and cookies
2. Log out and log back in
3. Check if the session is valid by visiting `/api/auth/session`

## Debugging Steps

### Step 1: Check Environment Variables
1. Create `.env.local` file (see above)
2. Restart your development server: `npm run dev`
3. Check browser console for any environment-related errors

### Step 2: Check Authentication
1. Open browser console (F12)
2. Go to `/saves` page
3. Check if you're logged in
4. Look for any authentication errors in console

### Step 3: Check Database Connection
1. Go to your Supabase Dashboard
2. Check if the `teams` and `leagues` tables exist
3. Verify there's data in these tables

### Step 4: Check API Responses
1. Open browser console
2. Navigate to the dashboard with the league ID
3. Look at the Network tab to see API responses
4. Check the debug information displayed on the error page

## Quick Fix for Development

If you want to quickly test the application without setting up a full database:

1. The application will automatically create a mock team if no real team is found
2. This allows you to see the dashboard UI and functionality
3. Look for "Using mock team data" in the debug information

## Common Error Messages

- **"Missing Supabase URL configuration"** → Set `NEXT_PUBLIC_SUPABASE_URL`
- **"Missing Supabase anon key configuration"** → Set `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **"Missing service role key configuration"** → Set `SUPABASE_SERVICE_ROLE_KEY`
- **"Authentication required"** → Log in again
- **"League not found"** → The league ID is invalid or doesn't exist
- **"Team not found in this league"** → User doesn't have a team in this league

## Next Steps

1. Create the `.env.local` file with your Supabase credentials
2. Restart the development server
3. Check the browser console for detailed error messages
4. If issues persist, check the debug information on the error page
5. Verify your database schema and data

## Support

If you're still having issues after following these steps:
1. Check the browser console for specific error messages
2. Look at the debug information displayed on the error page
3. Verify your Supabase project configuration
4. Ensure all environment variables are correctly set 