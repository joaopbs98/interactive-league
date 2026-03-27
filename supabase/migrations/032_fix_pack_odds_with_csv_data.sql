-- Fix Pack Odds with Real CSV Data - Migration 032
-- This migration updates the pack_rating_odds table with the actual data from AutoPackIL25 - Packs (1).csv

-- First, clear existing pack odds to start fresh
DELETE FROM pack_rating_odds;

-- Now populate with the real CSV data
-- Season 3 Basic (from CSV: 60-67 ratings with proper probabilities)
INSERT INTO pack_rating_odds (pack_id, rating, probability) 
SELECT p.id, r.rating, r.probability
FROM packs p
CROSS JOIN (VALUES 
  (60, 0.045), (61, 0.101), (62, 0.161), (63, 0.352), (64, 0.209), (65, 0.085), (66, 0.036), (67, 0.011)
) AS r(rating, probability)
WHERE p.name = 'S3 Basic';

-- Season 3 Prime (from CSV: 61-69 ratings)
INSERT INTO pack_rating_odds (pack_id, rating, probability) 
SELECT p.id, r.rating, r.probability
FROM packs p
CROSS JOIN (VALUES 
  (61, 0.028), (62, 0.081), (63, 0.186), (64, 0.311), (65, 0.164), (66, 0.101), (67, 0.064), (68, 0.040), (69, 0.025)
) AS r(rating, probability)
WHERE p.name = 'S3 Prime';

-- Season 3 Elite (from CSV: 62-72 ratings)
INSERT INTO pack_rating_odds (pack_id, rating, probability) 
SELECT p.id, r.rating, r.probability
FROM packs p
CROSS JOIN (VALUES 
  (62, 0.053), (63, 0.108), (64, 0.171), (65, 0.271), (66, 0.177), (67, 0.085), (68, 0.054), (69, 0.033), (70, 0.020), (71, 0.014), (72, 0.009)
) AS r(rating, probability)
WHERE p.name = 'S3 Elite';

-- Season 4 Basic (from CSV: 62-66 ratings)
INSERT INTO pack_rating_odds (pack_id, rating, probability) 
SELECT p.id, r.rating, r.probability
FROM packs p
CROSS JOIN (VALUES 
  (62, 0.039), (63, 0.086), (64, 0.161), (65, 0.321), (66, 0.241), (67, 0.105), (68, 0.047)
) AS r(rating, probability)
WHERE p.name = 'S4 Basic';

-- Season 4 Prime (from CSV: 63-70 ratings)
INSERT INTO pack_rating_odds (pack_id, rating, probability) 
SELECT p.id, r.rating, r.probability
FROM packs p
CROSS JOIN (VALUES 
  (63, 0.025), (64, 0.078), (65, 0.173), (66, 0.301), (67, 0.201), (68, 0.099), (69, 0.063), (70, 0.038), (71, 0.022)
) AS r(rating, probability)
WHERE p.name = 'S4 Prime';

-- Season 4 Elite (from CSV: 64-72 ratings)
INSERT INTO pack_rating_odds (pack_id, rating, probability) 
SELECT p.id, r.rating, r.probability
FROM packs p
CROSS JOIN (VALUES 
  (64, 0.054), (65, 0.109), (66, 0.174), (67, 0.275), (68, 0.168), (69, 0.085), (70, 0.054), (71, 0.033), (72, 0.020), (73, 0.014), (74, 0.009)
) AS r(rating, probability)
WHERE p.name = 'S4 Elite';

-- Season 5 Basic (from CSV: 65-69 ratings)
INSERT INTO pack_rating_odds (pack_id, rating, probability) 
SELECT p.id, r.rating, r.probability
FROM packs p
CROSS JOIN (VALUES 
  (65, 0.034), (66, 0.087), (67, 0.163), (68, 0.297), (69, 0.259), (70, 0.112), (71, 0.048)
) AS r(rating, probability)
WHERE p.name = 'S5 Basic';

