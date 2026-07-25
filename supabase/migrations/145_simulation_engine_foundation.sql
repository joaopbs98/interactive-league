-- FC IQ tactics and deterministic simulation persistence foundation.
-- Behavioral contract: docs/simulation-engine-source-of-truth.md

CREATE TABLE team_tactics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default',
  is_active BOOLEAN NOT NULL DEFAULT true,
  formation TEXT NOT NULL,
  build_up_style TEXT NOT NULL DEFAULT 'balanced' CHECK (build_up_style IN ('short_passing', 'balanced', 'counter')),
  defensive_approach TEXT NOT NULL DEFAULT 'balanced' CHECK (defensive_approach IN ('deep', 'balanced', 'high', 'aggressive')),
  line_height INTEGER NOT NULL DEFAULT 50 CHECK (line_height BETWEEN 1 AND 100),
  engine_version TEXT NOT NULL DEFAULT 'fc25-il-1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (league_id, team_id, name),
  CHECK (
    (defensive_approach = 'deep' AND line_height BETWEEN 1 AND 30) OR
    (defensive_approach = 'balanced' AND line_height BETWEEN 31 AND 60) OR
    (defensive_approach = 'high' AND line_height BETWEEN 61 AND 90) OR
    (defensive_approach = 'aggressive' AND line_height BETWEEN 91 AND 100)
  )
);

CREATE UNIQUE INDEX team_tactics_one_active_per_team
  ON team_tactics (league_id, team_id) WHERE is_active;

CREATE TABLE team_tactic_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tactic_id UUID NOT NULL REFERENCES team_tactics(id) ON DELETE CASCADE,
  league_id UUID NOT NULL,
  player_id TEXT NOT NULL,
  slot_index INTEGER NOT NULL CHECK (slot_index BETWEEN 0 AND 10),
  slot_position TEXT NOT NULL,
  role TEXT NOT NULL,
  focus TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tactic_id, slot_index),
  UNIQUE (tactic_id, player_id),
  FOREIGN KEY (league_id, player_id) REFERENCES league_players(league_id, player_id) ON DELETE CASCADE
);

CREATE TABLE simulation_settings (
  league_id UUID PRIMARY KEY REFERENCES leagues(id) ON DELETE CASCADE,
  preset TEXT NOT NULL DEFAULT 'balanced' CHECK (preset IN ('balanced', 'rating_heavy', 'tactical', 'custom')),
  engine_version TEXT NOT NULL DEFAULT 'fc25-il-1',
  overall_influence INTEGER NOT NULL DEFAULT 60 CHECK (overall_influence BETWEEN 35 AND 80),
  tactical_influence INTEGER NOT NULL DEFAULT 25 CHECK (tactical_influence BETWEEN 10 AND 45),
  home_advantage INTEGER NOT NULL DEFAULT 5 CHECK (home_advantage BETWEEN 0 AND 12),
  variance INTEGER NOT NULL DEFAULT 50 CHECK (variance BETWEEN 20 AND 80),
  fog_strength INTEGER NOT NULL DEFAULT 40 CHECK (fog_strength BETWEEN 0 AND 80),
  fatigue_effect INTEGER NOT NULL DEFAULT 50 CHECK (fatigue_effect BETWEEN 0 AND 100),
  injury_frequency INTEGER NOT NULL DEFAULT 50 CHECK (injury_frequency BETWEEN 0 AND 100),
  discipline_frequency INTEGER NOT NULL DEFAULT 50 CHECK (discipline_frequency BETWEEN 0 AND 100),
  goal_environment INTEGER NOT NULL DEFAULT 50 CHECK (goal_environment BETWEEN 20 AND 80),
  preview_rerolls INTEGER NOT NULL DEFAULT 1 CHECK (preview_rerolls BETWEEN 0 AND 3),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (overall_influence + tactical_influence <= 100)
);

