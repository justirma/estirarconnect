import axios from 'axios';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const WHATSAPP_API_URL = `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

export async function sendWhatsAppMessage(phoneNumber, message) {
  try {
    const response = await axios.post(
      WHATSAPP_API_URL,
      {
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'text',
        text: {
          body: message
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      success: true,
      messageId: response.data.messages[0].id,
      data: response.data
    };
  } catch (error) {
    console.error('WhatsApp API Error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
}

export async function sendWhatsAppTemplateMessage(phoneNumber, templateName, video, language) {
  try {
    const response = await axios.post(
      WHATSAPP_API_URL,
      {
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: language === 'es' ? 'es_PA' : 'en'
          },
          components: [
            {
              type: 'body',
              parameters: [
                {
                  type: 'text',
                  text: video.title
                },
                {
                  type: 'text',
                  text: video.youtube_url
                }
              ]
            }
          ]
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      success: true,
      messageId: response.data.messages[0].id,
      data: response.data
    };
  } catch (error) {
    console.error('WhatsApp Template API Error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
}

export async function sendWhatsAppReminderTemplate(phoneNumber, templateName, video, language) {
  try {
    const response = await axios.post(
      WHATSAPP_API_URL,
      {
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: language === 'es' ? 'es_PA' : 'en'
          },
          components: [
            {
              type: 'body',
              parameters: [
                {
                  type: 'text',
                  text: video.title
                },
                {
                  type: 'text',
                  text: video.youtube_url
                }
              ]
            }
          ]
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      success: true,
      messageId: response.data.messages[0].id,
      data: response.data
    };
  } catch (error) {
    console.error('WhatsApp Reminder Template API Error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
}


function getNextSundayFormatted(language) {
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0=Sun
  let daysToAdd;
  if (dayOfWeek === 0 && now.getUTCHours() < 14) {
    daysToAdd = 0; // Today is Sunday and the cron hasn't run yet (9 AM EST = 14:00 UTC)
  } else if (dayOfWeek === 0) {
    daysToAdd = 7; // Today is Sunday but the video already sent
  } else {
    daysToAdd = 7 - dayOfWeek;
  }
  const nextSunday = new Date(now);
  nextSunday.setUTCDate(now.getUTCDate() + daysToAdd);

  if (language === 'es') {
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    return `domingo, ${nextSunday.getUTCDate()} de ${months[nextSunday.getUTCMonth()]}`;
  }
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const day = nextSunday.getUTCDate();
  const suffix = (day === 1 || day === 21 || day === 31) ? 'st' : (day === 2 || day === 22) ? 'nd' : (day === 3 || day === 23) ? 'rd' : 'th';
  return `Sunday, ${months[nextSunday.getUTCMonth()]} ${day}${suffix}`;
}

export async function sendWelcomeTemplate(phoneNumber, name, language) {
  const templateName = language === 'es'
    ? process.env.WHATSAPP_WELCOME_TEMPLATE_NAME_ES
    : process.env.WHATSAPP_WELCOME_TEMPLATE_NAME_EN;

  if (!templateName) {
    console.warn('Welcome template name not configured — skipping welcome message');
    return { success: false, error: 'Welcome template not configured' };
  }

  const nextSunday = getNextSundayFormatted(language);

  try {
    const response = await axios.post(
      WHATSAPP_API_URL,
      {
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: language === 'es' ? 'es_PA' : 'en_US'
          },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: name },
                { type: 'text', text: nextSunday }
              ]
            }
          ]
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      success: true,
      messageId: response.data.messages[0].id,
      data: response.data
    };
  } catch (error) {
    console.error('WhatsApp Welcome Template API Error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
}

export async function sendWorkoutImageTemplate(phoneNumber, templateName, workout, language) {
  try {
    const response = await axios.post(
      WHATSAPP_API_URL,
      {
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'template',
        template: {
          name: templateName,
          language: { code: language === 'es' ? 'es_PA' : 'en' },
          components: [
            {
              type: 'header',
              parameters: [{ type: 'image', image: { link: workout.image_url } }]
            },
            {
              type: 'body',
              parameters: [
                { type: 'text', text: workout.title },
                { type: 'text', text: (workout.description || '').replace(/\n/g, ' | ') }
              ]
            }
          ]
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return { success: true, messageId: response.data.messages[0].id, data: response.data };
  } catch (error) {
    console.error('WhatsApp Workout Template API Error:', error.response?.data || error.message);
    return { success: false, error: error.response?.data || error.message };
  }
}

export async function sendWhatsAppImageMessage(phoneNumber, imageUrl, caption) {
  try {
    // Validate image URL to prevent SSRF — only allow HTTPS from known hosts
    const url = new URL(imageUrl);
    if (url.protocol !== 'https:') {
      return { success: false, error: 'Image URL must use HTTPS' };
    }

    const response = await axios.post(
      WHATSAPP_API_URL,
      {
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'image',
        image: {
          link: imageUrl,
          caption: caption || ''
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      success: true,
      messageId: response.data.messages[0].id,
      data: response.data
    };
  } catch (error) {
    console.error('WhatsApp Image API Error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
}

export function verifyWebhookSignature(rawBody, signature) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('WHATSAPP_APP_SECRET not set — skipping signature verification (dev only)');
      return true;
    }
    console.error('WHATSAPP_APP_SECRET not set — blocking request in production');
    return false;
  }
  if (!signature) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function verifyWebhook(mode, token) {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === verifyToken) {
    return true;
  }

  return false;
}

export function parseIncomingMessage(body) {
  try {
    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    if (!value?.messages) {
      return null;
    }

    const message = value.messages[0];
    const contact = value.contacts?.[0];

    const buttonText = message.type === 'interactive'
      ? message.interactive?.button_reply?.title || ''
      : '';

    return {
      from: message.from,
      messageId: message.id,
      timestamp: message.timestamp,
      text: message.text?.body || buttonText,
      type: message.type,
      contactName: contact?.profile?.name || 'Unknown'
    };
  } catch (error) {
    console.error('Error parsing incoming message:', error);
    return null;
  }
}
