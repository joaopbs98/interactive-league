-- 088: League-specific stat overrides for league_players + notifications table
-- Stat overrides: when set, use instead of player table values for this league
-- Notifications: in-game alerts (pick sponsor, contract ending, loan warning, etc.)

-- Add stat override columns to league_players (nullable; when set, override player table)
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS acceleration INTEGER;
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS sprint_speed INTEGER;
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS agility INTEGER;
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS reactions INTEGER;
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS balance INTEGER;
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS shot_power INTEGER;
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS jumping INTEGER;
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS stamina INTEGER;
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS strength INTEGER;
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS long_shots INTEGER;
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS aggression INTEGER;
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS interceptions INTEGER;
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS positioning INTEGER;
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS vision INTEGER;
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS penalties INTEGER;
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS composure INTEGER;
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS crossing INTEGER;
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS finishing INTEGER;
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS heading_accuracy INTEGER;
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS short_passing INTEGER;
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS volleys INTEGER;
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS dribbling INTEGER;
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS curve INTEGER;
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS fk_accuracy INTEGER;
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS long_passing INTEGER;
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS ball_control INTEGER;
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS defensive_awareness INTEGER;
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS standing_tackle INTEGER;
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS sliding_tackle INTEGER;
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS gk_diving INTEGER;
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS gk_handling INTEGER;
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS gk_kicking INTEGER;
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS gk_positioning INTEGER;
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS gk_reflexes INTEGER;

COMMENT ON COLUMN league_players.acceleration IS 'League override; when set, used instead of player.acceleration';

-- Notifications table for in-game alerts
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_league ON notifications(league_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications (mark read)"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);
