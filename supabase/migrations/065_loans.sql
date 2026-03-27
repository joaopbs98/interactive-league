-- 065: Loans system - 25% interest, S2-S7 only (IL25 spec)
-- $60M loan -> $75M total repayment

CREATE TABLE IF NOT EXISTS loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  repay_total INTEGER NOT NULL,
  season_taken INTEGER NOT NULL,
  restructure_pct INTEGER DEFAULT 0,
  restructure_confirmed BOOLEAN DEFAULT false,
  repay_made INTEGER DEFAULT 0,
  remaining INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loans_team ON loans(team_id);
CREATE INDEX IF NOT EXISTS idx_loans_league ON loans(league_id);

ALTER TABLE loans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view loans for their teams" ON loans
  FOR SELECT USING (
    team_id IN (SELECT id FROM teams WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert loans for their teams" ON loans
  FOR INSERT WITH CHECK (
    team_id IN (SELECT id FROM teams WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update loans for their teams" ON loans
  FOR UPDATE USING (
    team_id IN (SELECT id FROM teams WHERE user_id = auth.uid())
  );

CREATE POLICY "Host can manage loans" ON loans
  FOR ALL USING (
    league_id IN (SELECT id FROM leagues WHERE commissioner_user_id = auth.uid())
  );
