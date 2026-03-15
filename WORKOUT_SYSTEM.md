# Workout Image System — Architecture Map

## How It Works (Senior's Experience)

```
SUNDAY 9 AM EST
    │
    ▼
┌──────────────────────────────────┐
│  Senior receives WhatsApp image  │
│  with 3 exercises + caption:     │
│                                  │
│  ┌────────────────────────────┐  │
│  │  [Workout Image: 3 moves] │  │
│  │   🏋️ Balance Basics        │  │
│  │   1. Seated Heel Raises   │  │
│  │   2. Toe Taps             │  │
│  │   3. Ankle Circles        │  │
│  └────────────────────────────┘  │
│  "Complete at your own pace.     │
│   Reply *Done* when finished."   │
└──────────────────────────────────┘
    │
    │  Mon-Sat: reminders if not done
    │
    ▼
┌──────────────────┐     ┌──────────────────┐
│ Senior replies    │────▶│ Bot responds:    │
│ "Done" / "Listo"  │     │ "Great job! 💪   │
│                   │     │  Streak: 3 weeks │
│                   │     │  See you Sunday!" │
└──────────────────┘     └──────────────────┘
```

## Monthly Program Structure

```
YEAR 2026
├── April: Balance 🧘
│   ├── Week 1: Balance Basics      (EN + ES images)
│   ├── Week 2: Steady & Strong     (EN + ES images)
│   ├── Week 3: Core & Stability    (EN + ES images)
│   └── Week 4: Balance Challenge   (EN + ES images)
│
├── May: Flexibility 🤸
│   ├── Week 1: ...
│   ├── Week 2: ...
│   ├── Week 3: ...
│   └── Week 4: ...
│
├── June: Strength 💪
│   └── ...
│
└── ... (planned month by month)
```

## Your Workflow (Admin)

```
1. DESIGN                2. ORGANIZE              3. UPLOAD              4. ACTIVATE
┌──────────────┐    ┌──────────────────┐    ┌────────────────┐    ┌──────────────────┐
│ Sister takes │    │ Save to Google   │    │ Upload to      │    │ Add row in       │
│ exercise     │───▶│ Drive folder:    │───▶│ Supabase       │───▶│ Supabase         │
│ photos       │    │ /2026-04/        │    │ Storage bucket │    │ workouts table   │
│              │    │   week1-en.jpg   │    │ workout-images/│    │ (title, url,     │
│ Design in    │    │   week1-es.jpg   │    │                │    │  theme, month,   │
│ Canva (3     │    │   week2-en.jpg   │    │                │    │  week, language)  │
│ exercises    │    │   ...            │    │                │    │                  │
│ per image)   │    │                  │    │                │    │                  │
└──────────────┘    └──────────────────┘    └────────────────┘    └──────────────────┘
```

## System Architecture

```
                    ┌─────────────────────────────────┐
                    │         Vercel Cron              │
                    │    (daily at 14:00 UTC)          │
                    └──────────┬──────────────────────┘
                               │
                    ┌──────────▼──────────────────────┐
                    │     messageController.js         │
                    │                                  │
                    │  Sunday?─── YES ──▶ sendSundayWorkouts()
                    │     │              │ Get workout for this week
                    │     NO             │ Send image via WhatsApp
                    │     │              │ Log as 'workout' type
                    │     ▼              │
                    │  sendWorkoutReminders()          │
                    │  │ Check if completed this week  │
                    │  │ If not → send text reminder   │
                    │  │ If yes → skip                 │
                    └──────────────────────────────────┘
                               │
         ┌─────────────────────┼──────────────────────┐
         │                     │                      │
         ▼                     ▼                      ▼
┌─────────────────┐  ┌─────────────────┐   ┌──────────────────┐
│  WhatsApp API   │  │    Supabase     │   │ Supabase Storage │
│  (Cloud API)    │  │   (Postgres)    │   │ (Image hosting)  │
│                 │  │                 │   │                  │
│ • Send image    │  │ • workouts      │   │ workout-images/  │
│ • Send text     │  │ • logs          │   │  2026-04/        │
│ • Receive reply │  │ • seniors       │   │    en/week1.jpg  │
│                 │  │ • videos (old)  │   │    es/week1.jpg  │
└─────────────────┘  └─────────────────┘   └──────────────────┘

                    ┌─────────────────────────────────┐
                    │     webhookController.js         │
                    │                                  │
                    │  Incoming WhatsApp message       │
                    │     │                            │
                    │     ▼                            │
                    │  "done"/"listo"? ──▶ Mark complete
                    │  "stop"?        ──▶ Deactivate   │
                    │  "start"?       ──▶ Reactivate   │
                    │  "help"?        ──▶ Send info    │
                    │  other?         ──▶ Nudge reply  │
                    └─────────────────────────────────┘
```

## Database Schema (New)

```
workouts                              logs (updated)
┌───────────────────────┐            ┌───────────────────────┐
│ id          UUID PK   │            │ id          UUID PK   │
│ title       VARCHAR   │◀───────────│ workout_id  UUID FK   │  (new)
│ description TEXT      │            │ video_id    UUID FK   │  (nullable now)
│ image_url   VARCHAR   │            │ senior_id   UUID FK   │
│ theme       VARCHAR   │            │ type        VARCHAR   │  (+ 'workout', 'workout_reminder')
│ language    VARCHAR   │            │ status      VARCHAR   │
│ month       INTEGER   │            │ completed   BOOLEAN   │
│ year        INTEGER   │            │ sent_at     TIMESTAMP │
│ week_number INTEGER   │            │ reply_text  TEXT      │
│ sequence_order INT    │            │ replied_at  TIMESTAMP │
│ active      BOOLEAN   │            └───────────────────────┘
│ created_at  TIMESTAMP │
└───────────────────────┘
```

## Feature Flag

Toggle between old (YouTube) and new (image) systems:

```
# In .env / Vercel environment:
USE_WORKOUT_IMAGES=false    ← current (YouTube videos)
USE_WORKOUT_IMAGES=true     ← new (workout images)
```

Both systems coexist. Flip the flag when you're ready. No downtime, no data loss.

## Supabase Storage Setup

1. Go to Supabase Dashboard → Storage
2. Create bucket: `workout-images`
3. Set to **Public** (images need public URLs for WhatsApp)
4. Upload images with this folder structure:
   ```
   workout-images/
   ├── 2026-04/
   │   ├── en/
   │   │   ├── week1-balance-basics.jpg
   │   │   ├── week2-steady-strong.jpg
   │   │   ├── week3-core-stability.jpg
   │   │   └── week4-balance-challenge.jpg
   │   └── es/
   │       ├── week1-equilibrio-basico.jpg
   │       ├── week2-firme-fuerte.jpg
   │       ├── week3-centro-estabilidad.jpg
   │       └── week4-desafio-equilibrio.jpg
   └── 2026-05/
       └── ...
   ```
5. Copy the public URL for each image into the `workouts` table

## Deployment Checklist

- [ ] Run migration `006_add_workouts_table.sql` in Supabase SQL Editor
- [ ] Create `workout-images` bucket in Supabase Storage (set public)
- [ ] Upload first month's images
- [ ] Add workout rows to `workouts` table via Supabase Table Editor
- [ ] Add `USE_WORKOUT_IMAGES=true` to Vercel environment variables
- [ ] Deploy to Vercel
- [ ] Send test message to verify image delivery
- [ ] Monitor first Sunday send
