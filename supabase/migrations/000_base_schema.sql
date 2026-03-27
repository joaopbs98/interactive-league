-- 000_base_schema.sql
-- Base schema for Interactive League.
-- Creates all core tables that later migrations (001+) expect to exist.
-- Column names are aligned with lib/database.types.ts.

-- Create leagues table
CREATE TABLE IF NOT EXISTS leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  season INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  commissioner_user_id UUID,
  active_season INTEGER
);

-- Create sponsors table (referenced by teams.sponsor_id)
CREATE TABLE IF NOT EXISTS sponsors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  base_payment INTEGER NOT NULL,
  bonus_amount INTEGER,
  bonus_condition TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create teams table
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  acronym TEXT NOT NULL DEFAULT '',
  logo_url TEXT,
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
  user_id UUID,
  formation TEXT,
  bench JSONB,
  reserves JSONB,
  squad JSONB,
  starting_lineup JSONB,
  expendables TEXT[] DEFAULT '{}',
  budget NUMERIC DEFAULT 0,
  comp_index NUMERIC,
  stock_value NUMERIC,
  sponsor_id UUID REFERENCES sponsors(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create player table (global player pool imported from EA FC data)
CREATE TABLE IF NOT EXISTS player (
  player_id TEXT PRIMARY KEY,
  name TEXT,
  full_name TEXT,
  description TEXT,
  image TEXT,
  version TEXT,
  positions TEXT,
  overall_rating INTEGER,
  potential INTEGER,
  value TEXT,
  wage TEXT,
  release_clause TEXT,
  dob TEXT,
  height_cm TEXT,
  weight_kg TEXT,
  body_type TEXT,
  real_face TEXT,
  work_rate TEXT,
  weak_foot TEXT,
  skill_moves TEXT,
  international_reputation TEXT,
  specialities TEXT,
  play_styles TEXT,
  preferred_foot TEXT,
  acceleration INTEGER,
  sprint_speed INTEGER,
  agility INTEGER,
  reactions INTEGER,
  balance INTEGER,
  shot_power INTEGER,
  jumping INTEGER,
  stamina INTEGER,
  strength INTEGER,
  long_shots INTEGER,
  aggression INTEGER,
  interceptions INTEGER,
  positioning INTEGER,
  vision INTEGER,
  penalties INTEGER,
  composure INTEGER,
  crossing INTEGER,
  finishing INTEGER,
  heading_accuracy INTEGER,
  short_passing INTEGER,
  volleys INTEGER,
  dribbling INTEGER,
  curve INTEGER,
  fk_accuracy INTEGER,
  long_passing INTEGER,
  ball_control INTEGER,
  defensive_awareness INTEGER,
  standing_tackle INTEGER,
  sliding_tackle INTEGER,
  gk_diving INTEGER,
  gk_handling INTEGER,
  gk_kicking INTEGER,
  gk_positioning INTEGER,
  gk_reflexes INTEGER,
  club_id TEXT,
  club_name TEXT,
  club_position TEXT,
  club_kit_number TEXT,
  club_joined TEXT,
  club_contract_valid_until TEXT,
  club_rating TEXT,
  club_logo TEXT,
  club_league_id INTEGER,
  club_league_name TEXT,
  country_id TEXT,
  country_name TEXT,
  country_position TEXT,
  country_kit_number TEXT,
  country_rating TEXT,
  country_flag TEXT,
  country_league_id TEXT,
  country_league_name TEXT
);

-- Create contracts table (used by trades, packs, finances helpers)
CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id TEXT NOT NULL REFERENCES player(player_id),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  wage INTEGER NOT NULL,
  signing_bonus INTEGER,
  start_season INTEGER NOT NULL,
  end_season BOOLEAN,
  years INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(team_id, player_id)
);

-- Create contract_values reference table
CREATE TABLE IF NOT EXISTS contract_values (
  rating INTEGER NOT NULL,
  att_value INTEGER NOT NULL,
  def_value INTEGER NOT NULL,
  created_at TIMESTAMPTZ
);

-- Create finances table
CREATE TABLE IF NOT EXISTS finances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  reason TEXT,
  season INTEGER NOT NULL,
  date TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create matches table
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  home_team_id UUID,
  away_team_id UUID,
  home_score INTEGER,
  away_score INTEGER,
  date TEXT,
  match_day INTEGER,
  season INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create objectives table
CREATE TABLE IF NOT EXISTS objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_team_id UUID,
  to_team_id UUID,
  description TEXT NOT NULL,
  trigger_condition TEXT NOT NULL,
  reward_amount INTEGER NOT NULL,
  fulfilled BOOLEAN NOT NULL DEFAULT false,
  trade_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create draft_picks table
CREATE TABLE IF NOT EXISTS draft_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  pick_number INTEGER NOT NULL,
  player_id TEXT,
  season INTEGER NOT NULL,
  item_reward TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create player_origins table
CREATE TABLE IF NOT EXISTS player_origins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id TEXT REFERENCES player(player_id),
  origin_type TEXT NOT NULL,
  origin_details JSONB,
  created_at TIMESTAMPTZ
);

-- Create wage_discounts table
CREATE TABLE IF NOT EXISTS wage_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id TEXT REFERENCES player(player_id),
  discount_type TEXT NOT NULL,
  discount_percentage INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  applied_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

-- Create indexes on core tables
CREATE INDEX IF NOT EXISTS idx_teams_league_id ON teams(league_id);
CREATE INDEX IF NOT EXISTS idx_teams_user_id ON teams(user_id);
CREATE INDEX IF NOT EXISTS idx_contracts_team_id ON contracts(team_id);
CREATE INDEX IF NOT EXISTS idx_contracts_player_id ON contracts(player_id);
CREATE INDEX IF NOT EXISTS idx_player_overall_rating ON player(overall_rating);
CREATE INDEX IF NOT EXISTS idx_player_positions ON player(positions);
