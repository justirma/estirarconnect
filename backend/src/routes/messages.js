import express from 'express';
import { sendDailyMessages } from '../controllers/messageController.js';

const router = express.Router();

// Auth middleware - requires same CRON_SECRET as the cron endpoint
const requireAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

router.post('/send', requireAuth, sendDailyMessages);

export default router;
