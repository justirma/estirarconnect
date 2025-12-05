# Quick Setup Guide

## Step-by-Step Setup

### 1. Supabase Database Setup

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click "New Project"
3. Fill in project details and wait for database to provision (~2 minutes)
4. Go to SQL Editor (left sidebar)
5. Copy the contents of `backend/supabase/migrations/001_initial_schema.sql`
6. Paste into SQL Editor and click "Run"
7. **Verify tables were created**: You should see "Success. No rows returned" message. The tables `seniors`, `videos`, and `logs` are now created.
8. Go to Settings > API (in left sidebar) and copy these values (you'll paste them in Step 4):
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon public key** (long string starting with `eyJhbGci...`)
   - **service_role key** (click "Reveal" button first, then copy the long string)

### 2. WhatsApp Cloud API Setup

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Click "My Apps" > "Create App"
3. Choose "Business" type
4. Fill in app details
5. In app dashboard, click "Add Product" > "WhatsApp"
6. Follow setup wizard:
   - Add a phone number (or use test number provided)
   - Get your Phone Number ID (save this)
   - Generate Access Token (save this - make it permanent later)
   - Create a Verify Token (make up any random string like "myverifytoken123")
7. Add a test recipient number in the test numbers section

### 3. Install Backend Dependencies

```bash
cd backend
npm install
```

### 4. Configure Environment Variables

```bash
cp .env.example .env
```

Open the `.env` file and **paste the values you copied from Step 1 and Step 2**:

```env
# Paste these from Supabase (Step 1.8)
SUPABASE_URL=https://xxxxx.supabase.co         # ← Paste Project URL here
SUPABASE_ANON_KEY=eyJhbGci...                  # ← Paste anon public key here
SUPABASE_SERVICE_KEY=eyJhbGci...               # ← Paste service_role key here

# Paste these from WhatsApp (Step 2.6)
WHATSAPP_PHONE_NUMBER_ID=123456789012345       # ← Paste Phone Number ID here
WHATSAPP_ACCESS_TOKEN=EAABsbCS...              # ← Paste Access Token here
WHATSAPP_VERIFY_TOKEN=myverifytoken123         # ← Create your own (any random string)
WHATSAPP_BUSINESS_ACCOUNT_ID=123456789012345   # ← Paste Business Account ID here

# Server settings (keep these as-is)
PORT=3000
NODE_ENV=development
SEND_TIME_HOUR=9
SEND_TIME_TIMEZONE=America/New_York
```

### 5. Seed Database with Videos

```bash
npm run seed
```

Expected output:
```
Starting video seed...
Successfully seeded 12 videos!
Videos by language:
- English: 6
- Spanish: 6

Seeding test seniors...
Successfully seeded 2 test seniors!

✅ Seed complete!
```

### 6. Test Locally

Start the server:
```bash
npm run dev
```

Test the health endpoint:
```bash
curl http://localhost:3000
```

Expected response:
```json
{
  "status": "ok",
  "service": "Estirar Connect - WhatsApp Chair Exercise Bot",
  "version": "1.0.0"
}
```

### 7. Setup Webhook (For Local Testing)

Install ngrok:
```bash
# macOS
brew install ngrok

# Or download from ngrok.com
```

Start ngrok:
```bash
ngrok http 3000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

In Meta Developers Console:
1. Go to WhatsApp > Configuration
2. Click "Edit" on Webhook
3. Callback URL: `https://abc123.ngrok.io/webhook`
4. Verify Token: (same as your WHATSAPP_VERIFY_TOKEN)
5. Click "Verify and Save"
6. Subscribe to `messages` webhook field

### 8. Test Message Sending

Add a real senior (replace with your WhatsApp number):
```sql
-- Run in Supabase SQL Editor
INSERT INTO seniors (phone_number, language, active)
VALUES ('+1234567890', 'en', true);
```

Trigger a manual send:
```bash
curl -X POST http://localhost:3000/messages/send
```

Check your WhatsApp - you should receive a message!

### 9. Test Reply Logging

Reply "DONE" to the message you received.

Check logs in Supabase:
```sql
SELECT * FROM logs ORDER BY sent_at DESC LIMIT 10;
```

You should see your reply logged!

## Deployment to Vercel

### 1. Install Vercel CLI

```bash
npm i -g vercel
```

### 2. Deploy

```bash
cd backend
vercel
```

Follow prompts:
- Link to existing project? N
- Project name: estirar-connect
- Directory: ./
- Override settings? N

### 3. Add Environment Variables

```bash
vercel env add SUPABASE_URL
vercel env add SUPABASE_SERVICE_KEY
vercel env add WHATSAPP_PHONE_NUMBER_ID
vercel env add WHATSAPP_ACCESS_TOKEN
vercel env add WHATSAPP_VERIFY_TOKEN
# ... add all env vars
```

Or add them in Vercel Dashboard > Project > Settings > Environment Variables

### 4. Deploy to Production

```bash
vercel --prod
```

### 5. Update WhatsApp Webhook

1. Copy your Vercel URL (e.g., `https://estirar-connect.vercel.app`)
2. In Meta Developers Console > WhatsApp > Configuration
3. Update Callback URL to: `https://estirar-connect.vercel.app/webhook`
4. Verify and Save

## Troubleshooting

### Messages not sending?

1. Check Vercel logs: `vercel logs`
2. Verify environment variables are set
3. Check WhatsApp API credits in Meta Business Manager
4. Verify phone numbers are in E.164 format (+1234567890)

### Webhook not receiving messages?

1. Verify webhook is subscribed to `messages` field
2. Check webhook URL is HTTPS
3. Verify token matches exactly
4. Check server logs for incoming requests

### Cron job not running?

Note: Vercel Serverless Functions don't support cron jobs. You'll need:
- Vercel Cron (add `vercel.json` cron config)
- Or use external service (GitHub Actions, EasyCron, etc.)
- Or use Supabase Functions with pg_cron

### Database connection issues?

1. Verify Supabase URL is correct
2. Check service key (not anon key) is being used
3. Verify row-level security is disabled for service key

## Next Steps

1. Add your real seniors to the database
2. Test the daily cron job
3. Monitor the logs table for sends and replies
4. Build the React admin dashboard (Phase 2)

## Support

For issues:
1. Check server logs
2. Check Supabase logs table
3. Check WhatsApp API logs in Meta Business Manager
4. Verify all environment variables are set correctly
