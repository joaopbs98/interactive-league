-- The "teams in their leagues" policy causes infinite recursion because
-- it queries teams inside a teams RLS check. Fix: use a SECURITY DEFINER
-- function that bypasses RLS to get the user's league IDs.

-- Drop the recursive policy
DROP POLICY IF EXISTS "Users can view teams in their leagues" ON teams;

-- Create a helper function that bypasses RLS to get league IDs for a user
CREATE OR REPLACE FUNCTION get_user_league_ids(p_user_id UUID)
RETURNS SETOF UUID AS $$
  SELECT DISTINCT league_id FROM teams WHERE user_id = p_user_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Recreate the policy using the helper function (no recursion)
CREATE POLICY "Users can view teams in their leagues" ON teams
FOR SELECT USING (
  league_id IN (SELECT get_user_league_ids(auth.uid()))
);
