-- 103: Multiple hosts per league - grant host rights by team (team owner becomes host)

CREATE TABLE IF NOT EXISTS league_host_teams (
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  PRIMARY KEY (league_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_league_host_teams_league ON league_host_teams(league_id);
CREATE INDEX IF NOT EXISTS idx_league_host_teams_team ON league_host_teams(team_id);

ALTER TABLE league_host_teams ENABLE ROW LEVEL SECURITY;

-- Users can view host teams in leagues they belong to
CREATE POLICY "Users can view host teams in their leagues" ON league_host_teams
  FOR SELECT USING (
    league_id IN (SELECT league_id FROM teams WHERE user_id = auth.uid())
  );

-- Only commissioners can manage host teams
CREATE POLICY "Commissioners can manage host teams" ON league_host_teams
  FOR ALL USING (
    league_id IN (SELECT id FROM leagues WHERE commissioner_user_id = auth.uid())
  );

COMMENT ON TABLE league_host_teams IS 'Teams whose owners have host rights. Commissioner can add/remove.';
