import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const WHATSAPP_API_URL = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
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
            code: language === 'es' ? 'es_PA' : 'en_US'
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

export function formatVideoMessage(video, language) {
  const greetings = {
    en: `Hello! 👋\n\nHere's today's chair exercise:\n\n📹 ${video.title}\n\n${video.youtube_url}\n\nReply "DONE" when you complete it!`,
    es: `¡Hola! 👋\n\nAquí está el ejercicio de silla de hoy:\n\n📹 ${video.title}\n\n${video.youtube_url}\n\n¡Responde "FIN" cuando lo completes!`
  };

  return greetings[language] || greetings.en;
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

    return {
      from: message.from,
      messageId: message.id,
      timestamp: message.timestamp,
      text: message.text?.body || '',
      type: message.type,
      contactName: contact?.profile?.name || 'Unknown'
    };
  } catch (error) {
    console.error('Error parsing incoming message:', error);
    return null;
  }
}
