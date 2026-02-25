-- 037: Add missing FK constraints on matches table so PostgREST joins work
-- The schedule API uses teams!matches_home_team_id_fkey syntax which requires named FKs

ALTER TABLE matches
  ADD CONSTRAINT matches_home_team_id_fkey
  FOREIGN KEY (home_team_id) REFERENCES teams(id) ON DELETE SET NULL;

ALTER TABLE matches
  ADD CONSTRAINT matches_away_team_id_fkey
  FOREIGN KEY (away_team_id) REFERENCES teams(id) ON DELETE SET NULL;
