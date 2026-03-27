-- 126: Extend eval_sponsor_bonus for IL25 sponsor objectives
-- sign_japan_china_top14, sign_usa_top14, sign_75plus_top14, ucl_qualify, ucl_or_uel_winner, ucl_semi
-- Top 14 = highest rated 14 players in squad. Nationality from player.country_name.

CREATE OR REPLACE FUNCTION eval_sponsor_bonus(
  p_team_id UUID,
  p_league_id UUID,
  p_season INTEGER,
  p_bonus_condition TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_position INTEGER;
  v_stage TEXT;
  v_exists BOOLEAN;
BEGIN
  IF p_bonus_condition IS NULL OR p_bonus_condition = '' THEN
    RETURN false;
  END IF;

  SELECT pos INTO v_position FROM (
    SELECT team_id, ROW_NUMBER() OVER (ORDER BY points DESC, goal_diff DESC, goals_for DESC) as pos
    FROM standings WHERE league_id = p_league_id AND season = p_season
  ) sub WHERE team_id = p_team_id;

  SELECT stage INTO v_stage FROM team_competition_results
  WHERE league_id = p_league_id AND team_id = p_team_id AND season = p_season
  LIMIT 1;

  -- IL25: Sign player from Japan or China, must be in top 14 by rating
  IF p_bonus_condition ILIKE 'sign_japan_china_top14' THEN
    SELECT EXISTS (
      SELECT 1 FROM league_players lp
      JOIN player p ON p.player_id = lp.player_id
      WHERE lp.team_id = p_team_id
        AND p.country_name IN ('Japan', 'China')
        AND lp.id IN (
          SELECT id FROM league_players
          WHERE team_id = p_team_id
          ORDER BY rating DESC NULLS LAST
          LIMIT 14
        )
    ) INTO v_exists;
    RETURN v_exists;
  END IF;

  -- IL25: Sign player from USA, must be in top 14
  IF p_bonus_condition ILIKE 'sign_usa_top14' THEN
    SELECT EXISTS (
      SELECT 1 FROM league_players lp
      JOIN player p ON p.player_id = lp.player_id
      WHERE lp.team_id = p_team_id
        AND (p.country_name ILIKE '%United States%' OR p.country_name ILIKE '%USA%')
        AND lp.id IN (
          SELECT id FROM league_players
          WHERE team_id = p_team_id
          ORDER BY rating DESC NULLS LAST
          LIMIT 14
        )
    ) INTO v_exists;
    RETURN v_exists;
  END IF;

  -- IL25: Sign player rated 75+, must be in top 14
  IF p_bonus_condition ILIKE 'sign_75plus_top14' THEN
    SELECT EXISTS (
      SELECT 1 FROM league_players lp
      WHERE lp.team_id = p_team_id
        AND lp.rating >= 75
        AND lp.id IN (
          SELECT id FROM league_players
          WHERE team_id = p_team_id
          ORDER BY rating DESC NULLS LAST
          LIMIT 14
        )
    ) INTO v_exists;
    RETURN v_exists;
  END IF;

  -- IL25: Qualify for UCL (domestic top 4)
  IF p_bonus_condition ILIKE 'ucl_qualify' THEN
    RETURN v_position IS NOT NULL AND v_position <= 4;
  END IF;

  -- IL25: Reach UCL or Win UEL
  IF p_bonus_condition ILIKE 'ucl_or_uel_winner' THEN
    RETURN v_stage IS NOT NULL AND (
      v_stage ILIKE '%UCL%' OR v_stage ILIKE '%UEL%Winner%'
    );
  END IF;

  -- IL25: Reach UCL Semi-Finals (semi, finalist, or winner)
  IF p_bonus_condition ILIKE 'ucl_semi' THEN
    RETURN v_stage IS NOT NULL AND v_stage ILIKE '%UCL%' AND (
      v_stage ILIKE '%Semi%' OR v_stage ILIKE '%Finalist%' OR v_stage ILIKE '%Winner%'
    );
  END IF;

  -- Legacy conditions (keep for custom sponsors)
  IF p_bonus_condition ILIKE '%position%4%' OR p_bonus_condition ILIKE '%top%4%' THEN
    RETURN v_position IS NOT NULL AND v_position <= 4;
  ELSIF p_bonus_condition ILIKE '%position%6%' OR p_bonus_condition ILIKE '%top%6%' THEN
    RETURN v_position IS NOT NULL AND v_position <= 6;
  ELSIF p_bonus_condition ILIKE '%champion%' OR p_bonus_condition ILIKE '%1st%' OR p_bonus_condition ILIKE '%first%' THEN
    RETURN v_position = 1;
  ELSIF p_bonus_condition ILIKE '%ucl%winner%' OR p_bonus_condition ILIKE '%ucl winners%' THEN
    RETURN v_stage IS NOT NULL AND v_stage ILIKE '%UCL%Winner%';
  ELSIF p_bonus_condition ILIKE '%ucl%finalist%' THEN
    RETURN v_stage IS NOT NULL AND v_stage ILIKE '%UCL%Finalist%';
  ELSIF p_bonus_condition ILIKE '%ucl%semi%' THEN
    RETURN v_stage IS NOT NULL AND v_stage ILIKE '%UCL%Semi%';
  ELSIF p_bonus_condition ILIKE '%ucl%group%' THEN
    RETURN v_stage IS NOT NULL AND v_stage ILIKE '%UCL%Group%';
  ELSIF p_bonus_condition ILIKE '%uel%winner%' OR p_bonus_condition ILIKE '%uel winners%' THEN
    RETURN v_stage IS NOT NULL AND v_stage ILIKE '%UEL%Winner%';
  ELSIF p_bonus_condition ILIKE '%uel%group%' THEN
    RETURN v_stage IS NOT NULL AND v_stage ILIKE '%UEL%Group%';
  ELSIF p_bonus_condition ILIKE '%uecl%winner%' OR p_bonus_condition ILIKE '%uecl winners%' THEN
    RETURN v_stage IS NOT NULL AND v_stage ILIKE '%UECL%Winner%';
  ELSIF p_bonus_condition ILIKE '%uecl%group%' THEN
    RETURN v_stage IS NOT NULL AND v_stage ILIKE '%UECL%Group%';
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql STABLE;