CREATE TABLE simulation_previews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  season INTEGER NOT NULL,
  round INTEGER NOT NULL,
  competition_type TEXT NOT NULL DEFAULT 'domestic',
  attempt INTEGER NOT NULL DEFAULT 0 CHECK (attempt BETWEEN 0 AND 3),
  seed TEXT NOT NULL,
  engine_version TEXT NOT NULL,
  settings_snapshot JSONB NOT NULL,
  input_snapshot JSONB NOT NULL,
  output_snapshot JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'preview' CHECK (status IN ('preview', 'committed', 'discarded', 'expired')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  committed_at TIMESTAMPTZ,
  UNIQUE (league_id, season, competition_type, round, attempt)
);

CREATE UNIQUE INDEX simulation_previews_one_active
  ON simulation_previews (league_id, season, competition_type, round) WHERE status = 'preview';

CREATE TABLE match_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  season INTEGER NOT NULL,
  sequence INTEGER NOT NULL CHECK (sequence >= 0),
  minute INTEGER NOT NULL CHECK (minute BETWEEN 0 AND 130),
  stoppage_minute INTEGER NOT NULL DEFAULT 0 CHECK (stoppage_minute BETWEEN 0 AND 15),
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  player_id TEXT,
  secondary_player_id TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('goal', 'own_goal', 'penalty_goal', 'penalty_miss', 'shot', 'save', 'yellow_card', 'red_card', 'injury', 'substitution', 'offside', 'tactical_focus')),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (match_id, sequence)
);

CREATE TABLE team_match_stats (
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  possession NUMERIC(5,2) NOT NULL CHECK (possession BETWEEN 0 AND 100),
  shots INTEGER NOT NULL DEFAULT 0,
  shots_on_target INTEGER NOT NULL DEFAULT 0,
  xg NUMERIC(6,3) NOT NULL DEFAULT 0,
  passes INTEGER NOT NULL DEFAULT 0,
  completed_passes INTEGER NOT NULL DEFAULT 0,
  corners INTEGER NOT NULL DEFAULT 0,
  fouls INTEGER NOT NULL DEFAULT 0,
  offsides INTEGER NOT NULL DEFAULT 0,
  saves INTEGER NOT NULL DEFAULT 0,
  tactic_snapshot JSONB NOT NULL,
  PRIMARY KEY (match_id, team_id)
);

