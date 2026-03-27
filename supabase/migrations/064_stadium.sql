-- 064: Stadium - visitor focus, seasonal performance, attendance & revenue (IL25 spec)
-- Per IL25_GAME_LOGIC_TRUTH.md

ALTER TABLE teams ADD COLUMN IF NOT EXISTS capacity INTEGER DEFAULT 40000;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS visitor_focus TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS confirm_vf BOOLEAN DEFAULT false;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS seasonal_performance TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS sc_appearance BOOLEAN DEFAULT false;

COMMENT ON COLUMN teams.capacity IS 'Stadium capacity for attendance calculation';
COMMENT ON COLUMN teams.visitor_focus IS 'Core Fanbase | Local Casuals | Tourists | Hospitality & VIP';
COMMENT ON COLUMN teams.confirm_vf IS 'Checkbox to lock visitor focus selection';
COMMENT ON COLUMN teams.seasonal_performance IS 'UCL Winners, UCL Finalist, etc. - host enters after season';
COMMENT ON COLUMN teams.sc_appearance IS 'Super Cup appearance checkbox';
