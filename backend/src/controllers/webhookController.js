import { verifyWebhook, verifyWebhookSignature, parseIncomingMessage, sendWhatsAppMessage } from '../services/whatsapp.js';
import { getSeniorByPhone, logReply, getCompletionStreak, deactivateSenior, reactivateSenior } from '../services/database.js';
import { getPostHog } from '../config/posthog.js';

const SEND_TIME = process.env.SEND_TIME_DISPLAY || '9 AM EST';

const COMPLETION_KEYWORDS = ['done', 'fin', 'listo', 'lista', 'complete', 'completed', 'hecho', 'finished', 'terminé', 'termine', 'lo hice'];
const STOP_KEYWORDS = ['stop', 'unsubscribe', 'quit', 'cancel', 'end', 'parar', 'cancelar', 'baja', 'salir', 'detener'];
const START_KEYWORDS = ['start', 'comenzar', 'inicio', 'subscribe'];
const HELP_KEYWORDS = ['help', 'ayuda', 'info'];

function isCompletion(text) {
  const lower = text.toLowerCase().trim();
  return COMPLETION_KEYWORDS.some(kw => lower.includes(kw));
}

function isOptOut(text) {
  const lower = text.toLowerCase().trim();
  return STOP_KEYWORDS.some(kw => lower === kw);
}

function isOptIn(text) {
  const lower = text.toLowerCase().trim();
  return START_KEYWORDS.some(kw => lower === kw);
}

function isHelp(text) {
  const lower = text.toLowerCase().trim();
  return HELP_KEYWORDS.some(kw => lower === kw || lower.startsWith(kw));
}

function getHelpMessage(language) {
  if (language === 'es') {
    return `Estirar Connect te envía un video de ejercicios cada domingo a las ${SEND_TIME}.\n\nResponde *Listo* cuando termines el ejercicio.\nEscribe *PARAR* para darte de baja.`;
  }
  return `Estirar Connect sends you a weekly chair exercise video every Sunday at ${SEND_TIME}.\n\nReply *Done* when you finish the exercise.\nReply *STOP* to unsubscribe.`;
}

