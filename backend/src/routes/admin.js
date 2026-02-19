import express from 'express';
import { serveAdminDashboard, getRecentLogs } from '../controllers/adminController.js';

const router = express.Router();

const requireAuth = (req, res, next) => {
  // Accept token from query param (for browser page load) or Authorization header (for API calls)
  const token = req.query.token || req.headers['authorization']?.replace('Bearer ', '');
  if (token !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

router.get('/', requireAuth, serveAdminDashboard);
router.get('/api/logs', requireAuth, getRecentLogs);

export default router;
