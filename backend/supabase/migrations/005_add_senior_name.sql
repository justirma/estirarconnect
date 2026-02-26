-- Add name column to seniors table
ALTER TABLE seniors ADD COLUMN IF NOT EXISTS name TEXT;