-- Season 5 Prime (from CSV: 67-75 ratings)
INSERT INTO pack_rating_odds (pack_id, rating, probability) 
SELECT p.id, r.rating, r.probability
FROM packs p
CROSS JOIN (VALUES 
  (67, 0.033), (68, 0.105), (69, 0.209), (70, 0.271), (71, 0.171), (72, 0.113), (73, 0.052), (74, 0.032), (75, 0.014)
) AS r(rating, probability)
WHERE p.name = 'S5 Prime';

-- Season 5 Elite (from CSV: 68-78 ratings)
INSERT INTO pack_rating_odds (pack_id, rating, probability) 
SELECT p.id, r.rating, r.probability
FROM packs p
CROSS JOIN (VALUES 
  (68, 0.059), (69, 0.135), (70, 0.206), (71, 0.226), (72, 0.177), (73, 0.080), (74, 0.052), (75, 0.030), (76, 0.017), (77, 0.012), (78, 0.006)
) AS r(rating, probability)
WHERE p.name = 'S5 Elite';

-- Season 6 Basic (from CSV: 72-79 ratings)
INSERT INTO pack_rating_odds (pack_id, rating, probability) 
SELECT p.id, r.rating, r.probability
FROM packs p
CROSS JOIN (VALUES 
  (72, 0.032), (73, 0.068), (74, 0.139), (75, 0.225), (76, 0.276), (77, 0.132), (78, 0.072), (79, 0.035), (80, 0.021)
) AS r(rating, probability)
WHERE p.name = 'S6 Basic';

-- Season 6 Prime (from CSV: 73-80 ratings)
INSERT INTO pack_rating_odds (pack_id, rating, probability) 
SELECT p.id, r.rating, r.probability
FROM packs p
CROSS JOIN (VALUES 
  (73, 0.067), (74, 0.112), (75, 0.219), (76, 0.279), (77, 0.158), (78, 0.079), (79, 0.046), (80, 0.027), (81, 0.013)
) AS r(rating, probability)
WHERE p.name = 'S6 Prime';

-- Season 6 Elite (from CSV: 74-82 ratings)
INSERT INTO pack_rating_odds (pack_id, rating, probability) 
SELECT p.id, r.rating, r.probability
FROM packs p
CROSS JOIN (VALUES 
  (74, 0.063), (75, 0.156), (76, 0.221), (77, 0.229), (78, 0.148), (79, 0.075), (80, 0.047), (81, 0.029), (82, 0.016), (83, 0.011), (84, 0.005)
) AS r(rating, probability)
WHERE p.name = 'S6 Elite';

-- Season 7 Basic (from CSV: 72-79 ratings)
INSERT INTO pack_rating_odds (pack_id, rating, probability) 
SELECT p.id, r.rating, r.probability
FROM packs p
CROSS JOIN (VALUES 
  (72, 0.029), (73, 0.061), (74, 0.121), (75, 0.180), (76, 0.252), (77, 0.197), (78, 0.085), (79, 0.049), (80, 0.026)
) AS r(rating, probability)
WHERE p.name = 'S7 Basic';

-- Season 7 Prime (from CSV: 74-80 ratings)
INSERT INTO pack_rating_odds (pack_id, rating, probability) 
SELECT p.id, r.rating, r.probability
FROM packs p
CROSS JOIN (VALUES 
  (74, 0.061), (75, 0.121), (76, 0.182), (77, 0.268), (78, 0.195), (79, 0.085), (80, 0.049), (81, 0.026), (82, 0.013)
) AS r(rating, probability)
WHERE p.name = 'S7 Prime';

-- Season 7 Elite (from CSV: 75-82 ratings)
INSERT INTO pack_rating_odds (pack_id, rating, probability) 
SELECT p.id, r.rating, r.probability
FROM packs p
CROSS JOIN (VALUES 
  (75, 0.062), (76, 0.146), (77, 0.179), (78, 0.234), (79, 0.174), (80, 0.081), (81, 0.053), (82, 0.031), (83, 0.019), (84, 0.013), (85, 0.008)
) AS r(rating, probability)
WHERE p.name = 'S7 Elite';

