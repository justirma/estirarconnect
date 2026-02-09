import { verifyWebhook, parseIncomingMessage, sendWhatsAppMessage } from '../services/whatsapp.js';
import { getSeniorByPhone, logReply, getCompletionStreak } from '../services/database.js';

const COMPLETION_KEYWORDS = ['done', 'fin', 'listo', 'lista', 'complete', 'completed', 'hecho', 'finished', 'terminé', 'termine', 'lo hice'];

function isCompletion(text) {
  const lower = text.toLowerCase().trim();
  return COMPLETION_KEYWORDS.some(kw => lower.includes(kw));
}

function getCompletionMessage(language, streak) {
  if (language === 'es') {
    let msg = '¡Buen trabajo! 💪 ¡Nos vemos la próxima semana! Tu próximo video será enviado el domingo a las 9 AM EST.';
    if (streak >= 3) {
      msg += `\n\n🔥 ¡${streak} semanas seguidas! ¡Sigue así!`;
    }
    return msg;
  }

  let msg = 'Great job! 💪 See you next week! Your next video will be sent Sunday at 9 AM EST.';
  if (streak >= 3) {
    msg += `\n\n🔥 ${streak} weeks in a row! Keep it up!`;
  }
  return msg;
}

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

    const replyText = messageData.text.trim();
    const completed = isCompletion(replyText);

    // Log the reply (with completion flag if applicable)
    await logReply(senior.id, replyText, completed);

    // Send acknowledgment if they completed the exercise
    if (completed) {
      const streak = await getCompletionStreak(senior.id);
      const message = getCompletionMessage(senior.language, streak);
      await sendWhatsAppMessage(senior.phone_number, message);
      console.log(`Completion logged for senior ${senior.id} (streak: ${streak})`);
    } else {
      const nudge = senior.language === 'es'
        ? '¡Gracias por tu mensaje! Si ya terminaste el ejercicio, cuéntanos y lo marcaremos como completado 😊'
        : 'Thanks for your message! If you\'ve finished the exercise, just let us know and we\'ll mark it complete 😊';
      await sendWhatsAppMessage(senior.phone_number, nudge);
      console.log(`Reply logged for senior ${senior.id}: ${replyText}`);
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error('Error handling incoming message:', error);
    return res.sendStatus(500);
  }
}
