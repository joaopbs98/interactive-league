-- Create league_events table
CREATE TABLE IF NOT EXISTS league_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on league_events table
ALTER TABLE league_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for league_events table
-- Users can view events for leagues they participate in
CREATE POLICY "Users can view league events" ON league_events
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM teams 
    WHERE teams.league_id = league_events.league_id 
    AND teams.user_id = auth.uid()
  )
);

-- Users can insert events for leagues they participate in
CREATE POLICY "Users can insert league events" ON league_events
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM teams 
    WHERE teams.league_id = league_events.league_id 
    AND teams.user_id = auth.uid()
  )
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS league_events_league_id_idx ON league_events(league_id);
CREATE INDEX IF NOT EXISTS league_events_created_at_idx ON league_events(created_at);
CREATE INDEX IF NOT EXISTS league_events_event_type_idx ON league_events(event_type); 