-- 125: Seed sponsor_season_terms and sponsor_payout_tiers for Vodafone, Spotify, Qatar Airways
-- Remove Crypto.com, Emirates, Nike, Puma, Adidas. Update contract_start_seasons for main sponsors.

-- Remove deprecated sponsors from league_sponsors and teams, then delete
DELETE FROM league_sponsors WHERE sponsor_id IN (SELECT id FROM sponsors WHERE name IN ('Crypto.com','Emirates','Nike','Puma','Adidas'));
UPDATE teams SET sponsor_id = NULL, sponsor_signed_at_season = NULL, sponsor_contract_ends_season = NULL
  WHERE sponsor_id IN (SELECT id FROM sponsors WHERE name IN ('Crypto.com','Emirates','Nike','Puma','Adidas'));
DELETE FROM sponsors WHERE name IN ('Crypto.com','Emirates','Nike','Puma','Adidas');

-- Set contract_start_seasons for main sponsors (can be picked in S2, S5, S7, S9)
UPDATE sponsors SET contract_start_seasons = ARRAY[2,5,7,9] WHERE name IN ('Vodafone','Spotify','Qatar Airways');

-- Vodafone: S2-S10
INSERT INTO sponsor_season_terms (sponsor_id, season, base_payment, bonus_condition_code, bonus_merch_pct, payout_type)
SELECT s.id, v.season, v.base_payment, v.bonus_condition_code, v.bonus_merch_pct, 'fixed'
FROM sponsors s, (VALUES
  (2, 40000000, 'sign_japan_china_top14', 2.5),
  (3, 45000000, 'sign_usa_top14', 2.5),
  (4, 52500000, 'sign_75plus_top14', 2.5),
  (5, 67500000, 'ucl_qualify', 1),
  (6, 85000000, 'ucl_qualify', 1),
  (7, 105000000, 'ucl_qualify', 1),
  (8, 130000000, 'ucl_qualify', 1),
  (9, 160000000, 'ucl_qualify', 1),
  (10, 200000000, 'ucl_qualify', 1)
) AS v(season, base_payment, bonus_condition_code, bonus_merch_pct)
WHERE s.name = 'Vodafone'
ON CONFLICT (sponsor_id, season) DO UPDATE SET
  base_payment = EXCLUDED.base_payment,
  bonus_condition_code = EXCLUDED.bonus_condition_code,
  bonus_merch_pct = EXCLUDED.bonus_merch_pct;

-- Spotify: S2-S8
INSERT INTO sponsor_season_terms (sponsor_id, season, base_payment, bonus_amount, bonus_condition_code, transfer_request_count, transfer_request_rank, merch_modifier, payout_type)
SELECT s.id, v.season, v.base_payment, v.bonus_amount, v.bonus_condition_code, v.tr_count, v.tr_rank, v.merch_mod, 'fixed'
FROM sponsors s, (VALUES
  (2, 47500000, 7500000, 'ucl_or_uel_winner', 1, 1, -2.5),
  (3, 52500000, 7500000, 'ucl_or_uel_winner', 1, 1, -2.5),
  (4, 60000000, 7500000, 'ucl_or_uel_winner', 1, 1, -2.5),
  (5, 80000000, NULL::integer, NULL, 0, 1, 0),
  (6, 20000000, NULL, NULL, 0, 1, 0),
  (7, 122500000, NULL, NULL, 0, 1, 0),
  (8, 32500000, NULL, NULL, 0, 1, 0)
) AS v(season, base_payment, bonus_amount, bonus_condition_code, tr_count, tr_rank, merch_mod)
WHERE s.name = 'Spotify'
ON CONFLICT (sponsor_id, season) DO UPDATE SET
  base_payment = EXCLUDED.base_payment,
  bonus_amount = EXCLUDED.bonus_amount,
  bonus_condition_code = EXCLUDED.bonus_condition_code,
  transfer_request_count = EXCLUDED.transfer_request_count,
  transfer_request_rank = EXCLUDED.transfer_request_rank,
  merch_modifier = EXCLUDED.merch_modifier,
  payout_type = CASE WHEN EXCLUDED.season IN (6,8) THEN 'performance_tier' ELSE 'fixed' END;

