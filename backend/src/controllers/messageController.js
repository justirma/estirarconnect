import { getActiveSeniors, getNextVideoForSenior, logMessageSent, getVideoBySequence, getThisWeeksLog, markIncompleteLogsAsSkipped, getSeniorByPhone } from '../services/database.js';
import { sendWhatsAppTemplateMessage, sendWhatsAppReminderTemplate } from '../services/whatsapp.js';

export async function sendWeeklyMessages(req, res) {
  try {
    const dayOfWeek = new Date().getUTCDay(); // 0 = Sunday at 14:00 UTC

    if (dayOfWeek === 0) {
      return await sendSundayVideos(req, res);
    } else {
      return await sendReminders(req, res);
    }
  } catch (error) {
    console.error('Error in sendWeeklyMessages:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// Alias for backward compatibility with routes and index.js
export { sendWeeklyMessages as sendDailyMessages };

async function sendSundayVideos(req, res) {
  const seniors = await getActiveSeniors();

  if (!seniors || seniors.length === 0) {
    return res.json({
      success: true,
      message: '[Sunday] No active seniors to send videos to',
      results: []
    });
  }

  const results = [];

  for (const senior of seniors) {
    try {
      // Mark any incomplete logs from previous weeks as skipped
      await markIncompleteLogsAsSkipped(senior.id);

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

      const templateName = senior.language === 'es'
        ? (process.env.WHATSAPP_TEMPLATE_NAME_ES || 'actualizacion_sesion_diaria')
        : (process.env.WHATSAPP_TEMPLATE_NAME_EN || 'daily_exercise_update');

      const result = await sendWhatsAppTemplateMessage(
        senior.phone_number,
        templateName,
        video,
        senior.language
      );

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

      console.log(`[Sunday] Video ${status} to ${senior.phone_number}: ${video.title}`);
    } catch (error) {
      console.error(`Error sending video to senior ${senior.id}:`, error);
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
    message: `[Sunday] Sent ${results.filter(r => r.success).length}/${results.length} weekly videos`,
    results
  });
}

async function sendReminders(req, res) {
  const seniors = await getActiveSeniors();

  if (!seniors || seniors.length === 0) {
    return res.json({
      success: true,
      message: '[Reminder] No active seniors',
      results: []
    });
  }

  const results = [];

  for (const senior of seniors) {
    try {
      const weekLog = await getThisWeeksLog(senior.id);

      if (!weekLog) {
        console.log(`[Reminder] No weekly log for senior ${senior.id}, skipping`);
        results.push({
          seniorId: senior.id,
          phoneNumber: senior.phone_number,
          success: true,
          skipped: true,
          reason: 'no_weekly_log'
        });
        continue;
      }

      if (weekLog.completed) {
        console.log(`[Reminder] Senior ${senior.id} already completed, skipping`);
        results.push({
          seniorId: senior.id,
          phoneNumber: senior.phone_number,
          success: true,
          skipped: true,
          reason: 'already_completed'
        });
        continue;
      }

      const video = weekLog.videos;
      const reminderTemplateName = senior.language === 'es'
        ? (process.env.WHATSAPP_REMINDER_TEMPLATE_NAME_ES || 'sesion_ejercicio_semanal')
        : (process.env.WHATSAPP_REMINDER_TEMPLATE_NAME_EN || 'weekly_exercise_reminder');

      const result = await sendWhatsAppReminderTemplate(
        senior.phone_number,
        reminderTemplateName,
        video,
        senior.language
      );

      results.push({
        seniorId: senior.id,
        phoneNumber: senior.phone_number,
        videoTitle: video.title,
        success: result.success,
        skipped: false,
        messageId: result.messageId,
        error: result.error
      });

      console.log(`[Reminder] ${result.success ? 'Sent' : 'Failed'} to ${senior.phone_number}`);
    } catch (error) {
      console.error(`Error sending reminder to senior ${senior.id}:`, error);
      results.push({
        seniorId: senior.id,
        phoneNumber: senior.phone_number,
        success: false,
        error: error.message
      });
    }
  }

  const sent = results.filter(r => !r.skipped && r.success).length;
  const skippedCompleted = results.filter(r => r.reason === 'already_completed').length;
  const skippedNoLog = results.filter(r => r.reason === 'no_weekly_log').length;

  return res.json({
    success: true,
    message: `[Reminder] Sent: ${sent}, Skipped (completed): ${skippedCompleted}, Skipped (no log): ${skippedNoLog}`,
    results
  });
}

export async function sendTestMessage(req, res) {
  try {
    const phoneNumber = req.body.phoneNumber || '+13055629885';
    const language = req.body.language || 'en';

    const video = await getVideoBySequence(language, 1);

    if (!video) {
      return res.status(404).json({
        success: false,
        error: `No video found for language: ${language}`
      });
    }

    const templateName = language === 'es'
      ? (process.env.WHATSAPP_TEMPLATE_NAME_ES || 'actualizacion_sesion_diaria')
      : (process.env.WHATSAPP_TEMPLATE_NAME_EN || 'daily_exercise_update');

    const result = await sendWhatsAppTemplateMessage(phoneNumber, templateName, video, language);

    // Log the test message so it appears in the dashboard
    const senior = await getSeniorByPhone(phoneNumber);
    if (senior) {
      const status = result.success ? 'sent' : 'failed';
      await logMessageSent(senior.id, video.id, status);
    }

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }

    return res.json({
      success: true,
      message: 'Test message sent',
      details: {
        phoneNumber,
        templateName,
        videoTitle: video.title,
        messageId: result.messageId
      }
    });
  } catch (error) {
    console.error('Error in sendTestMessage:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
