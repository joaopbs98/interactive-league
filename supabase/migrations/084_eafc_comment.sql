-- 084: EAFC comment/notes for managers to add notes for host (manual match mode)

ALTER TABLE teams ADD COLUMN IF NOT EXISTS eafc_comment TEXT;
COMMENT ON COLUMN teams.eafc_comment IS 'Manager notes for host (e.g. formation tips, key players)';
