-- 089: delete_league - host-only function to delete entire league and cascade
CREATE OR REPLACE FUNCTION delete_league(p_league_id UUID, p_actor_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_commissioner UUID;
BEGIN
  SELECT commissioner_user_id INTO v_commissioner FROM leagues WHERE id = p_league_id;
  IF v_commissioner IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'League not found');
  END IF;
  IF v_commissioner != p_actor_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Only the league commissioner can delete the league');
  END IF;

  DELETE FROM league_players WHERE league_id = p_league_id;
  DELETE FROM injuries WHERE league_id = p_league_id;
  DELETE FROM matches WHERE league_id = p_league_id;
  DELETE FROM standings WHERE league_id = p_league_id;
  DELETE FROM hall_of_fame WHERE league_id = p_league_id;
  DELETE FROM team_competition_results WHERE league_id = p_league_id;
  DELETE FROM audit_logs WHERE league_id = p_league_id;
  DELETE FROM draft_picks WHERE league_id = p_league_id;
  DELETE FROM teams WHERE league_id = p_league_id;
  DELETE FROM leagues WHERE id = p_league_id;

  RETURN json_build_object('success', true, 'message', 'League deleted');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
