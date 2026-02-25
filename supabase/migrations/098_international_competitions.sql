-- 098: International competitions - add competition_type to matches
-- domestic | ucl | uel | uecl. Default domestic for backward compatibility.

ALTER TABLE matches ADD COLUMN IF NOT EXISTS competition_type TEXT DEFAULT 'domestic';

UPDATE matches SET competition_type = 'domestic' WHERE competition_type IS NULL;

COMMENT ON COLUMN matches.competition_type IS 'domestic | ucl | uel | uecl. International matches for UCL/UEL/UECL.';
