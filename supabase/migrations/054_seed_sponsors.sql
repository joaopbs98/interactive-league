-- 054: Seed sponsors table (IL25 - make sponsors work)
-- base_payment/bonus_amount in same units as finances (e.g. 67500000 = 67.5M)
-- Sponsors are available every season; teams sign them in OFFSEASON.

INSERT INTO sponsors (name, base_payment, bonus_amount, bonus_condition)
SELECT v.name, v.base_payment, v.bonus_amount, v.bonus_condition
FROM (VALUES
  ('Vodafone'::text, 67500000, 15000000, 'position<=4'::text),
  ('Spotify', 67500000, 15000000, 'position<=4'),
  ('Qatar Airways', 95000000, 25000000, 'champion'),
  ('Crypto.com', 70000000, 20000000, 'position<=4'),
  ('Emirates', 80000000, 20000000, 'champion'),
  ('Nike', 50000000, NULL::integer, NULL::text),
  ('Puma', 45000000, 10000000, 'position<=4'),
  ('Adidas', 55000000, 15000000, 'champion')
) AS v(name, base_payment, bonus_amount, bonus_condition)
WHERE NOT EXISTS (SELECT 1 FROM sponsors s WHERE s.name = v.name);
