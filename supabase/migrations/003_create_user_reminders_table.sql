-- Create user_reminders table
CREATE TABLE IF NOT EXISTS user_reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  type TEXT DEFAULT 'default',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on user_reminders table
ALTER TABLE user_reminders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_reminders table
-- Users can view their own reminders
CREATE POLICY "Users can view own reminders" ON user_reminders
FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own reminders
CREATE POLICY "Users can insert own reminders" ON user_reminders
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own reminders
CREATE POLICY "Users can update own reminders" ON user_reminders
FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own reminders
CREATE POLICY "Users can delete own reminders" ON user_reminders
FOR DELETE USING (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS user_reminders_user_id_idx ON user_reminders(user_id);
CREATE INDEX IF NOT EXISTS user_reminders_created_at_idx ON user_reminders(created_at); 