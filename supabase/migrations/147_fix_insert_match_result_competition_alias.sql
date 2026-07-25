-- The latest insert_match_result selected COALESCE(competition_type) without
-- an alias, then read v_match.competition_type from the anonymous record.
DO $$
DECLARE
  v_definition TEXT;
BEGIN
  SELECT pg_get_functiondef('public.insert_match_result(uuid,integer,integer,uuid)'::regprocedure)
  INTO v_definition;

  IF v_definition NOT LIKE '%AS competition_type, m.group_name%' THEN
    v_definition := replace(
      v_definition,
      'COALESCE(m.competition_type, ''domestic''), m.group_name',
      'COALESCE(m.competition_type, ''domestic'') AS competition_type, m.group_name'
    );
    EXECUTE v_definition;
  END IF;
END;
$$;