function getCompletionMessage(language, streak) {
  let streakMsg = '';
  if (streak >= 20) {
    streakMsg = language === 'es' ? `\n\n🌟 ¡${streak} semanas seguidas! ¡Absolutamente increíble!` : `\n\n🌟 ${streak} weeks! Absolutely incredible!`;
  } else if (streak >= 10) {
    streakMsg = language === 'es' ? `\n\n🏆 ¡${streak} semanas seguidas! ¡Eres un campeón!` : `\n\n🏆 ${streak} weeks in a row! You're a champion!`;
  } else if (streak >= 5) {
    streakMsg = language === 'es' ? `\n\n💪 ¡${streak} semanas seguidas! ¡Estás en racha!` : `\n\n💪 ${streak} weeks straight! You're on fire!`;
  } else if (streak >= 3) {
    streakMsg = language === 'es' ? `\n\n🔥 ¡${streak} semanas seguidas! ¡Sigue así!` : `\n\n🔥 ${streak} weeks in a row! Keep it up!`;
  } else if (streak === 2) {
    streakMsg = language === 'es' ? `\n\n⭐ ¡2 semanas seguidas! ¡Estás creando un hábito!` : `\n\n⭐ 2 weeks in a row! You're building a habit!`;
  } else if (streak === 1) {
    streakMsg = language === 'es' ? `\n\n🌱 ¡Primera semana completada! ¡Tu racha ha comenzado!` : `\n\n🌱 First week done — your streak has started!`;
  }

  if (language === 'es') {
    return `¡Buen trabajo! 💪 ¡Nos vemos la próxima semana! Tu próximo video será enviado el domingo a las ${SEND_TIME}.${streakMsg}`;
  }
  return `Great job! 💪 See you next week! Your next video will be sent Sunday at ${SEND_TIME}.${streakMsg}`;
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
  const signature = req.headers['x-hub-signature-256'];
  if (!verifyWebhookSignature(req.rawBody, signature)) {
    console.warn('Webhook signature verification failed');
    return res.sendStatus(403);
  }

  try {
    const messageData = parseIncomingMessage(req.body);

    if (!messageData) {
      console.warn('Webhook received but no parseable message:', JSON.stringify(req.body).slice(0, 200));
      return res.sendStatus(200);
    }

    // Ignore non-text messages (reactions, images, audio, etc.) — no nudge
    if (messageData.type !== 'text') {
      console.log(`Ignored non-text message (type: ${messageData.type}) from ${messageData.from}`);
      return res.sendStatus(200);
    }

    console.log('Incoming message:', messageData);

    const senior = await getSeniorByPhone(messageData.from);

    if (!senior) {
      console.log('Message from unknown number:', messageData.from);
      return res.sendStatus(200);
    }

    const replyText = messageData.text.trim();
    const posthog = getPostHog();

    // Handle inactive seniors — offer re-enrollment
    if (!senior.active) {
      if (isOptIn(replyText)) {
        await reactivateSenior(senior.id);
        const msg = senior.language === 'es'
          ? '¡Bienvenido de nuevo! 🎉 Recibirás tu próximo video de ejercicios el domingo.'
          : 'Welcome back! 🎉 You\'ll receive your next exercise video on Sunday.';
        await sendWhatsAppMessage(senior.phone_number, msg);
        if (posthog) posthog.capture({ distinctId: senior.id, event: 're_enrolled', properties: { language: senior.language } });
        console.log(`Senior ${senior.id} re-enrolled`);
      } else {
        const msg = senior.language === 'es'
          ? 'Estás dado de baja de Estirar Connect. Escribe *COMENZAR* para volverte a suscribir. 😊'
          : 'You\'re unsubscribed from Estirar Connect. Text *START* to re-subscribe. 😊';
        await sendWhatsAppMessage(senior.phone_number, msg);
      }
      return res.sendStatus(200);
    }

    // HELP
    if (isHelp(replyText)) {
      const helpMsg = getHelpMessage(senior.language);
      await sendWhatsAppMessage(senior.phone_number, helpMsg);
      console.log(`Help message sent to senior ${senior.id}`);
      return res.sendStatus(200);
    }

    // Opt-out
    if (isOptOut(replyText)) {
      await deactivateSenior(senior.id);
      const farewell = senior.language === 'es'
        ? 'Te has dado de baja de Estirar Connect. No recibirás más mensajes. Escribe *COMENZAR* para volverte a suscribir cuando quieras. 👋'
        : 'You\'ve been unsubscribed from Estirar Connect. No more messages will be sent. Text *START* to re-subscribe anytime. 👋';
      await sendWhatsAppMessage(senior.phone_number, farewell);
      if (posthog) posthog.capture({ distinctId: senior.id, event: 'opted_out', properties: { language: senior.language } });
      console.log(`Senior ${senior.id} opted out. Deactivated.`);
      return res.sendStatus(200);
    }

    const completed = isCompletion(replyText);

    // Log the reply
    await logReply(senior.id, replyText, completed);

    if (completed) {
      const streak = await getCompletionStreak(senior.id);
      const message = getCompletionMessage(senior.language, streak);
      const ackResult = await sendWhatsAppMessage(senior.phone_number, message);
      if (!ackResult.success) {
        console.warn(`Failed to send completion ACK to senior ${senior.id}:`, ackResult.error);
      }
      if (posthog) posthog.capture({ distinctId: senior.id, event: 'exercise_completed', properties: { language: senior.language, streak } });
      console.log(`Completion logged for senior ${senior.id} (streak: ${streak})`);
    } else {
      const nudge = senior.language === 'es'
        ? '¡Gracias por tu mensaje! Si ya terminaste el ejercicio, escribe *Listo* y lo marcaremos como completado 😊'
        : 'Thanks for your message! If you\'ve finished the exercise, reply *Done* and we\'ll mark it complete 😊';
      const nudgeResult = await sendWhatsAppMessage(senior.phone_number, nudge);
      if (!nudgeResult.success) {
        console.warn(`Failed to send nudge to senior ${senior.id}:`, nudgeResult.error);
      }
      console.log(`Reply logged for senior ${senior.id}: ${replyText}`);
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error('Error handling incoming message:', error);
    return res.sendStatus(500);
  }
}
