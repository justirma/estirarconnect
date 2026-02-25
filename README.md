# Estirar Connect — WhatsApp Chair Exercise Bot

A system that sends one YouTube chair-exercise video per week to seniors via WhatsApp, with daily reminders until they complete it.

## Features

- Sends weekly chair exercise videos every Sunday via WhatsApp
- Daily reminders (Mon–Sat) until the senior replies "Done"
- Supports English and Spanish
- Cycles through videos sequentially per senior
- Logs all sends, reminders, and replies
- Tracks completion via keyword detection ("done", "fin", "listo", etc.)
- Opt-out via "STOP" reply
- Admin dashboard for monitoring at `/admin`
- Weekly completion streaks

## Stack

- **Backend**: Node.js + Express
- **Database**: Supabase (PostgreSQL) with RLS enabled
- **Messaging**: WhatsApp Cloud API (Meta)
- **Deployment**: Vercel (serverless + Cron)

## Weekly Flow

```
Sunday         → Send video (WhatsApp approved template)
Mon–Sat        → Send reminder if not yet completed (approved template)
Any day        → Senior replies "Done" → marked complete, reminders stop
Next Sunday    → Incomplete logs marked 'skipped'; next video sent
```

## Project Structure

```
estirarconnect/
├── README.md
├── SETUP.md
├── PROJECT_STRUCTURE.md
├── backend/
│   ├── package.json
│   ├── vercel.json               # Vercel cron: daily at 14:00 UTC (9 AM EST)
│   ├── .env.example
│   ├── src/
│   │   ├── index.js              # Express server + Vercel cron endpoint
│   │   ├── config/
│   │   │   └── supabase.js
│   │   ├── controllers/
│   │   │   ├── adminController.js
│   │   │   ├── messageController.js
│   │   │   └── webhookController.js
│   │   ├── routes/
│   │   │   ├── admin.js
│   │   │   ├── messages.js
│   │   │   └── webhook.js
│   │   ├── services/
│   │   │   ├── database.js
│   │   │   └── whatsapp.js
│   │   ├── scripts/
│   │   │   ├── add_senior.js
│   │   │   ├── seed.js
│   │   │   └── test_whatsapp.js
│   │   └── utils/
│   │       └── logger.js
│   └── supabase/migrations/
│       ├── 001_initial_schema.sql
│       ├── 002_enable_rls.sql
│       ├── 003_add_completed_and_analytics.sql
│       └── 004_add_log_type.sql
└── frontend/ (not yet implemented)
```

## Setup Instructions

### 1. Supabase Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Run all migrations in order from `backend/supabase/migrations/`
3. Get your project URL and service key from Settings > API

### 2. WhatsApp Cloud API Setup

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Create a new app and add the WhatsApp product
3. Get your Phone Number ID and Access Token
4. Create and get Meta approval for two message templates per language:
   - **Video template** (`WHATSAPP_TEMPLATE_NAME_EN/ES`): sends the weekly video
   - **Reminder template** (`WHATSAPP_REMINDER_TEMPLATE_NAME_EN/ES`): Mon–Sat nudge

### 3. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id
WHATSAPP_ACCESS_TOKEN=your-access-token
WHATSAPP_VERIFY_TOKEN=your-custom-verify-token
WHATSAPP_BUSINESS_ACCOUNT_ID=your-business-account-id

WHATSAPP_TEMPLATE_NAME_EN=daily_exercise_update
WHATSAPP_TEMPLATE_NAME_ES=actualizacion_sesion_diaria
WHATSAPP_REMINDER_TEMPLATE_NAME_EN=weekly_exercise_reminder
WHATSAPP_REMINDER_TEMPLATE_NAME_ES=sesion_ejercicio_semanal

CRON_SECRET=your-random-secret-here

PORT=3000
NODE_ENV=development

SEND_TIME_HOUR=9
SEND_TIME_TIMEZONE=America/New_York
```

### 4. Seed the Database

```bash
npm run seed
```

Adds 12 chair exercise videos (6 English, 6 Spanish) and 2 test seniors.

### 5. Run the Server

```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

### 6. Setup WhatsApp Webhook

