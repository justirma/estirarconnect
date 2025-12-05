import express from 'express';
import { sendDailyMessages } from '../controllers/messageController.js';

const router = express.Router();

router.post('/send', sendDailyMessages);

export default router;
