-- Migration: Add completed column, skipped status, and analytics views
-- Run in Supabase SQL Editor: Dashboard → SQL Editor → paste → Run

-- 1. Add the completed column (code already writes it, but missing from schema)
ALTER TABLE logs ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT NULL;

-- 2. Allow 'skipped' status (used by markIncompleteLogsAsSkipped)
ALTER TABLE logs DROP CONSTRAINT IF EXISTS logs_status_check;
ALTER TABLE logs ADD CONSTRAINT logs_status_check
  CHECK (status IN ('sent', 'delivered', 'read', 'failed', 'skipped'));

-- 3. Indexes for analytics query performance
CREATE INDEX IF NOT EXISTS idx_logs_completed ON logs(completed);
CREATE INDEX IF NOT EXISTS idx_logs_senior_completed ON logs(senior_id, completed);

-- 4. Analytics views (Metabase auto-discovers these as queryable tables)

-- Weekly completion trend: one row per week
CREATE OR REPLACE VIEW weekly_completion_summary AS
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
GROUP BY DATE_TRUNC('week', l.sent_at)::date
ORDER BY week_of DESC;

-- Per-senior lifetime stats
CREATE OR REPLACE VIEW senior_analytics AS
SELECT
  s.id AS senior_id,
  s.phone_number,
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
LEFT JOIN logs l ON l.senior_id = s.id
GROUP BY s.id, s.phone_number, s.language, s.active
ORDER BY completion_rate_pct DESC NULLS LAST;

-- Per-senior, per-week detail for drill-down
CREATE OR REPLACE VIEW senior_weekly_detail AS
SELECT
  s.phone_number,
  s.language,
  DATE_TRUNC('week', l.sent_at)::date AS week_of,
  v.title AS video_title,
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
JOIN videos v ON v.id = l.video_id
ORDER BY l.sent_at DESC;
