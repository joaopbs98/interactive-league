-- Preview, reroll and commit one fixture at a time while retaining round scheduling.
ALTER TABLE simulation_previews ADD COLUMN match_id UUID REFERENCES matches(id) ON DELETE CASCADE;

UPDATE simulation_previews
SET match_id = NULLIF(output_snapshot->'matches'->0->>'matchId', '')::UUID
WHERE jsonb_array_length(COALESCE(output_snapshot->'matches', '[]'::JSONB)) = 1;

ALTER TABLE simulation_previews
  DROP CONSTRAINT IF EXISTS simulation_previews_league_id_season_competition_type_round_key;
DROP INDEX IF EXISTS simulation_previews_one_active;

CREATE UNIQUE INDEX simulation_previews_match_attempt
  ON simulation_previews (league_id, season, competition_type, round, match_id, attempt)
  WHERE match_id IS NOT NULL;

CREATE UNIQUE INDEX simulation_previews_one_active_match
  ON simulation_previews (league_id, season, competition_type, round, match_id)
  WHERE status = 'preview' AND match_id IS NOT NULL;
