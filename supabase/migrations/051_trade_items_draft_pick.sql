-- 051: Add draft_pick to trade_items (IL25 spec - draft pick trading)
-- Allows including draft picks in trades

-- Drop existing check and add new one including draft_pick
ALTER TABLE trade_items DROP CONSTRAINT IF EXISTS trade_items_item_type_check;
ALTER TABLE trade_items ADD CONSTRAINT trade_items_item_type_check
  CHECK (item_type IN ('player', 'money', 'objective', 'draft_pick'));

-- Add draft_pick_id column
ALTER TABLE trade_items ADD COLUMN IF NOT EXISTS draft_pick_id UUID REFERENCES draft_picks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_trade_items_draft_pick ON trade_items(draft_pick_id);
