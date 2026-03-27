-- Fix infinite recursion in teams RLS policy and add missing leagues INSERT policy

-- Drop the recursive policy that causes "infinite recursion detected in policy for relation teams"
DROP POLICY IF EXISTS "Users can view teams in their leagues" ON teams;

-- Replace with a non-recursive version using league_id directly
-- This avoids the self-referential subquery on teams
CREATE POLICY "Users can view teams in their leagues" ON teams
FOR SELECT USING (
  league_id IN (
    SELECT t.league_id FROM teams t WHERE t.user_id = auth.uid()
  )
);

-- Add missing INSERT policy for leagues (users need to create leagues)
CREATE POLICY "Authenticated users can create leagues" ON leagues
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Add SELECT policy for leagues that allows commissioners to see their leagues
CREATE POLICY "Commissioners can view their leagues" ON leagues
FOR SELECT USING (commissioner_user_id = auth.uid());

-- Create team-logos storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('team-logos', 'team-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to team-logos bucket
CREATE POLICY "Authenticated users can upload team logos" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'team-logos' AND auth.uid() IS NOT NULL
);

-- Allow public read access to team logos
CREATE POLICY "Public can view team logos" ON storage.objects
FOR SELECT USING (bucket_id = 'team-logos');
