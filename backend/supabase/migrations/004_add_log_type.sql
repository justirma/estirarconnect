-- Add type column to distinguish initial video sends from reminder sends
ALTER TABLE logs ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'video' CHECK (type IN ('video', 'reminder'));

-- Backfill all existing rows as 'video' sends
UPDATE logs SET type = 'video' WHERE type IS NULL;
