import express from 'express';
import dotenv from 'dotenv';
import cron from 'node-cron';
import webhookRouter from './routes/webhook.js';
import messagesRouter from './routes/messages.js';
import { sendDailyMessages } from './controllers/messageController.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Estirar Connect - WhatsApp Chair Exercise Bot',
    version: '1.0.0'
  });
});

// Routes
app.use('/webhook', webhookRouter);
app.use('/messages', messagesRouter);

// Cron job: Send daily messages at 9 AM EST
// Cron format: minute hour day month dayOfWeek
// '0 9 * * *' = 9:00 AM every day (server time - make sure server is EST)
const SEND_TIME_HOUR = process.env.SEND_TIME_HOUR || 9;
const cronSchedule = `0 ${SEND_TIME_HOUR} * * *`;

cron.schedule(cronSchedule, async () => {
  console.log(`[${new Date().toISOString()}] Running daily message cron job`);

  try {
    // Create a mock request/response for the controller
    const mockReq = {};
    const mockRes = {
      json: (data) => console.log('Cron job result:', data),
      status: (code) => ({
        json: (data) => console.log(`Cron job error (${code}):`, data)
      })
    };

    await sendDailyMessages(mockReq, mockRes);
  } catch (error) {
    console.error('Error in cron job:', error);
  }
}, {
  timezone: process.env.SEND_TIME_TIMEZONE || 'America/New_York'
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Daily messages scheduled for ${SEND_TIME_HOUR}:00 ${process.env.SEND_TIME_TIMEZONE || 'America/New_York'}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
