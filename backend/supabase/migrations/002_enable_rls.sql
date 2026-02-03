-- Enable Row Level Security on all tables
-- Note: The backend uses SUPABASE_SERVICE_KEY which bypasses RLS
-- These policies protect against unauthorized access via anon key

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "Service role only" ON seniors;
DROP POLICY IF EXISTS "Service role only" ON videos;
DROP POLICY IF EXISTS "Service role only" ON logs;

-- Enable RLS on all tables
ALTER TABLE seniors ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;

-- Policy for seniors: Only service role has access
CREATE POLICY "Service role only" ON seniors
  FOR ALL
  USING (false);

-- Policy for videos: Only service role has access
CREATE POLICY "Service role only" ON videos
  FOR ALL
  USING (false);

-- Policy for logs: Only service role has access
CREATE POLICY "Service role only" ON logs
  FOR ALL
  USING (false);
