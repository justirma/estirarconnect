import express from 'express';
import { serveAdminDashboard, getRecentLogs, processReply, getSeniors } from '../controllers/adminController.js';

const router = express.Router();

const requireAuth = (req, res, next) => {
  // Accept token from query param (for browser page load) or Authorization header (for API calls)
  const token = req.query.token || req.headers['authorization']?.replace('Bearer ', '');
  if (token !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Dashboard page: no auth required here — JS handles login via sessionStorage
router.get('/', serveAdminDashboard);
router.get('/api/logs', requireAuth, getRecentLogs);
router.post('/api/process-reply', requireAuth, processReply);
router.get('/api/seniors', requireAuth, getSeniors);

export default router;