1. Start your server (use ngrok for local testing):
   ```bash
   ngrok http 3000
   ```

2. In Meta Developer Console > WhatsApp > Configuration:
   - Callback URL: `https://your-domain.com/webhook`
   - Verify Token: (same as `WHATSAPP_VERIFY_TOKEN`)
   - Subscribe to: `messages` webhook field

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | None | Health check |
| GET | `/api/cron/daily-messages` | Bearer CRON_SECRET | Vercel cron trigger (Sunday: video, Mon–Sat: reminder) |
| POST | `/messages/send` | Bearer CRON_SECRET | Manual trigger |
| POST | `/messages/send-test` | Bearer CRON_SECRET | Send test message |
| GET | `/webhook` | None | WhatsApp webhook verification |
| POST | `/webhook` | None | Receive incoming WhatsApp messages |
| GET | `/admin` | None (login via UI) | Admin dashboard |
| GET | `/admin/api/logs` | Bearer CRON_SECRET | Recent logs (JSON) |
| POST | `/admin/api/process-reply` | Bearer CRON_SECRET | Simulate a reply (dev/testing) |

## Database Schema

### seniors
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| phone_number | VARCHAR(20) | Unique, E.164 format (+13055629885) |
| language | VARCHAR(10) | 'en' or 'es' |
| active | BOOLEAN | false = opted out or deactivated |
| created_at | TIMESTAMP | |

### videos
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| title | VARCHAR(255) | |
| youtube_url | VARCHAR(255) | Unique |
| category | VARCHAR(100) | |
| language | VARCHAR(10) | 'en' or 'es' |
| sequence_order | INTEGER | Cycles per language (1→N→1) |
| created_at | TIMESTAMP | |

### logs
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| senior_id | UUID | FK → seniors |
| video_id | UUID | FK → videos |
| sent_at | TIMESTAMP | |
| status | VARCHAR(50) | 'sent', 'delivered', 'read', 'failed', 'skipped' |
| type | VARCHAR(20) | 'video' or 'reminder' |
| reply_text | TEXT | |
| replied_at | TIMESTAMP | |
| completed | BOOLEAN | true when senior confirmed completion |
| created_at | TIMESTAMP | |

### Analytics Views (read-only)
- `weekly_completion_summary` — completion % by week
- `senior_analytics` — lifetime stats per senior
- `senior_weekly_detail` — per-senior, per-week drill-down

## How Completion Works

Reply keywords that mark a week as complete (substring match):

**English**: done, complete, completed, finished
**Spanish**: fin, listo, lista, hecho, terminé, termine, lo hice

Seniors reply "STOP" to opt out. This sets `active = false` and stops all future messages.

## Video Cycling

Each senior has their own progress. Videos cycle in sequence_order per language:

```
Senior A (EN): Video 1 → 2 → 3 → 4 → 5 → 6 → 1 → ...
Senior B (ES): Video 1 → 2 → 3 → 4 → 5 → 6 → 1 → ...
```

Both lists cycle independently. You can add more videos with any sequence_order ≥ 1.

## Adding New Seniors

```sql
INSERT INTO seniors (phone_number, language)
VALUES ('+1234567890', 'en');
```

Or use the script: `node backend/src/scripts/add_senior.js`

## Adding New Videos

```sql
INSERT INTO videos (title, youtube_url, category, language, sequence_order)
VALUES (
  'Your Video Title',
  'https://youtube.com/watch?v=xxx',
  'chair_exercise',
  'en',   -- or 'es'
  7       -- next number after your current highest sequence_order for that language
);
```

Add English and Spanish videos independently — each language has its own sequence.

## Deployment to Vercel

```bash
npm i -g vercel
cd backend
vercel
```

Add all environment variables in the Vercel dashboard, then update the WhatsApp webhook URL to your Vercel deployment URL.

## Monitoring

Admin dashboard: `https://your-domain.vercel.app/admin`
Enter your `CRON_SECRET` when prompted.

Also check:
- Supabase logs table (raw data)
- WhatsApp Cloud API logs in Meta Business Manager
- Vercel function logs for cron execution

## License

MIT