UPDATE sponsor_season_terms SET payout_type = 'performance_tier' WHERE sponsor_id = (SELECT id FROM sponsors WHERE name = 'Spotify') AND season IN (6,8);

-- Qatar: S2-S10
INSERT INTO sponsor_season_terms (sponsor_id, season, base_payment, bonus_amount, bonus_condition_code, transfer_request_count, transfer_request_rank, merch_modifier, repayment_penalty, payout_type)
SELECT s.id, v.season, v.base_payment, v.bonus_amount, v.bonus_condition_code, v.tr_count, v.tr_rank, v.merch_mod, v.repay, 'fixed'
FROM sponsors s, (VALUES
  (2, 55000000, 12500000, 'ucl_semi', 2, 1, -2.5, 15000000),
  (3, 60000000, 12500000, 'ucl_semi', 2, 1, -2.5, 15000000),
  (4, 65000000, 12500000, 'ucl_semi', 2, 1, -2.5, 15000000),
  (5, 95000000, NULL, NULL, 0, 1, 0, 0),
  (6, 0, NULL, NULL, 0, 1, 0, 0),
  (7, 147500000, NULL, NULL, 0, 1, 0, 0),
  (8, 0, NULL, NULL, 0, 1, 0, 0),
  (9, 220000000, NULL, NULL, 0, 1, 0, 0),
  (10, 0, NULL, NULL, 0, 1, 0, 0)
) AS v(season, base_payment, bonus_amount, bonus_condition_code, tr_count, tr_rank, merch_mod, repay)
WHERE s.name = 'Qatar Airways'
ON CONFLICT (sponsor_id, season) DO UPDATE SET
  base_payment = EXCLUDED.base_payment,
  bonus_amount = EXCLUDED.bonus_amount,
  bonus_condition_code = EXCLUDED.bonus_condition_code,
  transfer_request_count = EXCLUDED.transfer_request_count,
  transfer_request_rank = EXCLUDED.transfer_request_rank,
  merch_modifier = EXCLUDED.merch_modifier,
  repayment_penalty = EXCLUDED.repayment_penalty;

UPDATE sponsor_season_terms SET payout_type = 'performance_tier' WHERE sponsor_id = (SELECT id FROM sponsors WHERE name = 'Qatar Airways') AND season IN (6,8,10);

-- Sponsor payout tiers: Spotify S6 (base 20M + tier)
-- stage_pattern: group, semi, finalist, winner
INSERT INTO sponsor_payout_tiers (sponsor_season_term_id, competition, stage_pattern, payout_amount, transfer_request_count, transfer_request_rank)
SELECT sst.id, v.comp, v.stage, v.amt, v.tr_cnt, v.tr_rank
FROM sponsor_season_terms sst
JOIN sponsors s ON s.id = sst.sponsor_id AND s.name = 'Spotify' AND sst.season = 6,
(VALUES
  ('uecl','group',0,1,2), ('uecl','semi',5000000,1,3), ('uecl','finalist',12500000,1,4), ('uecl','winner',20000000,0,1),
  ('uel','group',30000000,0,1), ('uel','semi',40000000,0,1), ('uel','finalist',50000000,0,1), ('uel','winner',60000000,0,1),
  ('ucl','group',70000000,0,1), ('ucl','semi',80000000,0,1), ('ucl','finalist',90000000,0,1), ('ucl','winner',100000000,0,1)
) AS v(comp, stage, amt, tr_cnt, tr_rank);

-- Spotify S8 (base 32.5M + tier)
INSERT INTO sponsor_payout_tiers (sponsor_season_term_id, competition, stage_pattern, payout_amount, transfer_request_count, transfer_request_rank)
SELECT sst.id, v.comp, v.stage, v.amt, v.tr_cnt, v.tr_rank
FROM sponsor_season_terms sst
JOIN sponsors s ON s.id = sst.sponsor_id AND s.name = 'Spotify' AND sst.season = 8,
(VALUES
  ('uecl','group',0,1,2), ('uecl','semi',7500000,1,3), ('uecl','finalist',20000000,1,4), ('uecl','winner',30000000,0,1),
  ('uel','group',42500000,0,1), ('uel','semi',55000000,0,1), ('uel','finalist',67500000,0,1), ('uel','winner',80000000,0,1),
  ('ucl','group',107500000,0,1), ('ucl','semi',125000000,0,1), ('ucl','finalist',140000000,0,1), ('ucl','winner',155000000,0,1)
) AS v(comp, stage, amt, tr_cnt, tr_rank);

