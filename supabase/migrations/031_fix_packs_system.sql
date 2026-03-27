-- Fix Packs System - Migration 031
-- This migration fixes the packs table structure and ensures the pack rating odds system works correctly

-- First, let's check if we need to recreate the packs table with the correct structure
-- The current packs table might have the wrong column types

-- Drop existing packs table if it has wrong structure
DROP TABLE IF EXISTS pack_purchases CASCADE;
DROP TABLE IF EXISTS pack_rating_odds CASCADE;
DROP TABLE IF EXISTS packs CASCADE;

-- Recreate packs table with correct structure
CREATE TABLE IF NOT EXISTS packs (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  player_count INTEGER NOT NULL DEFAULT 3,
  season INTEGER NOT NULL DEFAULT 1,
  pack_type TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create pack_rating_odds table if it doesn't exist
CREATE TABLE IF NOT EXISTS pack_rating_odds (
  id SERIAL PRIMARY KEY,
  pack_id INTEGER REFERENCES packs(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL,
  probability DECIMAL(5,4) NOT NULL DEFAULT 0.0000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(pack_id, rating)
);

-- Create pack_purchases table with correct structure
CREATE TABLE IF NOT EXISTS pack_purchases (
  id SERIAL PRIMARY KEY,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  pack_id INTEGER REFERENCES packs(id) ON DELETE CASCADE,
  total_cost INTEGER NOT NULL,
  players_obtained JSONB,
  purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert the correct pack data for all seasons
INSERT INTO packs (name, price, player_count, season, pack_type, description) VALUES
-- Season 1 (balanced, lower ratings to encourage long-term growth)
('S1 Basic', 8000000, 3, 1, 'Basic', 'Basic pack with lower-rated players for Season 1'),
('S1 Prime', 14000000, 3, 1, 'Prime', 'Prime pack with better odds for Season 1'),
('S1 Elite', 20000000, 3, 1, 'Elite', 'Elite pack with best odds for Season 1'),

-- Season 2 (slight improvement)
('S2 Basic', 9000000, 3, 2, 'Basic', 'Basic pack with improved odds for Season 2'),
('S2 Prime', 15250000, 3, 2, 'Prime', 'Prime pack with better odds for Season 2'),
('S2 Elite', 22000000, 3, 2, 'Elite', 'Elite pack with best odds for Season 2'),

-- Season 3 (from CSV data)
('S3 Basic', 10000000, 3, 3, 'Basic', 'Basic pack with decent odds for Season 3'),
('S3 Prime', 16500000, 3, 3, 'Prime', 'Prime pack with better odds for Season 3'),
('S3 Elite', 24000000, 3, 3, 'Elite', 'Elite pack with best odds for Season 3'),

-- Season 4
('S4 Basic', 10000000, 3, 4, 'Basic', 'Basic pack with improved odds for Season 4'),
('S4 Prime', 17500000, 3, 4, 'Prime', 'Prime pack with better odds for Season 4'),
('S4 Elite', 26000000, 3, 4, 'Elite', 'Elite pack with best odds for Season 4'),

-- Season 5
('S5 Basic', 9000000, 3, 5, 'Basic', 'Basic pack with good odds for Season 5'),
('S5 Prime', 18000000, 3, 5, 'Prime', 'Prime pack with better odds for Season 5'),
('S5 Elite', 28000000, 3, 5, 'Elite', 'Elite pack with best odds for Season 5'),

-- Season 6
('S6 Basic', 9000000, 3, 6, 'Basic', 'Basic pack with very good odds for Season 6'),
('S6 Prime', 18000000, 3, 6, 'Prime', 'Prime pack with better odds for Season 6'),
('S6 Elite', 27000000, 3, 6, 'Elite', 'Elite pack with best odds for Season 6'),

-- Season 7
('S7 Basic', 9000000, 3, 7, 'Basic', 'Basic pack with excellent odds for Season 7'),
('S7 Prime', 18000000, 3, 7, 'Prime', 'Prime pack with better odds for Season 7'),
('S7 Elite', 28000000, 3, 7, 'Elite', 'Elite pack with best odds for Season 7'),

-- Season 8
('S8 Basic', 8000000, 3, 8, 'Basic', 'Basic pack with outstanding odds for Season 8'),
('S8 Prime', 17000000, 3, 8, 'Prime', 'Prime pack with better odds for Season 8'),
('S8 Elite', 29000000, 3, 8, 'Elite', 'Elite pack with best odds for Season 8'),

-- Season 9
('S9 Basic', 8000000, 3, 9, 'Basic', 'Basic pack with exceptional odds for Season 9'),
('S9 Prime', 17000000, 3, 9, 'Prime', 'Prime pack with better odds for Season 9'),
('S9 Elite', 29000000, 3, 9, 'Elite', 'Elite pack with best odds for Season 9'),

-- Season 10
('S10 Basic', 8000000, 3, 10, 'Basic', 'Basic pack with legendary odds for Season 10'),
('S10 Prime', 17000000, 3, 10, 'Prime', 'Prime pack with better odds for Season 10'),
('S10 Elite', 29000000, 3, 10, 'Elite', 'Elite pack with best odds for Season 10');

-- Now populate pack_rating_odds with the correct probability data
-- Season 1 Basic (lower ratings, balanced for long-term growth)
INSERT INTO pack_rating_odds (pack_id, rating, probability) 
SELECT p.id, r.rating, r.probability
FROM packs p
CROSS JOIN (VALUES 
  (47, 0.0000), (48, 0.0000), (49, 0.0000), (50, 0.0000), (51, 0.0000), (52, 0.0000), (53, 0.0000), (54, 0.0000), (55, 0.0000), (56, 0.0000),
  (57, 0.0000), (58, 0.0000), (59, 0.0000), (60, 0.0800), (61, 0.1500), (62, 0.2500), (63, 0.3000), (64, 0.1500), (65, 0.0500), (66, 0.0200),
  (67, 0.0000), (68, 0.0000), (69, 0.0000), (70, 0.0000), (71, 0.0000), (72, 0.0000), (73, 0.0000), (74, 0.0000), (75, 0.0000), (76, 0.0000),
  (77, 0.0000), (78, 0.0000), (79, 0.0000), (80, 0.0000), (81, 0.0000), (82, 0.0000), (83, 0.0000), (84, 0.0000), (85, 0.0000), (86, 0.0000),
  (87, 0.0000), (88, 0.0000), (89, 0.0000), (90, 0.0000), (91, 0.0000)
) AS r(rating, probability)
WHERE p.name = 'S1 Basic';

-- Season 1 Prime
INSERT INTO pack_rating_odds (pack_id, rating, probability) 
SELECT p.id, r.rating, r.probability
FROM packs p
CROSS JOIN (VALUES 
  (47, 0.0000), (48, 0.0000), (49, 0.0000), (50, 0.0000), (51, 0.0000), (52, 0.0000), (53, 0.0000), (54, 0.0000), (55, 0.0000), (56, 0.0000),
  (57, 0.0000), (58, 0.0000), (59, 0.0000), (60, 0.0000), (61, 0.0500), (62, 0.1200), (63, 0.2200), (64, 0.2800), (65, 0.1800), (66, 0.1000),
  (67, 0.0300), (68, 0.0200), (69, 0.0000), (70, 0.0000), (71, 0.0000), (72, 0.0000), (73, 0.0000), (74, 0.0000), (75, 0.0000), (76, 0.0000),
  (77, 0.0000), (78, 0.0000), (79, 0.0000), (80, 0.0000), (81, 0.0000), (82, 0.0000), (83, 0.0000), (84, 0.0000), (85, 0.0000), (86, 0.0000),
  (87, 0.0000), (88, 0.0000), (89, 0.0000), (90, 0.0000), (91, 0.0000)
) AS r(rating, probability)
WHERE p.name = 'S1 Prime';

-- Season 1 Elite
INSERT INTO pack_rating_odds (pack_id, rating, probability) 
SELECT p.id, r.rating, r.probability
FROM packs p
CROSS JOIN (VALUES 
  (47, 0.0000), (48, 0.0000), (49, 0.0000), (50, 0.0000), (51, 0.0000), (52, 0.0000), (53, 0.0000), (54, 0.0000), (55, 0.0000), (56, 0.0000),
  (57, 0.0000), (58, 0.0000), (59, 0.0000), (60, 0.0000), (61, 0.0000), (62, 0.0800), (63, 0.1500), (64, 0.2200), (65, 0.2500), (66, 0.1500),
  (67, 0.0800), (68, 0.0400), (69, 0.0200), (70, 0.0100), (71, 0.0000), (72, 0.0000), (73, 0.0000), (74, 0.0000), (75, 0.0000), (76, 0.0000),
  (77, 0.0000), (78, 0.0000), (79, 0.0000), (80, 0.0000), (81, 0.0000), (82, 0.0000), (83, 0.0000), (84, 0.0000), (85, 0.0000), (86, 0.0000),
  (87, 0.0000), (88, 0.0000), (89, 0.0000), (90, 0.0000), (91, 0.0000)
) AS r(rating, probability)
WHERE p.name = 'S1 Elite';

-- Season 3 Basic (from CSV data)
INSERT INTO pack_rating_odds (pack_id, rating, probability) 
SELECT p.id, r.rating, r.probability
FROM packs p
CROSS JOIN (VALUES 
  (47, 0.0000), (48, 0.0000), (49, 0.0000), (50, 0.0000), (51, 0.0000), (52, 0.0000), (53, 0.0000), (54, 0.0000), (55, 0.0000), (56, 0.0000),
  (57, 0.0000), (58, 0.0000), (59, 0.0000), (60, 0.0450), (61, 0.1010), (62, 0.1610), (63, 0.3520), (64, 0.2090), (65, 0.0850), (66, 0.0360),
  (67, 0.0110), (68, 0.0000), (69, 0.0000), (70, 0.0000), (71, 0.0000), (72, 0.0000), (73, 0.0000), (74, 0.0000), (75, 0.0000), (76, 0.0000),
  (77, 0.0000), (78, 0.0000), (79, 0.0000), (80, 0.0000), (81, 0.0000), (82, 0.0000), (83, 0.0000), (84, 0.0000), (85, 0.0000), (86, 0.0000),
  (87, 0.0000), (88, 0.0000), (89, 0.0000), (90, 0.0000), (91, 0.0000)
) AS r(rating, probability)
WHERE p.name = 'S3 Basic';

-- Season 6 Basic (from CSV data)
INSERT INTO pack_rating_odds (pack_id, rating, probability) 
SELECT p.id, r.rating, r.probability
FROM packs p
CROSS JOIN (VALUES 
  (47, 0.0000), (48, 0.0000), (49, 0.0000), (50, 0.0000), (51, 0.0000), (52, 0.0000), (53, 0.0000), (54, 0.0000), (55, 0.0000), (56, 0.0000),
  (57, 0.0000), (58, 0.0000), (59, 0.0000), (60, 0.0000), (61, 0.0000), (62, 0.0000), (63, 0.0000), (64, 0.0000), (65, 0.0000), (66, 0.0000),
  (67, 0.0000), (68, 0.0000), (69, 0.0000), (70, 0.0000), (71, 0.0000), (72, 0.0320), (73, 0.0680), (74, 0.1390), (75, 0.2250), (76, 0.2760),
  (77, 0.1320), (78, 0.0720), (79, 0.0350), (80, 0.0210), (81, 0.0000), (82, 0.0000), (83, 0.0000), (84, 0.0000), (85, 0.0000), (86, 0.0000),
  (87, 0.0000), (88, 0.0000), (89, 0.0000), (90, 0.0000), (91, 0.0000)
) AS r(rating, probability)
WHERE p.name = 'S6 Basic';

-- Season 8 Basic (from CSV data)
INSERT INTO pack_rating_odds (pack_id, rating, probability) 
SELECT p.id, r.rating, r.probability
FROM packs p
CROSS JOIN (VALUES 
  (47, 0.0000), (48, 0.0000), (49, 0.0000), (50, 0.0000), (51, 0.0000), (52, 0.0000), (53, 0.0000), (54, 0.0000), (55, 0.0000), (56, 0.0000),
  (57, 0.0000), (58, 0.0000), (59, 0.0000), (60, 0.0000), (61, 0.0000), (62, 0.0000), (63, 0.0000), (64, 0.0000), (65, 0.0000), (66, 0.0000),
  (67, 0.0000), (68, 0.0000), (69, 0.0000), (70, 0.0000), (71, 0.0000), (72, 0.0220), (73, 0.0500), (74, 0.0960), (75, 0.1580), (76, 0.2410),
  (77, 0.2110), (78, 0.1260), (79, 0.0630), (80, 0.0330), (81, 0.0000), (82, 0.0000), (83, 0.0000), (84, 0.0000), (85, 0.0000), (86, 0.0000),
  (87, 0.0000), (88, 0.0000), (89, 0.0000), (90, 0.0000), (91, 0.0000)
) AS r(rating, probability)
WHERE p.name = 'S8 Basic';

-- Season 10 Elite (from CSV data - best odds)
INSERT INTO pack_rating_odds (pack_id, rating, probability) 
SELECT p.id, r.rating, r.probability
FROM packs p
CROSS JOIN (VALUES 
  (47, 0.0000), (48, 0.0000), (49, 0.0000), (50, 0.0000), (51, 0.0000), (52, 0.0000), (53, 0.0000), (54, 0.0000), (55, 0.0000), (56, 0.0000),
  (57, 0.0000), (58, 0.0000), (59, 0.0000), (60, 0.0000), (61, 0.0000), (62, 0.0000), (63, 0.0000), (64, 0.0000), (65, 0.0000), (66, 0.0000),
  (67, 0.0000), (68, 0.0000), (69, 0.0000), (70, 0.0000), (71, 0.0000), (72, 0.0000), (73, 0.0000), (74, 0.0000), (75, 0.0000), (76, 0.0000),
  (77, 0.0000), (78, 0.0000), (79, 0.0000), (80, 0.0500), (81, 0.0960), (82, 0.1580), (83, 0.2300), (84, 0.1970), (85, 0.1250), (86, 0.0620),
  (87, 0.0320), (88, 0.0220), (89, 0.0130), (90, 0.0080), (91, 0.0040)
) AS r(rating, probability)
WHERE p.name = 'S10 Elite';

-- Create a function to populate remaining pack odds with default values
CREATE OR REPLACE FUNCTION populate_remaining_pack_odds()
RETURNS void AS $$
DECLARE
    pack_record RECORD;
BEGIN
    -- Loop through all packs that don't have odds yet
    FOR pack_record IN 
        SELECT p.id, p.name, p.season, p.pack_type 
        FROM packs p 
        WHERE NOT EXISTS (
            SELECT 1 FROM pack_rating_odds pro WHERE pro.pack_id = p.id
        )
    LOOP
        -- Insert basic odds structure for all ratings
        INSERT INTO pack_rating_odds (pack_id, rating, probability)
        SELECT pack_record.id, generate_series(47, 91), 0.0000;
        
        -- Update with season-appropriate odds based on pack type and season
        UPDATE pack_rating_odds 
        SET probability = CASE 
            WHEN pack_record.pack_type = 'Basic' THEN
                CASE 
                    WHEN pack_record.season <= 3 THEN
                        CASE 
                            WHEN rating BETWEEN 60 AND 70 THEN 0.2000
                            WHEN rating BETWEEN 71 AND 75 THEN 0.1000
                            WHEN rating BETWEEN 76 AND 80 THEN 0.0500
                            ELSE 0.0000
                        END
                    WHEN pack_record.season <= 6 THEN
                        CASE 
                            WHEN rating BETWEEN 65 AND 75 THEN 0.2000
                            WHEN rating BETWEEN 76 AND 80 THEN 0.1000
                            WHEN rating BETWEEN 81 AND 85 THEN 0.0500
                            ELSE 0.0000
                        END
                    ELSE
                        CASE 
                            WHEN rating BETWEEN 70 AND 80 THEN 0.2000
                            WHEN rating BETWEEN 81 AND 85 THEN 0.1000
                            WHEN rating BETWEEN 86 AND 90 THEN 0.0500
                            ELSE 0.0000
                        END
                END
            WHEN pack_record.pack_type = 'Prime' THEN
                CASE 
                    WHEN pack_record.season <= 3 THEN
                        CASE 
                            WHEN rating BETWEEN 65 AND 75 THEN 0.2000
                            WHEN rating BETWEEN 76 AND 80 THEN 0.1000
                            WHEN rating BETWEEN 81 AND 85 THEN 0.0500
                            ELSE 0.0000
                        END
                    WHEN pack_record.season <= 6 THEN
                        CASE 
                            WHEN rating BETWEEN 70 AND 80 THEN 0.2000
                            WHEN rating BETWEEN 81 AND 85 THEN 0.1000
                            WHEN rating BETWEEN 86 AND 90 THEN 0.0500
                            ELSE 0.0000
                        END
                    ELSE
                        CASE 
                            WHEN rating BETWEEN 75 AND 85 THEN 0.2000
                            WHEN rating BETWEEN 86 AND 90 THEN 0.1000
                            WHEN rating BETWEEN 91 AND 95 THEN 0.0500
                            ELSE 0.0000
                        END
                END
            WHEN pack_record.pack_type = 'Elite' THEN
                CASE 
                    WHEN pack_record.season <= 3 THEN
                        CASE 
                            WHEN rating BETWEEN 70 AND 80 THEN 0.2000
                            WHEN rating BETWEEN 81 AND 85 THEN 0.1000
                            WHEN rating BETWEEN 86 AND 90 THEN 0.0500
                            ELSE 0.0000
                        END
                    WHEN pack_record.season <= 6 THEN
                        CASE 
                            WHEN rating BETWEEN 75 AND 85 THEN 0.2000
                            WHEN rating BETWEEN 86 AND 90 THEN 0.1000
                            WHEN rating BETWEEN 91 AND 95 THEN 0.0500
                            ELSE 0.0000
                        END
                    ELSE
                        CASE 
                            WHEN rating BETWEEN 80 AND 90 THEN 0.2000
                            WHEN rating BETWEEN 91 AND 95 THEN 0.1000
                            WHEN rating BETWEEN 96 AND 99 THEN 0.0500
                            ELSE 0.0000
                        END
                END
        END
        WHERE pack_id = pack_record.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute the function to populate remaining odds
SELECT populate_remaining_pack_odds();

-- Clean up
DROP FUNCTION populate_remaining_pack_odds();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_packs_season ON packs(season);
CREATE INDEX IF NOT EXISTS idx_packs_type ON packs(pack_type);
CREATE INDEX IF NOT EXISTS idx_pack_rating_odds_pack_id ON pack_rating_odds(pack_id);
CREATE INDEX IF NOT EXISTS idx_pack_rating_odds_rating ON pack_rating_odds(rating);
CREATE INDEX IF NOT EXISTS idx_pack_purchases_team_id ON pack_purchases(team_id);
CREATE INDEX IF NOT EXISTS idx_pack_purchases_pack_id ON pack_purchases(pack_id);

-- Enable RLS on all tables
ALTER TABLE packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pack_rating_odds ENABLE ROW LEVEL SECURITY;
ALTER TABLE pack_purchases ENABLE ROW LEVEL SECURITY;

-- RLS Policies for packs (anyone can view)
CREATE POLICY "Anyone can view packs" ON packs FOR SELECT USING (true);

-- RLS Policies for pack_rating_odds (anyone can view)
CREATE POLICY "Anyone can view pack rating odds" ON pack_rating_odds FOR SELECT USING (true);

-- RLS Policies for pack_purchases
CREATE POLICY "Users can view their own pack purchases" ON pack_purchases
  FOR SELECT USING (
    team_id IN (SELECT id FROM teams WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create pack purchases for their teams" ON pack_purchases
  FOR INSERT WITH CHECK (
    team_id IN (SELECT id FROM teams WHERE user_id = auth.uid())
  );

-- Create a function to get current season from team
CREATE OR REPLACE FUNCTION get_team_current_season(p_team_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_season INTEGER;
BEGIN
    SELECT l.season INTO v_season
    FROM teams t
    JOIN leagues l ON t.league_id = l.id
    WHERE t.id = p_team_id;
    
    RETURN COALESCE(v_season, 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to get pack odds for a specific season
CREATE OR REPLACE FUNCTION get_pack_odds_for_season(p_pack_type TEXT, p_season INTEGER)
RETURNS TABLE(pack_id INTEGER, rating INTEGER, probability DECIMAL(5,4)) AS $$
BEGIN
    RETURN QUERY
    SELECT pro.pack_id, pro.rating, pro.probability
    FROM pack_rating_odds pro
    JOIN packs p ON pro.pack_id = p.id
    WHERE p.pack_type = p_pack_type 
    AND p.season = p_season
    ORDER BY pro.rating;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;




