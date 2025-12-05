import { verifyWebhook, parseIncomingMessage } from '../services/whatsapp.js';
import { getSeniorByPhone, logReply } from '../services/database.js';

export async function handleWebhookVerification(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (await verifyWebhook(mode, token)) {
    console.log('Webhook verified successfully');
    return res.status(200).send(challenge);
  }

  console.error('Webhook verification failed');
  return res.status(403).send('Verification failed');
}

export async function handleIncomingMessage(req, res) {
  try {
    const messageData = parseIncomingMessage(req.body);

    if (!messageData) {
      return res.sendStatus(200);
    }

    console.log('Incoming message:', messageData);

    // Find senior by phone number
    const senior = await getSeniorByPhone(messageData.from);

    if (!senior) {
      console.log('Message from unknown number:', messageData.from);
      return res.sendStatus(200);
    }

    // Log the reply
    const replyText = messageData.text.trim();
    await logReply(senior.id, replyText);

    console.log(`Reply logged for senior ${senior.id}: ${replyText}`);

    return res.sendStatus(200);
  } catch (error) {
    console.error('Error handling incoming message:', error);
    return res.sendStatus(500);
  }
}
