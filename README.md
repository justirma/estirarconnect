# Estirar Connect - WhatsApp Daily Chair Exercise Bot

A system to send one YouTube chair-exercise video per day to seniors via WhatsApp 1:1 messages.

## Features

- 📱 Sends daily chair exercise videos via WhatsApp
- 🌐 Supports English and Spanish languages
- 🔄 Cycles through videos sequentially
- 📊 Logs all message sends and replies
- ✅ Tracks "DONE" replies from seniors
- ⏰ Scheduled daily sends at 9 AM EST

## Stack

- **Backend**: Node.js + Express
- **Database**: Supabase (PostgreSQL)
- **Messaging**: WhatsApp Cloud API
- **Deployment**: Vercel (backend)
- **Frontend**: React (admin dashboard - coming soon)

## Project Structure

```
estirarconnect/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── supabase.js
│   │   ├── controllers/
│   │   │   ├── messageController.js
│   │   │   └── webhookController.js
│   │   ├── routes/
│   │   │   ├── messages.js
│   │   │   └── webhook.js
│   │   ├── services/
│   │   │   ├── database.js
│   │   │   └── whatsapp.js
│   │   ├── scripts/
│   │   │   └── seed.js
│   │   └── index.js
│   ├── supabase/
│   │   └── migrations/
│   │       └── 001_initial_schema.sql
│   ├── .env.example
│   └── package.json
└── frontend/ (coming soon)
```

## Setup Instructions

### 1. Supabase Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Run the migration in [backend/supabase/migrations/001_initial_schema.sql](backend/supabase/migrations/001_initial_schema.sql)
3. Get your project URL and service key from Settings > API

### 2. WhatsApp Cloud API Setup

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Create a new app or use existing one
3. Add WhatsApp product to your app
4. Get your:
   - Phone Number ID
   - Access Token
   - Create a custom verify token (any random string)

### 3. Backend Setup

```bash
cd backend
npm install
```

Copy `.env.example` to `.env` and fill in your credentials:

```bash
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

PORT=3000
NODE_ENV=development

SEND_TIME_HOUR=9
SEND_TIME_TIMEZONE=America/New_York
```

### 4. Seed the Database

```bash
npm run seed
```

This will:
- Add 12 chair exercise videos (6 English, 6 Spanish)
- Create 2 test seniors

### 5. Run the Server

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

### 6. Setup WhatsApp Webhook

1. Start your server (use ngrok for local testing):
   ```bash
   ngrok http 3000
   ```

2. In Meta Developer Console > WhatsApp > Configuration:
   - Callback URL: `https://your-domain.com/webhook`
   - Verify Token: (same as WHATSAPP_VERIFY_TOKEN in .env)
   - Subscribe to: `messages` webhook field

## API Endpoints

### GET /
Health check endpoint

**Response:**
```json
{
  "status": "ok",
  "service": "Estirar Connect - WhatsApp Chair Exercise Bot",
  "version": "1.0.0"
}
```

### POST /messages/send
Manually trigger sending daily messages to all active seniors

**Response:**
```json
{
  "success": true,
  "message": "Processed 5 messages",
  "results": [
    {
      "seniorId": "uuid",
      "phoneNumber": "+1234567890",
      "videoTitle": "10-Minute Seated Morning Stretch",
      "success": true,
      "messageId": "wamid.xxx"
    }
  ]
}
```

### GET /webhook
WhatsApp webhook verification endpoint

### POST /webhook
Receives incoming WhatsApp messages and logs replies

## Database Schema

### seniors
- `id` (UUID, primary key)
- `phone_number` (VARCHAR, unique)
- `language` (VARCHAR: 'en' or 'es')
- `created_at` (TIMESTAMP)
- `active` (BOOLEAN)

### videos
- `id` (UUID, primary key)
- `title` (VARCHAR)
- `youtube_url` (VARCHAR, unique)
- `category` (VARCHAR)
- `language` (VARCHAR: 'en' or 'es')
- `sequence_order` (INTEGER)
- `created_at` (TIMESTAMP)

### logs
- `id` (UUID, primary key)
- `senior_id` (UUID, foreign key)
- `video_id` (UUID, foreign key)
- `sent_at` (TIMESTAMP)
- `status` (VARCHAR: 'sent', 'delivered', 'read', 'failed')
- `reply_text` (TEXT)
- `replied_at` (TIMESTAMP)

## How It Works

1. **Daily Schedule**: At 9 AM EST, the cron job triggers
2. **Fetch Seniors**: Gets all active seniors from database
3. **Select Video**: For each senior, finds the next video in sequence based on their language
4. **Send Message**: Formats and sends WhatsApp message with video link
5. **Log Send**: Records the send in the logs table
6. **Receive Replies**: Webhook receives "DONE" replies and logs them

## Video Cycling Logic

- Each senior has their own progress tracked
- Videos cycle sequentially (1, 2, 3, 4, 5, 6, then back to 1)
- After the last video, it loops back to the first
- Language-specific: English seniors get English videos, Spanish seniors get Spanish videos

## Testing

### Test Message Send Manually

```bash
curl -X POST http://localhost:3000/messages/send
```

### Test Webhook Locally

1. Use ngrok to expose local server
2. Configure webhook in Meta Developer Console
3. Send a message to your WhatsApp Business number
4. Check server logs to see incoming message handling

## Deployment to Vercel

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Deploy:
   ```bash
   cd backend
   vercel
   ```

3. Add environment variables in Vercel dashboard

4. Update WhatsApp webhook URL to your Vercel deployment URL

## Adding New Seniors

Direct SQL in Supabase:
```sql
INSERT INTO seniors (phone_number, language)
VALUES ('+1234567890', 'en');
```

Or add via admin dashboard (coming soon in Phase 2)

## Monitoring

Check logs table in Supabase to monitor:
- Message send success/failure rates
- Senior reply rates
- Most recent activity per senior

## Future Enhancements

- React admin dashboard for managing seniors and videos
- Authentication for admin endpoints
- SMS fallback for non-WhatsApp users
- Video completion analytics
- Customizable send times per senior
- Multi-language support beyond English/Spanish

## Support

For issues or questions, check the logs in:
- Server console output
- Supabase logs table
- WhatsApp Cloud API logs in Meta Business Manager

## License

MIT
