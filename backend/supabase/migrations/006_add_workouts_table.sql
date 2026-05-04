-- Migration 006: Add workouts table for image-based exercise programs
-- Run in Supabase SQL Editor: Dashboard → SQL Editor → paste → Run

-- 1. Create workouts table
CREATE TABLE workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  image_url VARCHAR(500) NOT NULL,
  theme VARCHAR(100),
  language VARCHAR(10) NOT NULL CHECK (language IN ('en', 'es')),
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL CHECK (year >= 2026),
  week_number INTEGER NOT NULL CHECK (week_number BETWEEN 1 AND 5),
  sequence_order INTEGER NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Indexes
CREATE INDEX idx_workouts_language ON workouts(language);
CREATE INDEX idx_workouts_schedule ON workouts(year, month, week_number, language);
CREATE INDEX idx_workouts_sequence ON workouts(sequence_order);
CREATE INDEX idx_workouts_active ON workouts(active);

-- 3. Unique constraint: one workout per language per week per month
CREATE UNIQUE INDEX idx_workouts_unique_week
  ON workouts(language, year, month, week_number)
  WHERE active = true;

-- 4. Make video_id nullable so new logs can use workout_id instead
ALTER TABLE logs ALTER COLUMN video_id DROP NOT NULL;

-- 5. Add workout_id to logs
ALTER TABLE logs ADD COLUMN workout_id UUID REFERENCES workouts(id) ON DELETE CASCADE;
CREATE INDEX idx_logs_workout_id ON logs(workout_id);

-- 6. Ensure every log references either a video or a workout
ALTER TABLE logs ADD CONSTRAINT logs_needs_video_or_workout
  CHECK ((video_id IS NOT NULL) OR (workout_id IS NOT NULL));

-- 7. Update log type constraint
ALTER TABLE logs DROP CONSTRAINT IF EXISTS logs_type_check;
ALTER TABLE logs ADD CONSTRAINT logs_type_check
  CHECK (type IN ('video', 'reminder', 'workout', 'workout_reminder'));

-- 8. Drop and recreate views (can't add columns with CREATE OR REPLACE)
DROP VIEW IF EXISTS senior_weekly_detail;
DROP VIEW IF EXISTS senior_analytics;
DROP VIEW IF EXISTS weekly_completion_summary;

CREATE VIEW weekly_completion_summary
WITH (security_invoker = true) AS
SELECT
  DATE_TRUNC('week', l.sent_at)::date AS week_of,
  COUNT(*) AS total_sent,
  COUNT(*) FILTER (WHERE l.completed = true) AS total_completed,
  COUNT(*) FILTER (WHERE l.status = 'skipped') AS total_skipped,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE l.completed = true) / NULLIF(COUNT(*), 0),
    1
  ) AS completion_rate_pct
FROM logs l
WHERE l.type IN ('video', 'workout')
GROUP BY DATE_TRUNC('week', l.sent_at)::date
ORDER BY week_of DESC;

CREATE VIEW senior_analytics
WITH (security_invoker = true) AS
SELECT
  s.id AS senior_id,
  s.phone_number,
  s.name,
  s.language,
  s.active,
  COUNT(l.id) AS total_weeks,
  COUNT(l.id) FILTER (WHERE l.completed = true) AS weeks_completed,
  COUNT(l.id) FILTER (WHERE l.status = 'skipped') AS weeks_skipped,
  ROUND(
    100.0 * COUNT(l.id) FILTER (WHERE l.completed = true) / NULLIF(COUNT(l.id), 0),
    1
  ) AS completion_rate_pct,
  MAX(l.replied_at) AS last_reply_at
FROM seniors s
LEFT JOIN logs l ON l.senior_id = s.id AND l.type IN ('video', 'workout')
GROUP BY s.id, s.phone_number, s.name, s.language, s.active
ORDER BY completion_rate_pct DESC NULLS LAST;

CREATE VIEW senior_weekly_detail
WITH (security_invoker = true) AS
SELECT
  s.phone_number,
  s.name,
  s.language,
  DATE_TRUNC('week', l.sent_at)::date AS week_of,
  COALESCE(v.title, w.title) AS content_title,
  COALESCE(w.theme, v.category) AS theme,
  l.type AS content_type,
  l.completed,
  l.status,
  l.reply_text,
  CASE
    WHEN l.completed = true THEN 'completed'
    WHEN l.status = 'skipped' THEN 'skipped'
    WHEN l.status = 'failed' THEN 'failed'
    ELSE 'pending'
  END AS outcome
FROM logs l
JOIN seniors s ON s.id = l.senior_id
LEFT JOIN videos v ON v.id = l.video_id
LEFT JOIN workouts w ON w.id = l.workout_id
ORDER BY l.sent_at DESC;

-- 9. Enable RLS on workouts (backend uses SERVICE_KEY which bypasses RLS)
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only" ON workouts;
CREATE POLICY "Service role only" ON workouts
  FOR ALL
  USING (false);

-- 10. Comments
COMMENT ON TABLE workouts IS 'Stores weekly workout image metadata, organized by monthly themes';
COMMENT ON COLUMN workouts.image_url IS 'Public URL from Supabase Storage for the workout image';
COMMENT ON COLUMN workouts.theme IS 'Monthly theme e.g. Balance, Flexibility, Strength';
COMMENT ON COLUMN workouts.week_number IS 'Week 1-5 within the month';
COMMENT ON COLUMN workouts.sequence_order IS 'Global ordering for cycling through workouts';
