-- 104: Add link column to notifications for clickable navigation
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link TEXT;
