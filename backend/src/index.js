import express from 'express';
import dotenv from 'dotenv';
import webhookRouter from './routes/webhook.js';
import messagesRouter from './routes/messages.js';
import adminRouter from './routes/admin.js';
import { sendDailyMessages } from './controllers/messageController.js';
import { getPostHog, shutdownPostHog } from './config/posthog.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({
  verify: (req, res, buf) => { req.rawBody = buf; }
}));

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Estirar Connect - WhatsApp Chair Exercise Bot',
    version: '1.0.0'
  });
});

app.get('/favicon.ico', (req, res) => res.status(204).end());

// Routes
app.use('/webhook', webhookRouter);
app.use('/messages', messagesRouter);
app.use('/admin', adminRouter);

// Vercel Cron endpoint — called automatically by Vercel's cron scheduler
app.get('/api/cron/daily-messages', async (req, res) => {
  // Verify the request is from Vercel Cron (Vercel sets this header)
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const now = new Date();
  const dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][now.getUTCDay()];
  console.log(`[${now.toISOString()}] Vercel Cron: ${dayName} - ${now.getUTCDay() === 0 ? 'sending weekly videos' : 'sending reminders'}`);

  // Track cron execution in PostHog
  const posthog = getPostHog();
  if (posthog) {
    posthog.capture({
      distinctId: 'system',
      event: 'cron_run',
      properties: { day_of_week: dayName, action: now.getUTCDay() === 0 ? 'video' : 'reminder' }
    });
  }

  try {
    await sendDailyMessages(req, res);
  } catch (error) {
    console.error('Cron job error:', error);
    return res.status(500).json({ error: 'Failed to send weekly messages' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
