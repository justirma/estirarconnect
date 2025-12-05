import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const WHATSAPP_API_URL = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

async function testWhatsAppSend() {
  const phoneNumber = '+13055629885';
  const message = '¡Hola! 👋 This is a test message from Estirar Connect.';

  console.log('Testing WhatsApp API...');
  console.log('Phone Number ID:', process.env.WHATSAPP_PHONE_NUMBER_ID);
  console.log('Sending to:', phoneNumber);
  console.log('Access Token (first 20 chars):', ACCESS_TOKEN?.substring(0, 20) + '...');
  console.log('API URL:', WHATSAPP_API_URL);
  console.log('\n---\n');

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

    console.log('✅ SUCCESS!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    console.log('\nMessage ID:', response.data.messages[0].id);
    console.log('\nCheck your WhatsApp at +13055629885');

  } catch (error) {
    console.error('❌ FAILED!');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Error:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
  }
}

testWhatsAppSend();