-- Season 8 Basic (from CSV: 72-79 ratings)
INSERT INTO pack_rating_odds (pack_id, rating, probability) 
SELECT p.id, r.rating, r.probability
FROM packs p
CROSS JOIN (VALUES 
  (72, 0.022), (73, 0.050), (74, 0.096), (75, 0.158), (76, 0.241), (77, 0.211), (78, 0.126), (79, 0.063), (80, 0.033)
) AS r(rating, probability)
WHERE p.name = 'S8 Basic';

-- Season 8 Prime (from CSV: 74-81 ratings)
INSERT INTO pack_rating_odds (pack_id, rating, probability) 
SELECT p.id, r.rating, r.probability
FROM packs p
CROSS JOIN (VALUES 
  (74, 0.050), (75, 0.096), (76, 0.158), (77, 0.232), (78, 0.211), (79, 0.126), (80, 0.063), (81, 0.033), (82, 0.022), (83, 0.009)
) AS r(rating, probability)
WHERE p.name = 'S8 Prime';

-- Season 8 Elite (from CSV: 75-83 ratings)
INSERT INTO pack_rating_odds (pack_id, rating, probability) 
SELECT p.id, r.rating, r.probability
FROM packs p
CROSS JOIN (VALUES 
  (75, 0.050), (76, 0.096), (77, 0.158), (78, 0.230), (79, 0.200), (80, 0.125), (81, 0.062), (82, 0.032), (83, 0.022), (84, 0.013), (85, 0.008), (86, 0.004)
) AS r(rating, probability)
WHERE p.name = 'S8 Elite';

-- Season 9 Basic (from CSV: 74-79 ratings)
INSERT INTO pack_rating_odds (pack_id, rating, probability) 
SELECT p.id, r.rating, r.probability
FROM packs p
CROSS JOIN (VALUES 
  (74, 0.022), (75, 0.050), (76, 0.096), (77, 0.158), (78, 0.241), (79, 0.211), (80, 0.126), (81, 0.063), (82, 0.033)
) AS r(rating, probability)
WHERE p.name = 'S9 Basic';

-- Season 9 Prime (from CSV: 76-82 ratings)
INSERT INTO pack_rating_odds (pack_id, rating, probability) 
SELECT p.id, r.rating, r.probability
FROM packs p
CROSS JOIN (VALUES 
  (76, 0.050), (77, 0.096), (78, 0.158), (79, 0.232), (80, 0.207), (81, 0.126), (82, 0.063), (83, 0.033), (84, 0.022), (85, 0.009), (86, 0.004)
) AS r(rating, probability)
WHERE p.name = 'S9 Prime';

-- Season 9 Elite (from CSV: 77-84 ratings)
INSERT INTO pack_rating_odds (pack_id, rating, probability) 
SELECT p.id, r.rating, r.probability
FROM packs p
CROSS JOIN (VALUES 
  (77, 0.050), (78, 0.096), (79, 0.158), (80, 0.230), (81, 0.198), (82, 0.125), (83, 0.062), (84, 0.032), (85, 0.022), (86, 0.013), (87, 0.008), (88, 0.004), (89, 0.002)
) AS r(rating, probability)
WHERE p.name = 'S9 Elite';

-- Season 10 Basic (from CSV: 76-81 ratings)
INSERT INTO pack_rating_odds (pack_id, rating, probability) 
SELECT p.id, r.rating, r.probability
FROM packs p
CROSS JOIN (VALUES 
  (76, 0.022), (77, 0.050), (78, 0.096), (79, 0.158), (80, 0.241), (81, 0.211), (82, 0.126), (83, 0.063), (84, 0.033)
) AS r(rating, probability)
WHERE p.name = 'S10 Basic';

-- Season 10 Prime (from CSV: 78-84 ratings)
INSERT INTO pack_rating_odds (pack_id, rating, probability) 
SELECT p.id, r.rating, r.probability
FROM packs p
CROSS JOIN (VALUES 
  (78, 0.050), (79, 0.096), (80, 0.158), (81, 0.230), (82, 0.207), (83, 0.126), (84, 0.063), (85, 0.033), (86, 0.022), (87, 0.009), (88, 0.004), (89, 0.002)
) AS r(rating, probability)
WHERE p.name = 'S10 Prime';

