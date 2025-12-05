import express from 'express';
import { handleWebhookVerification, handleIncomingMessage } from '../controllers/webhookController.js';

const router = express.Router();

router.get('/', handleWebhookVerification);
router.post('/', handleIncomingMessage);

export default router;