CREATE TABLE player_match_stats (
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  starter BOOLEAN NOT NULL DEFAULT false,
  role TEXT,
  focus TEXT,
  minutes INTEGER NOT NULL DEFAULT 0 CHECK (minutes BETWEEN 0 AND 130),
  rating NUMERIC(3,1) CHECK (rating BETWEEN 1 AND 10),
  goals INTEGER NOT NULL DEFAULT 0,
  assists INTEGER NOT NULL DEFAULT 0,
  shots INTEGER NOT NULL DEFAULT 0,
  shots_on_target INTEGER NOT NULL DEFAULT 0,
  key_passes INTEGER NOT NULL DEFAULT 0,
  passes INTEGER NOT NULL DEFAULT 0,
  completed_passes INTEGER NOT NULL DEFAULT 0,
  tackles INTEGER NOT NULL DEFAULT 0,
  interceptions INTEGER NOT NULL DEFAULT 0,
  saves INTEGER NOT NULL DEFAULT 0,
  fouls INTEGER NOT NULL DEFAULT 0,
  yellow_cards INTEGER NOT NULL DEFAULT 0,
  red_cards INTEGER NOT NULL DEFAULT 0,
  fatigue_delta NUMERIC(5,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (match_id, player_id),
  FOREIGN KEY (league_id, player_id) REFERENCES league_players(league_id, player_id) ON DELETE CASCADE
);

CREATE TABLE player_availability_state (
  league_id UUID NOT NULL,
  player_id TEXT NOT NULL,
  fatigue NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (fatigue BETWEEN 0 AND 100),
  domestic_yellows INTEGER NOT NULL DEFAULT 0,
  ucl_yellows INTEGER NOT NULL DEFAULT 0,
  uel_yellows INTEGER NOT NULL DEFAULT 0,
  uecl_yellows INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (league_id, player_id),
  FOREIGN KEY (league_id, player_id) REFERENCES league_players(league_id, player_id) ON DELETE CASCADE
);

CREATE INDEX match_events_match_minute_idx ON match_events(match_id, minute, sequence);
CREATE INDEX player_match_stats_league_player_idx ON player_match_stats(league_id, player_id);

ALTER TABLE team_tactics ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_tactic_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulation_previews ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_match_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_match_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_availability_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "League members view tactics" ON team_tactics FOR SELECT USING (team_tactics.league_id IN (SELECT public.get_user_league_ids(auth.uid())));
CREATE POLICY "Team owners manage tactics" ON team_tactics FOR ALL USING (EXISTS (SELECT 1 FROM teams t WHERE t.id = team_tactics.team_id AND t.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM teams t WHERE t.id = team_tactics.team_id AND t.user_id = auth.uid() AND t.league_id = team_tactics.league_id));
CREATE POLICY "League members view tactic assignments" ON team_tactic_assignments FOR SELECT USING (team_tactic_assignments.league_id IN (SELECT public.get_user_league_ids(auth.uid())));
CREATE POLICY "Team owners manage tactic assignments" ON team_tactic_assignments FOR ALL USING (EXISTS (SELECT 1 FROM team_tactics tt JOIN teams t ON t.id = tt.team_id WHERE tt.id = team_tactic_assignments.tactic_id AND t.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM team_tactics tt JOIN teams t ON t.id = tt.team_id WHERE tt.id = team_tactic_assignments.tactic_id AND t.user_id = auth.uid() AND tt.league_id = team_tactic_assignments.league_id));
CREATE POLICY "League members view simulation settings" ON simulation_settings FOR SELECT USING (simulation_settings.league_id IN (SELECT public.get_user_league_ids(auth.uid())));
CREATE POLICY "Hosts manage simulation settings" ON simulation_settings FOR ALL USING (EXISTS (SELECT 1 FROM leagues l WHERE l.id = simulation_settings.league_id AND l.commissioner_user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM leagues l WHERE l.id = simulation_settings.league_id AND l.commissioner_user_id = auth.uid()));
CREATE POLICY "Hosts view simulation previews" ON simulation_previews FOR SELECT USING (EXISTS (SELECT 1 FROM leagues l WHERE l.id = simulation_previews.league_id AND l.commissioner_user_id = auth.uid()));
CREATE POLICY "League members view match events" ON match_events FOR SELECT USING (match_events.league_id IN (SELECT public.get_user_league_ids(auth.uid())));
CREATE POLICY "League members view team match stats" ON team_match_stats FOR SELECT USING (team_match_stats.league_id IN (SELECT public.get_user_league_ids(auth.uid())));
CREATE POLICY "League members view player match stats" ON player_match_stats FOR SELECT USING (player_match_stats.league_id IN (SELECT public.get_user_league_ids(auth.uid())));
CREATE POLICY "League members view availability" ON player_availability_state FOR SELECT USING (player_availability_state.league_id IN (SELECT public.get_user_league_ids(auth.uid())));

INSERT INTO simulation_settings (league_id)
SELECT id FROM leagues ON CONFLICT (league_id) DO NOTHING;

INSERT INTO team_tactics (league_id, team_id, formation)
SELECT t.league_id, t.id, COALESCE(t.formation, '4-3-3')
FROM teams t WHERE t.league_id IS NOT NULL
ON CONFLICT (league_id, team_id, name) DO NOTHING;

CREATE OR REPLACE FUNCTION save_team_tactic(
  p_team_id UUID,
  p_actor_user_id UUID,
  p_formation TEXT,
  p_starting_lineup JSONB,
  p_bench JSONB,
  p_reserves JSONB,
  p_eafc_tactic_code TEXT,
  p_eafc_comment TEXT,
  p_build_up_style TEXT,
  p_defensive_approach TEXT,
  p_line_height INTEGER,
  p_assignments JSONB
) RETURNS JSON AS $$
DECLARE
  v_team teams%ROWTYPE;
  v_tactic_id UUID;
  v_unavailable TEXT;
BEGIN
  SELECT * INTO v_team FROM teams WHERE id = p_team_id FOR UPDATE;
  IF v_team.id IS NULL OR v_team.user_id <> p_actor_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized to update this team');
  END IF;
  IF jsonb_array_length(COALESCE(p_starting_lineup, '[]'::JSONB)) <> 11 OR jsonb_array_length(COALESCE(p_assignments, '[]'::JSONB)) <> 11 THEN
    RETURN json_build_object('success', false, 'error', 'A complete starting XI and 11 tactical assignments are required');
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_assignments) item
    WHERE NOT EXISTS (SELECT 1 FROM league_players lp WHERE lp.league_id = v_team.league_id AND lp.team_id = p_team_id AND lp.player_id = item->>'playerId')
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Every tactical assignment must belong to this team and save');
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_assignments) item
    WHERE NOT (p_starting_lineup ? (item->>'playerId'))
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Tactical assignments must match the selected starting XI');
  END IF;
  SELECT string_agg(lp.player_name || CASE WHEN COALESCE(lp.injury_games_remaining, 0) > 0 THEN ' (injured)' ELSE ' (suspended)' END, ', ')
  INTO v_unavailable
  FROM league_players lp JOIN jsonb_array_elements(p_assignments) item ON item->>'playerId' = lp.player_id
  WHERE lp.league_id = v_team.league_id AND lp.team_id = p_team_id
    AND (COALESCE(lp.injury_games_remaining, 0) > 0 OR COALESCE(lp.suspension_games_remaining, 0) > 0);
  IF v_unavailable IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'Unavailable starters: ' || v_unavailable);
  END IF;

  UPDATE teams SET
    formation = p_formation,
    starting_lineup = p_starting_lineup,
    bench = COALESCE(p_bench, '[]'::JSONB),
    reserves = COALESCE(p_reserves, '[]'::JSONB),
    eafc_tactic_code = NULLIF(p_eafc_tactic_code, ''),
    eafc_comment = NULLIF(p_eafc_comment, '')
  WHERE id = p_team_id;

  INSERT INTO team_tactics (league_id, team_id, name, is_active, formation, build_up_style, defensive_approach, line_height)
  VALUES (v_team.league_id, p_team_id, 'Default', true, p_formation, p_build_up_style, p_defensive_approach, p_line_height)
  ON CONFLICT (league_id, team_id, name) DO UPDATE SET
    is_active = true, formation = EXCLUDED.formation, build_up_style = EXCLUDED.build_up_style,
    defensive_approach = EXCLUDED.defensive_approach, line_height = EXCLUDED.line_height, updated_at = NOW()
  RETURNING id INTO v_tactic_id;

  DELETE FROM team_tactic_assignments WHERE tactic_id = v_tactic_id;
  INSERT INTO team_tactic_assignments (tactic_id, league_id, player_id, slot_index, slot_position, role, focus)
  SELECT v_tactic_id, v_team.league_id, item->>'playerId', (item->>'slotIndex')::INTEGER,
    item->>'slotPosition', item->>'role', item->>'focus'
  FROM jsonb_array_elements(p_assignments) item;

  UPDATE simulation_previews SET status = 'expired'
  WHERE league_id = v_team.league_id AND status = 'preview';

  RETURN json_build_object('success', true, 'tactic_id', v_tactic_id);
