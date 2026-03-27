-- Populate pack_rating_odds table with realistic odds for existing packs
-- This will allow the pack opening system to work properly

-- Basic packs (lower ratings, higher probability for lower ratings)
INSERT INTO pack_rating_odds (pack_id, rating, probability) VALUES
-- S1 Basic (pack_id: 31)
(31, 65, 0.4), (31, 66, 0.3), (31, 67, 0.2), (31, 68, 0.1),
-- S2 Basic (pack_id: 34)
(34, 66, 0.4), (34, 67, 0.3), (34, 68, 0.2), (34, 69, 0.1),
-- S3 Basic (pack_id: 37)
(37, 67, 0.4), (37, 68, 0.3), (37, 69, 0.2), (37, 70, 0.1),
-- S4 Basic (pack_id: 40)
(40, 68, 0.4), (40, 69, 0.3), (40, 70, 0.2), (40, 71, 0.1),
-- S5 Basic (pack_id: 43)
(43, 69, 0.4), (43, 70, 0.3), (43, 71, 0.2), (43, 72, 0.1),
-- S6 Basic (pack_id: 46)
(46, 70, 0.4), (46, 71, 0.3), (46, 72, 0.2), (46, 73, 0.1),
-- S7 Basic (pack_id: 49)
(49, 71, 0.4), (49, 72, 0.3), (49, 73, 0.2), (49, 74, 0.1),
-- S8 Basic (pack_id: 52)
(52, 72, 0.4), (52, 73, 0.3), (52, 74, 0.2), (52, 75, 0.1),
-- S9 Basic (pack_id: 55)
(55, 73, 0.4), (55, 74, 0.3), (55, 75, 0.2), (55, 76, 0.1),
-- S10 Basic (pack_id: 58)
(58, 74, 0.4), (58, 75, 0.3), (58, 76, 0.2), (58, 77, 0.1);

-- Prime packs (medium ratings, balanced distribution)
INSERT INTO pack_rating_odds (pack_id, rating, probability) VALUES
-- S1 Prime (pack_id: 32)
(32, 70, 0.3), (32, 71, 0.3), (32, 72, 0.25), (32, 73, 0.15),
-- S2 Prime (pack_id: 35)
(35, 71, 0.3), (35, 72, 0.3), (35, 73, 0.25), (35, 74, 0.15),
-- S3 Prime (pack_id: 38)
(38, 72, 0.3), (38, 73, 0.3), (38, 74, 0.25), (38, 75, 0.15),
-- S4 Prime (pack_id: 41)
(41, 73, 0.3), (41, 74, 0.3), (41, 75, 0.25), (41, 76, 0.15),
-- S5 Prime (pack_id: 44)
(44, 74, 0.3), (44, 75, 0.3), (44, 76, 0.25), (44, 77, 0.15),
-- S6 Prime (pack_id: 47)
(47, 75, 0.3), (47, 76, 0.3), (47, 77, 0.25), (47, 78, 0.15),
-- S7 Prime (pack_id: 50)
(50, 76, 0.3), (50, 77, 0.3), (50, 78, 0.25), (50, 79, 0.15),
-- S8 Prime (pack_id: 53)
(53, 77, 0.3), (53, 78, 0.3), (53, 79, 0.25), (53, 80, 0.15),
-- S9 Prime (pack_id: 56)
(56, 78, 0.3), (56, 79, 0.3), (56, 80, 0.25), (56, 81, 0.15),
-- S10 Prime (pack_id: 59)
(59, 79, 0.3), (59, 80, 0.3), (59, 81, 0.25), (59, 82, 0.15);

-- Elite packs (higher ratings, higher probability for higher ratings)
INSERT INTO pack_rating_odds (pack_id, rating, probability) VALUES
-- S1 Elite (pack_id: 33)
(33, 75, 0.2), (33, 76, 0.25), (33, 77, 0.3), (33, 78, 0.25),
-- S2 Elite (pack_id: 36)
(36, 76, 0.2), (36, 77, 0.25), (36, 78, 0.3), (36, 79, 0.25),
-- S3 Elite (pack_id: 39)
(39, 77, 0.2), (39, 78, 0.25), (39, 79, 0.3), (39, 80, 0.25),
-- S4 Elite (pack_id: 42)
(42, 78, 0.2), (42, 79, 0.25), (42, 80, 0.3), (42, 81, 0.25),
-- S5 Elite (pack_id: 45)
(45, 79, 0.2), (45, 80, 0.25), (45, 81, 0.3), (45, 82, 0.25),
-- S6 Elite (pack_id: 48)
(48, 80, 0.2), (48, 81, 0.25), (48, 82, 0.3), (48, 83, 0.25),
-- S7 Elite (pack_id: 51)
(51, 81, 0.2), (51, 82, 0.25), (51, 83, 0.3), (51, 84, 0.25),
-- S8 Elite (pack_id: 54)
(54, 82, 0.2), (54, 83, 0.25), (54, 84, 0.3), (54, 85, 0.25),
-- S9 Elite (pack_id: 57)
(57, 83, 0.2), (57, 84, 0.25), (57, 85, 0.3), (57, 86, 0.25),
-- S10 Elite (pack_id: 60)
(60, 84, 0.2), (60, 85, 0.25), (60, 86, 0.3), (60, 87, 0.25);

-- Verify the data was inserted
SELECT pack_id, rating, probability FROM pack_rating_odds ORDER BY pack_id, rating;