-- Qatar S6 (fully performance-based)
INSERT INTO sponsor_payout_tiers (sponsor_season_term_id, competition, stage_pattern, payout_amount, merch_modifier, transfer_request_count, transfer_request_rank)
SELECT sst.id, v.comp, v.stage, v.amt, v.merch_mod, v.tr_cnt, v.tr_rank
FROM sponsor_season_terms sst
JOIN sponsors s ON s.id = sst.sponsor_id AND s.name = 'Qatar Airways' AND sst.season = 6,
(VALUES
  ('uecl','group',10000000,-4,1,1), ('uecl','semi',15000000,-3.5,1,2), ('uecl','finalist',22500000,-3,1,3), ('uecl','winner',30000000,-2.5,0,1),
  ('uel','group',40000000,-2,0,1), ('uel','semi',50000000,-1.5,0,1), ('uel','finalist',60000000,-1,0,1), ('uel','winner',70000000,-0.5,0,1),
  ('ucl','group',100000000,0,0,1), ('ucl','semi',112500000,0,0,1), ('ucl','finalist',125000000,0,0,1), ('ucl','winner',140000000,0,0,1)
) AS v(comp, stage, amt, merch_mod, tr_cnt, tr_rank);

-- Qatar S8 (fully performance-based)
INSERT INTO sponsor_payout_tiers (sponsor_season_term_id, competition, stage_pattern, payout_amount, merch_modifier, transfer_request_count, transfer_request_rank)
SELECT sst.id, v.comp, v.stage, v.amt, v.merch_mod, v.tr_cnt, v.tr_rank
FROM sponsor_season_terms sst
JOIN sponsors s ON s.id = sst.sponsor_id AND s.name = 'Qatar Airways' AND sst.season = 8,
(VALUES
  ('uecl','group',10000000,-4,1,1), ('uecl','semi',20000000,-3.5,1,2), ('uecl','finalist',30000000,-3,1,3), ('uecl','winner',40000000,-2.5,0,1),
  ('uel','group',50000000,-2,1,3), ('uel','semi',62500000,-1.5,0,1), ('uel','finalist',75000000,-1,0,1), ('uel','winner',87500000,-0.5,0,1),
  ('ucl','group',155000000,0,0,1), ('ucl','semi',175000000,0,0,1), ('ucl','finalist',195000000,0,0,1), ('ucl','winner',215000000,0,0,1)
) AS v(comp, stage, amt, merch_mod, tr_cnt, tr_rank);

-- Qatar S10 (fully performance-based)
INSERT INTO sponsor_payout_tiers (sponsor_season_term_id, competition, stage_pattern, payout_amount, merch_modifier, transfer_request_count, transfer_request_rank)
SELECT sst.id, v.comp, v.stage, v.amt, v.merch_mod, v.tr_cnt, v.tr_rank
FROM sponsor_season_terms sst
JOIN sponsors s ON s.id = sst.sponsor_id AND s.name = 'Qatar Airways' AND sst.season = 10,
(VALUES
  ('uecl','group',30000000,0,1,1), ('uecl','semi',40000000,0,1,2), ('uecl','finalist',50000000,0,1,3), ('uecl','winner',60000000,0,0,1),
  ('uel','group',72500000,0,1,3), ('uel','semi',90000000,0,0,1), ('uel','finalist',110000000,0,0,1), ('uel','winner',130000000,0,0,1),
  ('ucl','group',230000000,0,0,1), ('ucl','semi',260000000,0,0,1), ('ucl','finalist',290000000,0,0,1), ('ucl','winner',320000000,0,0,1)
) AS v(comp, stage, amt, merch_mod, tr_cnt, tr_rank);
