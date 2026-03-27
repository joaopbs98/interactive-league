-- Allow users to view pack purchases from all teams in leagues where they have a team
CREATE POLICY "Users can view league pack purchases" ON pack_purchases
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM teams my_team
      JOIN teams other_team ON my_team.league_id = other_team.league_id
      WHERE other_team.id = pack_purchases.team_id
      AND my_team.user_id = auth.uid()
    )
  );