-- Season 10 Elite (from CSV: 80-89 ratings)
INSERT INTO pack_rating_odds (pack_id, rating, probability) 
SELECT p.id, r.rating, r.probability
FROM packs p
CROSS JOIN (VALUES 
  (80, 0.050), (81, 0.096), (82, 0.158), (83, 0.230), (84, 0.197), (85, 0.125), (86, 0.062), (87, 0.032), (88, 0.022), (89, 0.013), (90, 0.008), (91, 0.004), (92, 0.002), (93, 0.001)
) AS r(rating, probability)
WHERE p.name = 'S10 Elite';

-- Now populate the remaining seasons (1, 2) with balanced odds for early game
-- Season 1 Basic (balanced for early game)
INSERT INTO pack_rating_odds (pack_id, rating, probability) 
SELECT p.id, r.rating, r.probability
FROM packs p
CROSS JOIN (VALUES 
  (60, 0.080), (61, 0.150), (62, 0.250), (63, 0.300), (64, 0.150), (65, 0.050), (66, 0.020)
) AS r(rating, probability)
WHERE p.name = 'S1 Basic';

-- Season 1 Prime (slight improvement)
INSERT INTO pack_rating_odds (pack_id, rating, probability) 
SELECT p.id, r.rating, r.probability
FROM packs p
CROSS JOIN (VALUES 
  (61, 0.050), (62, 0.120), (63, 0.220), (64, 0.280), (65, 0.180), (66, 0.100), (67, 0.030), (68, 0.020)
) AS r(rating, probability)
WHERE p.name = 'S1 Prime';

-- Season 1 Elite (best early odds)
INSERT INTO pack_rating_odds (pack_id, rating, probability) 
SELECT p.id, r.rating, r.probability
FROM packs p
CROSS JOIN (VALUES 
  (62, 0.080), (63, 0.150), (64, 0.220), (65, 0.250), (66, 0.150), (67, 0.080), (68, 0.040), (69, 0.020), (70, 0.010)
) AS r(rating, probability)
WHERE p.name = 'S1 Elite';

-- Season 2 Basic (slight improvement over S1)
INSERT INTO pack_rating_odds (pack_id, rating, probability) 
SELECT p.id, r.rating, r.probability
FROM packs p
CROSS JOIN (VALUES 
  (60, 0.060), (61, 0.120), (62, 0.200), (63, 0.320), (64, 0.180), (65, 0.070), (66, 0.030), (67, 0.020)
) AS r(rating, probability)
WHERE p.name = 'S2 Basic';

-- Season 2 Prime (slight improvement over S1)
INSERT INTO pack_rating_odds (pack_id, rating, probability) 
SELECT p.id, r.rating, r.probability
FROM packs p
CROSS JOIN (VALUES 
  (61, 0.040), (62, 0.100), (63, 0.200), (64, 0.300), (65, 0.170), (66, 0.100), (67, 0.050), (68, 0.030), (69, 0.010)
) AS r(rating, probability)
WHERE p.name = 'S2 Prime';

-- Season 2 Elite (slight improvement over S1)
INSERT INTO pack_rating_odds (pack_id, rating, probability) 
SELECT p.id, r.rating, r.probability
FROM packs p
CROSS JOIN (VALUES 
  (62, 0.060), (63, 0.120), (64, 0.180), (65, 0.260), (66, 0.160), (67, 0.080), (68, 0.050), (69, 0.030), (70, 0.015), (71, 0.010), (72, 0.005)
) AS r(rating, probability)
WHERE p.name = 'S2 Elite';

-- Verify all packs have odds
SELECT p.name, p.season, p.pack_type, COUNT(pro.rating) as odds_count
FROM packs p
LEFT JOIN pack_rating_odds pro ON p.id = pro.pack_id
GROUP BY p.id, p.name, p.season, p.pack_type
ORDER BY p.season, p.pack_type;




