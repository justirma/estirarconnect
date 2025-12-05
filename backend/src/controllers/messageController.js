import { getActiveSeniors, getNextVideoForSenior, logMessageSent } from '../services/database.js';
import { sendWhatsAppMessage, formatVideoMessage } from '../services/whatsapp.js';

export async function sendDailyMessages(req, res) {
  try {
    const seniors = await getActiveSeniors();

    if (!seniors || seniors.length === 0) {
      return res.json({
        success: true,
        message: 'No active seniors to send messages to',
        results: []
      });
    }

    const results = [];

    for (const senior of seniors) {
      try {
        // Get next video for this senior based on their language
        const video = await getNextVideoForSenior(senior.id, senior.language);

        if (!video) {
          console.error(`No video found for senior ${senior.id}`);
          results.push({
            seniorId: senior.id,
            phoneNumber: senior.phone_number,
            success: false,
            error: 'No video found'
          });
          continue;
        }

        // Format the message
        const message = formatVideoMessage(video, senior.language);

        // Send WhatsApp message
        const result = await sendWhatsAppMessage(senior.phone_number, message);

        // Log the send attempt
        const status = result.success ? 'sent' : 'failed';
        await logMessageSent(senior.id, video.id, status);

        results.push({
          seniorId: senior.id,
          phoneNumber: senior.phone_number,
          videoTitle: video.title,
          success: result.success,
          messageId: result.messageId,
          error: result.error
        });

        console.log(`Message ${status} to ${senior.phone_number}: ${video.title}`);
      } catch (error) {
        console.error(`Error sending to senior ${senior.id}:`, error);
        results.push({
          seniorId: senior.id,
          phoneNumber: senior.phone_number,
          success: false,
          error: error.message
        });
      }
    }

    return res.json({
      success: true,
      message: `Processed ${results.length} messages`,
      results: results
    });
  } catch (error) {
    console.error('Error in sendDailyMessages:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
