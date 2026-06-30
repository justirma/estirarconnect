import express from 'express';
import rateLimit from 'express-rate-limit';
import { serveAdminDashboard, getRecentLogs, processReply, getSeniors, addSenior, getStats } from '../controllers/adminController.js';

const router = express.Router();

const requireAuth = (req, res, next) => {
  // Accept token from query param (for browser page load) or Authorization header (for API calls)
  const token = req.query.token || req.headers['authorization']?.replace('Bearer ', '');
  if (token !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Max 10 senior enrollments per IP per hour
const addSeniorLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

// Dashboard page: no auth required here — JS handles login via sessionStorage
router.get('/', serveAdminDashboard);
router.get('/api/logs', requireAuth, getRecentLogs);
router.post('/api/process-reply', requireAuth, processReply);
router.get('/api/seniors', requireAuth, getSeniors);
router.get('/api/stats', requireAuth, getStats);
router.post('/api/seniors', addSeniorLimiter, requireAuth, addSenior);

export default router;
