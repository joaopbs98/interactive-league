-- Upgrade tickets may only target a player the current owner ended the
-- previous season with. Ownership can change through the Auction House, so
-- eligibility is intentionally derived from the ticket's current team.
CREATE TABLE IF NOT EXISTS team_season_roster_snapshots (
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  season INTEGER NOT NULL,
  player_id TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (league_id, team_id, season, player_id)
);

CREATE INDEX IF NOT EXISTS idx_roster_snapshots_team_season
  ON team_season_roster_snapshots(team_id, season);

ALTER TABLE team_season_roster_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers can view own roster snapshots"
  ON team_season_roster_snapshots FOR SELECT
  USING (team_id IN (SELECT id FROM teams WHERE user_id = auth.uid()));

CREATE OR REPLACE FUNCTION snapshot_rosters_before_season_end()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'SEASON_END_PROCESSING' AND OLD.status IS DISTINCT FROM 'SEASON_END_PROCESSING' THEN
    INSERT INTO team_season_roster_snapshots (league_id, team_id, season, player_id)
    SELECT OLD.id, lp.team_id, OLD.season, lp.player_id
    FROM league_players lp
    WHERE lp.league_id = OLD.id AND lp.team_id IS NOT NULL
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_snapshot_rosters_before_season_end ON leagues;
CREATE TRIGGER trg_snapshot_rosters_before_season_end
  BEFORE UPDATE OF status ON leagues
  FOR EACH ROW EXECUTE FUNCTION snapshot_rosters_before_season_end();

-- Existing offseason leagues predate snapshots. Seed their prior-season
-- baseline from the currently retained roster so tickets are immediately usable.
INSERT INTO team_season_roster_snapshots (league_id, team_id, season, player_id)
SELECT l.id, lp.team_id, GREATEST(1, l.season - 1), lp.player_id
FROM leagues l
JOIN league_players lp ON lp.league_id = l.id AND lp.team_id IS NOT NULL
WHERE l.status = 'OFFSEASON'
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION use_upgrade_ticket(p_ticket_id UUID, p_player_id TEXT, p_actor_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_ticket RECORD;
  v_rating_boost INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM auctions WHERE upgrade_ticket_id = p_ticket_id AND status IN ('draft', 'active')) THEN
    RETURN json_build_object('success', false, 'error', 'Ticket is listed in an auction');
  END IF;

  SELECT tut.id, tut.team_id, tut.tier, tut.used_on_player_id, t.league_id, l.season, l.status
  INTO v_ticket
  FROM team_upgrade_tickets tut
  JOIN teams t ON t.id = tut.team_id
  JOIN leagues l ON l.id = t.league_id
  WHERE tut.id = p_ticket_id;

  IF v_ticket IS NULL THEN RETURN json_build_object('success', false, 'error', 'Ticket not found'); END IF;
  IF v_ticket.used_on_player_id IS NOT NULL THEN RETURN json_build_object('success', false, 'error', 'Ticket already used'); END IF;
  IF v_ticket.status <> 'OFFSEASON' THEN RETURN json_build_object('success', false, 'error', 'Tickets can only be used during transfer season'); END IF;
  IF NOT EXISTS (SELECT 1 FROM teams WHERE id = v_ticket.team_id AND user_id = p_actor_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Not your team');
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM league_players lp
    JOIN team_season_roster_snapshots rs
      ON rs.league_id = lp.league_id AND rs.team_id = lp.team_id AND rs.player_id = lp.player_id
    WHERE lp.league_id = v_ticket.league_id
      AND lp.team_id = v_ticket.team_id
      AND lp.player_id = p_player_id
      AND rs.season = GREATEST(1, v_ticket.season - 1)
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Choose a player you ended last season with and still own');
  END IF;

  v_rating_boost := CASE v_ticket.tier WHEN 'bronze' THEN 1 WHEN 'silver' THEN 2 WHEN 'gold' THEN 3 WHEN 'platinum' THEN 4 ELSE 1 END;
  UPDATE league_players SET rating = LEAST(99, COALESCE(rating, 0) + v_rating_boost)
  WHERE league_id = v_ticket.league_id AND team_id = v_ticket.team_id AND player_id = p_player_id;
  UPDATE team_upgrade_tickets SET used_on_player_id = p_player_id, used_at = NOW() WHERE id = p_ticket_id;

  PERFORM write_audit_log(v_ticket.league_id, 'use_upgrade_ticket', p_actor_user_id,
    jsonb_build_object('ticket_id', p_ticket_id, 'tier', v_ticket.tier, 'player_id', p_player_id, 'rating_boost', v_rating_boost));
  RETURN json_build_object('success', true, 'rating_boost', v_rating_boost, 'player_id', p_player_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