EXCEPTION WHEN check_violation OR unique_violation OR foreign_key_violation THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Commit one immutable host preview as a single transaction. Any exception rolls
-- back the match result, tables, player totals, availability, and preview state.
CREATE OR REPLACE FUNCTION commit_simulation_preview(
  p_preview_id UUID,
  p_actor_user_id UUID
) RETURNS JSON AS $$
DECLARE
  v_preview simulation_previews%ROWTYPE;
  v_match JSONB;
  v_event JSONB;
  v_line JSONB;
  v_side TEXT;
  v_stats JSONB;
  v_team_id UUID;
  v_result JSONB;
  v_injury_games INTEGER;
  v_yellow_total INTEGER;
BEGIN
  SELECT * INTO v_preview FROM simulation_previews WHERE id = p_preview_id FOR UPDATE;
  IF v_preview.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Simulation preview not found');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM leagues WHERE id = v_preview.league_id AND commissioner_user_id = p_actor_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Host only');
  END IF;
  IF v_preview.status = 'committed' THEN
    RETURN json_build_object('success', true, 'preview_id', v_preview.id, 'already_committed', true);
  END IF;
  IF v_preview.status <> 'preview' THEN
    RETURN json_build_object('success', false, 'error', 'Preview is no longer active');
  END IF;

  -- One matchday of recovery/served bans is applied exactly once inside the
  -- same commit transaction, before new match consequences are recorded.
  UPDATE player_availability_state SET fatigue = GREATEST(0, fatigue - 12), updated_at = NOW()
  WHERE league_id = v_preview.league_id;
  UPDATE league_players SET
    injury_games_remaining = GREATEST(0, COALESCE(injury_games_remaining, 0) - 1),
    suspension_games_remaining = GREATEST(0, COALESCE(suspension_games_remaining, 0) - 1)
  WHERE league_id = v_preview.league_id
    AND (COALESCE(injury_games_remaining, 0) > 0 OR COALESCE(suspension_games_remaining, 0) > 0);
  UPDATE injuries SET games_remaining = GREATEST(0, games_remaining - 1), updated_at = NOW()
  WHERE league_id = v_preview.league_id AND games_remaining > 0;
  DELETE FROM injuries WHERE league_id = v_preview.league_id AND games_remaining = 0;

  FOR v_match IN SELECT value FROM jsonb_array_elements(v_preview.output_snapshot->'matches') LOOP
    IF NOT EXISTS (
      SELECT 1 FROM matches m WHERE m.id = (v_match->>'matchId')::UUID
        AND m.league_id = v_preview.league_id AND m.season = v_preview.season
        AND m.round = v_preview.round AND m.match_status = 'scheduled'
    ) THEN
      RAISE EXCEPTION 'Preview is stale: match % is no longer scheduled', v_match->>'matchId';
    END IF;

    v_result := insert_match_result(
      (v_match->>'matchId')::UUID,
      (v_match->>'homeScore')::INTEGER,
      (v_match->>'awayScore')::INTEGER,
      p_actor_user_id
    )::JSONB;
    IF NOT COALESCE((v_result->>'success')::BOOLEAN, false) THEN
      RAISE EXCEPTION 'Could not commit match %: %', v_match->>'matchId', v_result->>'error';
    END IF;

    FOR v_event IN SELECT value FROM jsonb_array_elements(COALESCE(v_match->'events', '[]'::JSONB)) LOOP
      INSERT INTO match_events (match_id, league_id, season, sequence, minute, team_id, player_id, secondary_player_id, event_type, metadata)
      VALUES (
        (v_match->>'matchId')::UUID, v_preview.league_id, v_preview.season,
        (v_event->>'sequence')::INTEGER, (v_event->>'minute')::INTEGER,
        NULLIF(v_event->>'teamId', '')::UUID, NULLIF(v_event->>'playerId', ''),
        NULLIF(v_event->>'secondaryPlayerId', ''), v_event->>'type',
        COALESCE(v_event->'metadata', '{}'::JSONB)
      );

      IF v_event->>'type' = 'injury' THEN
        v_injury_games := CASE v_event->'metadata'->>'severity' WHEN 'major' THEN 6 WHEN 'moderate' THEN 3 ELSE 1 END;
        UPDATE league_players SET injury_games_remaining = GREATEST(COALESCE(injury_games_remaining, 0), v_injury_games)
        WHERE league_id = v_preview.league_id AND player_id = v_event->>'playerId';
        INSERT INTO injuries (player_id, team_id, league_id, type, description, games_remaining, match_id)
        VALUES (v_event->>'playerId', (v_event->>'teamId')::UUID, v_preview.league_id, 'injury',
          'Simulation injury (' || COALESCE(v_event->'metadata'->>'severity', 'minor') || ')', v_injury_games,
          (v_match->>'matchId')::UUID);
      END IF;
    END LOOP;

    FOREACH v_side IN ARRAY ARRAY['home', 'away'] LOOP
      v_team_id := CASE WHEN v_side = 'home' THEN (v_match->>'homeTeamId')::UUID ELSE (v_match->>'awayTeamId')::UUID END;
      v_stats := v_match->'teamStats'->v_side;
      INSERT INTO team_match_stats (match_id, league_id, team_id, possession, shots, shots_on_target, xg, passes, completed_passes, corners, fouls, offsides, saves, tactic_snapshot)
      VALUES ((v_match->>'matchId')::UUID, v_preview.league_id, v_team_id,
        (v_stats->>'possession')::NUMERIC, COALESCE((v_stats->>'shots')::INTEGER, 0),
        COALESCE((v_stats->>'shotsOnTarget')::INTEGER, 0), COALESCE((v_stats->>'xg')::NUMERIC, 0),
        COALESCE((v_stats->>'passes')::INTEGER, 0), COALESCE((v_stats->>'completedPasses')::INTEGER, 0),
        COALESCE((v_stats->>'corners')::INTEGER, 0), COALESCE((v_stats->>'fouls')::INTEGER, 0),
        COALESCE((v_stats->>'offsides')::INTEGER, 0), COALESCE((v_stats->>'saves')::INTEGER, 0),
        v_preview.input_snapshot->'teams'->(v_team_id::TEXT)->'tactic');
    END LOOP;

    FOR v_line IN SELECT value FROM jsonb_array_elements(COALESCE(v_match->'playerStats', '[]'::JSONB)) LOOP
      INSERT INTO player_match_stats (match_id, league_id, team_id, player_id, starter, role, focus, minutes, rating, goals, assists, shots, shots_on_target, key_passes, passes, completed_passes, tackles, interceptions, saves, fouls, yellow_cards, red_cards, fatigue_delta)
      VALUES ((v_match->>'matchId')::UUID, v_preview.league_id, (v_line->>'teamId')::UUID, v_line->>'playerId',
        COALESCE((v_line->>'starter')::BOOLEAN, false), NULLIF(v_line->>'role', ''), NULLIF(v_line->>'focus', ''), COALESCE((v_line->>'minutes')::INTEGER, 0),
        (v_line->>'rating')::NUMERIC, COALESCE((v_line->>'goals')::INTEGER, 0), COALESCE((v_line->>'assists')::INTEGER, 0),
        COALESCE((v_line->>'shots')::INTEGER, 0), COALESCE((v_line->>'shotsOnTarget')::INTEGER, 0), COALESCE((v_line->>'keyPasses')::INTEGER, 0),
        COALESCE((v_line->>'passes')::INTEGER, 0), COALESCE((v_line->>'completedPasses')::INTEGER, 0), COALESCE((v_line->>'tackles')::INTEGER, 0),
        COALESCE((v_line->>'interceptions')::INTEGER, 0), COALESCE((v_line->>'saves')::INTEGER, 0), COALESCE((v_line->>'fouls')::INTEGER, 0),
        COALESCE((v_line->>'yellowCards')::INTEGER, 0), COALESCE((v_line->>'redCards')::INTEGER, 0), COALESCE((v_line->>'fatigueDelta')::NUMERIC, 0));

      UPDATE league_players SET
        goals = COALESCE(goals, 0) + COALESCE((v_line->>'goals')::INTEGER, 0),
        assists = COALESCE(assists, 0) + COALESCE((v_line->>'assists')::INTEGER, 0)
      WHERE league_id = v_preview.league_id AND player_id = v_line->>'playerId';

      INSERT INTO player_availability_state (league_id, player_id, fatigue, domestic_yellows, ucl_yellows, uel_yellows, uecl_yellows)
      VALUES (v_preview.league_id, v_line->>'playerId', LEAST(100, COALESCE((v_line->>'fatigueDelta')::NUMERIC, 0)),
        CASE WHEN v_preview.competition_type = 'domestic' THEN COALESCE((v_line->>'yellowCards')::INTEGER, 0) ELSE 0 END,
        CASE WHEN v_preview.competition_type = 'ucl' THEN COALESCE((v_line->>'yellowCards')::INTEGER, 0) ELSE 0 END,
        CASE WHEN v_preview.competition_type = 'uel' THEN COALESCE((v_line->>'yellowCards')::INTEGER, 0) ELSE 0 END,
        CASE WHEN v_preview.competition_type = 'uecl' THEN COALESCE((v_line->>'yellowCards')::INTEGER, 0) ELSE 0 END)
      ON CONFLICT (league_id, player_id) DO UPDATE SET
        fatigue = LEAST(100, player_availability_state.fatigue + EXCLUDED.fatigue),
        domestic_yellows = player_availability_state.domestic_yellows + EXCLUDED.domestic_yellows,
        ucl_yellows = player_availability_state.ucl_yellows + EXCLUDED.ucl_yellows,
        uel_yellows = player_availability_state.uel_yellows + EXCLUDED.uel_yellows,
        uecl_yellows = player_availability_state.uecl_yellows + EXCLUDED.uecl_yellows,
        updated_at = NOW();

      IF COALESCE((v_line->>'redCards')::INTEGER, 0) > 0 THEN
        UPDATE league_players SET suspension_games_remaining = GREATEST(COALESCE(suspension_games_remaining, 0), 1)
        WHERE league_id = v_preview.league_id AND player_id = v_line->>'playerId';
        INSERT INTO injuries (player_id, team_id, league_id, type, description, games_remaining, match_id)
        VALUES (v_line->>'playerId', (v_line->>'teamId')::UUID, v_preview.league_id, 'suspension', 'Red card suspension', 1, (v_match->>'matchId')::UUID);
      END IF;

      IF COALESCE((v_line->>'yellowCards')::INTEGER, 0) > 0 THEN
        SELECT CASE v_preview.competition_type
          WHEN 'ucl' THEN ucl_yellows WHEN 'uel' THEN uel_yellows WHEN 'uecl' THEN uecl_yellows ELSE domestic_yellows END
        INTO v_yellow_total FROM player_availability_state
        WHERE league_id = v_preview.league_id AND player_id = v_line->>'playerId';
        IF v_yellow_total >= (CASE WHEN v_preview.competition_type = 'domestic' THEN 5 ELSE 3 END) THEN
          UPDATE league_players SET suspension_games_remaining = GREATEST(COALESCE(suspension_games_remaining, 0), 1)
          WHERE league_id = v_preview.league_id AND player_id = v_line->>'playerId';
          UPDATE player_availability_state SET
            domestic_yellows = CASE WHEN v_preview.competition_type = 'domestic' THEN 0 ELSE domestic_yellows END,
            ucl_yellows = CASE WHEN v_preview.competition_type = 'ucl' THEN 0 ELSE ucl_yellows END,
            uel_yellows = CASE WHEN v_preview.competition_type = 'uel' THEN 0 ELSE uel_yellows END,
            uecl_yellows = CASE WHEN v_preview.competition_type = 'uecl' THEN 0 ELSE uecl_yellows END
          WHERE league_id = v_preview.league_id AND player_id = v_line->>'playerId';
          INSERT INTO injuries (player_id, team_id, league_id, type, description, games_remaining, match_id)
          VALUES (v_line->>'playerId', (v_line->>'teamId')::UUID, v_preview.league_id, 'suspension', 'Yellow card accumulation', 1, (v_match->>'matchId')::UUID);
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  UPDATE simulation_previews SET status = 'committed', committed_at = NOW() WHERE id = v_preview.id;
  PERFORM write_audit_log(v_preview.league_id, 'commit_simulation_preview', p_actor_user_id,
    json_build_object('preview_id', v_preview.id, 'season', v_preview.season, 'round', v_preview.round, 'competition_type', v_preview.competition_type)::JSONB);
  RETURN json_build_object('success', true, 'preview_id', v_preview.id, 'matches_committed', jsonb_array_length(v_preview.output_snapshot->'matches'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
