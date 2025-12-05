# Project Structure

```
estirarconnect/
│
├── README.md                    # Main documentation
├── SETUP.md                     # Step-by-step setup guide
├── PROJECT_STRUCTURE.md         # This file
├── .gitignore                   # Git ignore rules
│
├── backend/                     # Node.js/Express backend
│   ├── package.json            # Dependencies and scripts
│   ├── vercel.json             # Vercel deployment config
│   ├── .env.example            # Environment variables template
│   │
│   ├── src/
│   │   ├── index.js            # Main Express app & cron job
│   │   │
│   │   ├── config/
│   │   │   └── supabase.js     # Supabase client setup
│   │   │
│   │   ├── controllers/
│   │   │   ├── messageController.js    # Message sending logic
│   │   │   └── webhookController.js    # Webhook handling
│   │   │
│   │   ├── routes/
│   │   │   ├── messages.js     # /messages/send endpoint
│   │   │   └── webhook.js      # /webhook GET/POST endpoints
│   │   │
│   │   ├── services/
│   │   │   ├── database.js     # Supabase database queries
│   │   │   └── whatsapp.js     # WhatsApp API integration
│   │   │
│   │   ├── utils/
│   │   │   └── logger.js       # Logging utility
│   │   │
│   │   └── scripts/
│   │       └── seed.js         # Database seeding script
│   │
│   └── supabase/
│       └── migrations/
│           └── 001_initial_schema.sql  # Database schema
│
└── frontend/                    # React admin dashboard (Phase 2)
    └── src/                     # To be implemented
```

## File Descriptions

### Root Level

- **README.md**: Complete project documentation with features, API endpoints, and deployment guide
- **SETUP.md**: Detailed step-by-step setup instructions for local development and production
- **.gitignore**: Excludes node_modules, .env files, and other sensitive/generated files

### Backend

#### Configuration
- **src/config/supabase.js**: Initializes Supabase client with environment variables

#### Controllers
- **src/controllers/messageController.js**:
  - `sendDailyMessages()`: Main function to send videos to all active seniors
  - Handles video selection, message formatting, and logging

- **src/controllers/webhookController.js**:
  - `handleWebhookVerification()`: Verifies WhatsApp webhook with Meta
  - `handleIncomingMessage()`: Processes incoming messages and logs replies

#### Routes
- **src/routes/messages.js**: POST /messages/send endpoint
- **src/routes/webhook.js**: GET/POST /webhook endpoints for WhatsApp

#### Services
- **src/services/database.js**: All Supabase database operations
  - Get seniors, videos, logs
  - Log message sends and replies
  - Smart video cycling logic per senior

- **src/services/whatsapp.js**: WhatsApp Cloud API integration
  - Send messages
  - Parse incoming webhooks
  - Format video messages with translations

#### Scripts
- **src/scripts/seed.js**: Seeds database with:
  - 12 chair exercise videos (6 English, 6 Spanish)
  - 2 test seniors

#### Main App
- **src/index.js**:
  - Express server setup
  - Route mounting
  - Cron job for daily 9 AM sends
  - Health check endpoint

#### Database
- **supabase/migrations/001_initial_schema.sql**:
  - `seniors` table: Recipient information
  - `videos` table: Exercise video metadata
  - `logs` table: Send/reply tracking

### Frontend (Coming in Phase 2)

Will include:
- Senior management UI
- Video management UI
- Send history dashboard
- Analytics and reporting

## Key Dependencies

- **@supabase/supabase-js**: Database client
- **express**: Web framework
- **axios**: HTTP client for WhatsApp API
- **node-cron**: Scheduled task execution
- **dotenv**: Environment variable management

## Data Flow

1. **Daily Send**:
   - Cron triggers at 9 AM EST
   - Fetch all active seniors
   - For each senior: get next video based on language + sequence
   - Send WhatsApp message
   - Log to database

2. **Receive Reply**:
   - WhatsApp sends POST to /webhook
   - Parse message body
   - Find senior by phone number
   - Update most recent log with reply text and timestamp

3. **Video Cycling**:
   - Check last video sent to senior
   - Get next in sequence for their language
   - If at end, loop back to sequence 1

## Environment Variables Required

- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_KEY
- WHATSAPP_PHONE_NUMBER_ID
- WHATSAPP_ACCESS_TOKEN
- WHATSAPP_VERIFY_TOKEN
- WHATSAPP_BUSINESS_ACCOUNT_ID
- PORT
- NODE_ENV
- SEND_TIME_HOUR
- SEND_TIME_TIMEZONE
