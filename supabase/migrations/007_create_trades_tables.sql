-- Create trades table
CREATE TABLE IF NOT EXISTS trades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  to_team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  responded_at TIMESTAMP WITH TIME ZONE
);

-- Create trade_items table (player_id is TEXT to match player.player_id)
CREATE TABLE IF NOT EXISTS trade_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trade_id UUID REFERENCES trades(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('player', 'money', 'objective')),
  player_id TEXT REFERENCES player(player_id),
  amount INTEGER,
  objective_id UUID
);

-- Create auctions table
CREATE TABLE IF NOT EXISTS auctions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id TEXT REFERENCES player(player_id) ON DELETE CASCADE,
  starting_bid INTEGER NOT NULL,
  current_bid INTEGER,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'finished')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create bids table
CREATE TABLE IF NOT EXISTS bids (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auction_id UUID REFERENCES auctions(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create packs table (SERIAL pk so later migrations & pack_purchases work)
CREATE TABLE IF NOT EXISTS packs (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  player_count INTEGER NOT NULL DEFAULT 3,
  season INTEGER NOT NULL DEFAULT 1,
  pack_type TEXT NOT NULL DEFAULT 'Basic',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create pack_rating_odds table (referenced by 009+, rebuilt in 031)
CREATE TABLE IF NOT EXISTS pack_rating_odds (
  id SERIAL PRIMARY KEY,
  pack_id INTEGER REFERENCES packs(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL,
  probability DECIMAL(5,4) NOT NULL DEFAULT 0.0000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(pack_id, rating)
);

-- Create pack_purchases table (pack_id INTEGER to match packs.id)
CREATE TABLE IF NOT EXISTS pack_purchases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  pack_id INTEGER REFERENCES packs(id) ON DELETE CASCADE,
  price INTEGER NOT NULL DEFAULT 0,
  total_cost INTEGER NOT NULL DEFAULT 0,
  players_obtained JSONB,
  purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create team_squad table (player_id TEXT to match player.player_id)
CREATE TABLE IF NOT EXISTS team_squad (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  player_id TEXT REFERENCES player(player_id) ON DELETE CASCADE,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(team_id, player_id)
);

-- Insert default packs
INSERT INTO packs (name, price, player_count, season, pack_type, description) VALUES
  ('Basic Pack', 9000000, 5, 1, 'Basic', 'Contains 5 players with ratings 60-70'),
  ('Prime Pack', 18500000, 5, 1, 'Prime', 'Contains 5 players with ratings 65-75'),
  ('Elite Pack', 28000000, 5, 1, 'Elite', 'Contains 5 players with ratings 70-80')
ON CONFLICT DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_trades_from_team ON trades(from_team_id);
CREATE INDEX IF NOT EXISTS idx_trades_to_team ON trades(to_team_id);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_trade_items_trade_id ON trade_items(trade_id);
CREATE INDEX IF NOT EXISTS idx_auctions_status ON auctions(status);
CREATE INDEX IF NOT EXISTS idx_auctions_end_time ON auctions(end_time);
CREATE INDEX IF NOT EXISTS idx_bids_auction_id ON bids(auction_id);
CREATE INDEX IF NOT EXISTS idx_bids_team_id ON bids(team_id);
CREATE INDEX IF NOT EXISTS idx_pack_purchases_team_id ON pack_purchases(team_id);
CREATE INDEX IF NOT EXISTS idx_team_squad_team_id ON team_squad(team_id);

-- Enable RLS on all tables
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pack_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_squad ENABLE ROW LEVEL SECURITY;

-- RLS Policies for trades
CREATE POLICY "Users can view trades involving their teams" ON trades
  FOR SELECT USING (
    from_team_id IN (SELECT id FROM teams WHERE user_id = auth.uid()) OR
    to_team_id IN (SELECT id FROM teams WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create trades from their teams" ON trades
  FOR INSERT WITH CHECK (
    from_team_id IN (SELECT id FROM teams WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update trades they received" ON trades
  FOR UPDATE USING (
    to_team_id IN (SELECT id FROM teams WHERE user_id = auth.uid())
  );

-- RLS Policies for trade_items
CREATE POLICY "Users can view trade items for their trades" ON trade_items
  FOR SELECT USING (
    trade_id IN (
      SELECT id FROM trades 
      WHERE from_team_id IN (SELECT id FROM teams WHERE user_id = auth.uid()) OR
            to_team_id IN (SELECT id FROM teams WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can create trade items for their trades" ON trade_items
  FOR INSERT WITH CHECK (
    trade_id IN (
      SELECT id FROM trades 
      WHERE from_team_id IN (SELECT id FROM teams WHERE user_id = auth.uid())
    )
  );

-- RLS Policies for auctions
CREATE POLICY "Anyone can view active auctions" ON auctions
  FOR SELECT USING (true);

CREATE POLICY "Users can create auctions for their players" ON auctions
  FOR INSERT WITH CHECK (
    player_id IN (
      SELECT p.player_id FROM player p
      JOIN contracts c ON p.player_id = c.player_id
      JOIN teams t ON c.team_id = t.id
      WHERE t.user_id = auth.uid()
    )
  );

-- RLS Policies for bids
CREATE POLICY "Anyone can view bids" ON bids
  FOR SELECT USING (true);

CREATE POLICY "Users can create bids for their teams" ON bids
  FOR INSERT WITH CHECK (
    team_id IN (SELECT id FROM teams WHERE user_id = auth.uid())
  );

-- RLS Policies for packs
CREATE POLICY "Anyone can view packs" ON packs
  FOR SELECT USING (true);

-- RLS Policies for pack_purchases
CREATE POLICY "Users can view their pack purchases" ON pack_purchases
  FOR SELECT USING (
    team_id IN (SELECT id FROM teams WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create pack purchases for their teams" ON pack_purchases
  FOR INSERT WITH CHECK (
    team_id IN (SELECT id FROM teams WHERE user_id = auth.uid())
  );

-- RLS Policies for team_squad
CREATE POLICY "Users can view their team squad" ON team_squad
  FOR SELECT USING (
    team_id IN (SELECT id FROM teams WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can manage their team squad" ON team_squad
  FOR ALL USING (
    team_id IN (SELECT id FROM teams WHERE user_id = auth.uid())
  );
