-- 092: Auto-calculate CompIndex when league_players change (add/remove/trade)
-- Trigger calls update_league_compindex for affected league(s)

CREATE OR REPLACE FUNCTION trigger_compindex_on_league_players()
RETURNS TRIGGER AS $$
DECLARE
  v_league_id UUID;
  v_old_league_id UUID;
BEGIN
  -- For INSERT: update league of new team
  IF TG_OP = 'INSERT' AND NEW.team_id IS NOT NULL THEN
    SELECT league_id INTO v_league_id FROM teams WHERE id = NEW.team_id;
    IF v_league_id IS NOT NULL THEN
      PERFORM update_league_compindex(v_league_id);
    END IF;
    RETURN NEW;
  END IF;

  -- For DELETE: update league of old team
  IF TG_OP = 'DELETE' AND OLD.team_id IS NOT NULL THEN
    SELECT league_id INTO v_league_id FROM teams WHERE id = OLD.team_id;
    IF v_league_id IS NOT NULL THEN
      PERFORM update_league_compindex(v_league_id);
    END IF;
    RETURN OLD;
  END IF;

  -- For UPDATE: if team_id changed, update both leagues; else update current league
  IF TG_OP = 'UPDATE' THEN
    IF OLD.team_id IS DISTINCT FROM NEW.team_id THEN
      IF OLD.team_id IS NOT NULL THEN
        SELECT league_id INTO v_old_league_id FROM teams WHERE id = OLD.team_id;
        IF v_old_league_id IS NOT NULL THEN
          PERFORM update_league_compindex(v_old_league_id);
        END IF;
      END IF;
      IF NEW.team_id IS NOT NULL THEN
        SELECT league_id INTO v_league_id FROM teams WHERE id = NEW.team_id;
        IF v_league_id IS NOT NULL AND v_league_id IS DISTINCT FROM v_old_league_id THEN
          PERFORM update_league_compindex(v_league_id);
        END IF;
      END IF;
    ELSE
      SELECT league_id INTO v_league_id FROM teams WHERE id = NEW.team_id;
      IF v_league_id IS NOT NULL THEN
        PERFORM update_league_compindex(v_league_id);
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_compindex_league_players ON league_players;
CREATE TRIGGER trg_compindex_league_players
  AFTER INSERT OR UPDATE OR DELETE ON league_players
  FOR EACH ROW
  EXECUTE FUNCTION trigger_compindex_on_league_players();

-- One-time: ensure all leagues have up-to-date comp_index
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT league_id FROM league_players WHERE league_id IS NOT NULL
  LOOP
    PERFORM update_league_compindex(r.league_id);
  END LOOP;
END $$;
