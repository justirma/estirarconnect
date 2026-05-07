import {
  getActiveSeniors, getNextVideoForSenior, logMessageSent,
  getVideoBySequence, getThisWeeksLog, markIncompleteLogsAsSkipped,
  getSeniorByPhone, getNextWorkoutForSenior, logWorkoutSent,
  getThisWeeksWorkoutLog, getWorkoutBySequence
} from '../services/database.js';
import { sendWhatsAppTemplateMessage, sendWhatsAppReminderTemplate, sendWhatsAppImageMessage, sendWorkoutImageTemplate } from '../services/whatsapp.js';
import { sendWhatsAppMessage } from '../services/whatsapp.js';
import { getPostHog } from '../config/posthog.js';

// Feature flag: set to true to use new image-based workouts, false for legacy YouTube videos
const USE_WORKOUT_IMAGES = process.env.USE_WORKOUT_IMAGES === 'true';

export async function sendWeeklyMessages(req, res) {
  try {
    const dayOfWeek = new Date().getUTCDay(); // 0 = Sunday at 14:00 UTC

    if (dayOfWeek === 0) {
      return USE_WORKOUT_IMAGES
        ? await sendSundayWorkouts(req, res)
        : await sendSundayVideos(req, res);
    } else {
      return USE_WORKOUT_IMAGES
        ? await sendWorkoutReminders(req, res)
        : await sendReminders(req, res);
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

// ---- NEW: Image-based workout functions ----

function getWorkoutCaption(workout, language) {
  const theme = workout.theme ? ` — ${workout.theme}` : '';
  if (language === 'es') {
    return `${workout.title}${theme}\n\n${workout.description || 'Completa los ejercicios a tu ritmo.'}\n\nResponde *Listo* cuando termines.`;
  }
  return `${workout.title}${theme}\n\n${workout.description || 'Complete the exercises at your own pace.'}\n\nReply *Done* when you finish.`;
}

function getWorkoutReminderMessage(workout, language) {
  if (language === 'es') {
    return `Hola, un recordatorio amistoso de tu ejercicio de esta semana: *${workout.title}*\n\nResponde *Listo* cuando termines. ¡Tú puedes! 💪`;
  }
  return `Hi there, a friendly reminder about this week's workout: *${workout.title}*\n\nReply *Done* when you finish. You've got this! 💪`;
}

async function sendSundayWorkouts(req, res) {
  const seniors = await getActiveSeniors();

  if (!seniors || seniors.length === 0) {
    return res.json({
      success: true,
      message: '[Sunday] No active seniors to send workouts to',
      results: []
    });
  }

  const results = [];

  for (const senior of seniors) {
    try {
      // Mark any incomplete logs from previous weeks as skipped
      await markIncompleteLogsAsSkipped(senior.id);

      const workout = await getNextWorkoutForSenior(senior.id, senior.language);

      if (!workout) {
        console.error(`No workout found for senior ${senior.id}`);
        results.push({
          seniorId: senior.id,
          phoneNumber: senior.phone_number,
          success: false,
          error: 'No workout found'
        });
        continue;
      }

      const workoutTemplateName = senior.language === 'es'
        ? (process.env.WHATSAPP_WORKOUT_TEMPLATE_NAME_ES || 'imagen_ejercicio_semanal')
        : (process.env.WHATSAPP_WORKOUT_TEMPLATE_NAME_EN || 'workout_image_weekly');
      const result = await sendWorkoutImageTemplate(
        senior.phone_number,
        workoutTemplateName,
        workout,
        senior.language
      );

      const status = result.success ? 'sent' : 'failed';
      await logWorkoutSent(senior.id, workout.id, status, 'workout');

      results.push({
        seniorId: senior.id,
        phoneNumber: senior.phone_number,
        workoutTitle: workout.title,
        theme: workout.theme,
        success: result.success,
        messageId: result.messageId,
        error: result.error
      });

      console.log(`[Sunday] Workout ${status} to ${senior.phone_number}: ${workout.title}`);

      // PostHog tracking
      const posthog = getPostHog();
      if (posthog && result.success) {
        posthog.capture({
          distinctId: senior.id,
          event: 'workout_sent',
          properties: {
            language: senior.language,
            workout_title: workout.title,
            theme: workout.theme,
            month: workout.month,
            week_number: workout.week_number
          }
        });
      } else if (posthog && !result.success) {
        posthog.capture({
          distinctId: senior.id,
          event: 'workout_send_failed',
          properties: { language: senior.language, error: String(result.error) }
        });
      }
    } catch (error) {
      console.error(`Error sending workout to senior ${senior.id}:`, error);
      results.push({
        seniorId: senior.id,
        phoneNumber: senior.phone_number,
        success: false,
        error: error.message
      });
    }
  }

  // Admin alert for failures
  const failures = results.filter(r => !r.success);
  if (failures.length > 0 && process.env.ADMIN_PHONE_NUMBER) {
    await sendWhatsAppMessage(process.env.ADMIN_PHONE_NUMBER,
      `⚠️ Estirar Connect: ${failures.length} Sunday workout(s) failed to send. Check Vercel logs.`
    ).catch(e => console.error('Failed to send admin alert:', e));
  }

  return res.json({
    success: true,
    message: `[Sunday] Sent ${results.filter(r => r.success).length}/${results.length} weekly workouts`,
    results
  });
}

async function sendWorkoutReminders(req, res) {
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
      const weekLog = await getThisWeeksWorkoutLog(senior.id);

      if (!weekLog) {
        console.log(`[Reminder] No weekly workout log for senior ${senior.id}, skipping`);
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
        console.log(`[Reminder] Senior ${senior.id} already completed workout, skipping`);
        results.push({
          seniorId: senior.id,
          phoneNumber: senior.phone_number,
          success: true,
          skipped: true,
          reason: 'already_completed'
        });
        continue;
      }

      const workout = weekLog.workouts;
      const reminderMsg = getWorkoutReminderMessage(workout, senior.language);
      const result = await sendWhatsAppMessage(senior.phone_number, reminderMsg);

      const reminderStatus = result.success ? 'sent' : 'failed';
      await logWorkoutSent(senior.id, weekLog.workout_id, reminderStatus, 'workout_reminder');

      results.push({
        seniorId: senior.id,
        phoneNumber: senior.phone_number,
        workoutTitle: workout.title,
        success: result.success,
        skipped: false,
        messageId: result.messageId,
        error: result.error
      });

      console.log(`[Reminder] ${result.success ? 'Sent' : 'Failed'} to ${senior.phone_number}`);

      // PostHog tracking
      const posthog = getPostHog();
      if (posthog && result.success) {
        posthog.capture({
          distinctId: senior.id,
          event: 'workout_reminder_sent',
          properties: { language: senior.language, workout_title: workout?.title }
        });
      }
    } catch (error) {
      console.error(`Error sending workout reminder to senior ${senior.id}:`, error);
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

  // Admin alert for failures
  const reminderFailures = results.filter(r => !r.skipped && !r.success);
  if (reminderFailures.length > 0 && process.env.ADMIN_PHONE_NUMBER) {
    await sendWhatsAppMessage(process.env.ADMIN_PHONE_NUMBER,
      `⚠️ Estirar Connect: ${reminderFailures.length} workout reminder(s) failed to send. Check Vercel logs.`
    ).catch(e => console.error('Failed to send admin alert:', e));
  }

  return res.json({
    success: true,
    message: `[Reminder] Sent: ${sent}, Skipped (completed): ${skippedCompleted}, Skipped (no log): ${skippedNoLog}`,
    results
  });
}

// ---- LEGACY: Video-based functions (kept for backward compatibility) ----

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

      // PostHog tracking
      const posthog = getPostHog();
      if (posthog && result.success) {
        posthog.capture({
          distinctId: senior.id,
          event: 'video_sent',
          properties: { language: senior.language, video_title: video.title, video_sequence: video.sequence_order }
        });
      } else if (posthog && !result.success) {
        posthog.capture({
          distinctId: senior.id,
          event: 'video_send_failed',
          properties: { language: senior.language, error: String(result.error) }
        });
      }
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

  // Admin alert for failures
  const failures = results.filter(r => !r.success);
  if (failures.length > 0 && process.env.ADMIN_PHONE_NUMBER) {
    await sendWhatsAppMessage(process.env.ADMIN_PHONE_NUMBER,
      `⚠️ Estirar Connect: ${failures.length} Sunday video(s) failed to send. Check Vercel logs.`
    ).catch(e => console.error('Failed to send admin alert:', e));
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

      const reminderStatus = result.success ? 'sent' : 'failed';
      await logMessageSent(senior.id, weekLog.video_id, reminderStatus, 'reminder');

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

      // PostHog tracking
      const posthog = getPostHog();
      if (posthog && result.success) {
        posthog.capture({
          distinctId: senior.id,
          event: 'reminder_sent',
          properties: { language: senior.language, video_title: video?.title }
        });
      }
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

  // Admin alert for reminder failures
  const reminderFailures = results.filter(r => !r.skipped && !r.success);
  if (reminderFailures.length > 0 && process.env.ADMIN_PHONE_NUMBER) {
    await sendWhatsAppMessage(process.env.ADMIN_PHONE_NUMBER,
      `⚠️ Estirar Connect: ${reminderFailures.length} reminder(s) failed to send. Check Vercel logs.`
    ).catch(e => console.error('Failed to send admin alert:', e));
  }

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

    if (USE_WORKOUT_IMAGES) {
      // Test with workout image
      const workout = await getWorkoutBySequence(language, 1);

      if (!workout) {
        return res.status(404).json({
          success: false,
          error: `No workout found for language: ${language}`
        });
      }

      const workoutTemplateName = language === 'es'
        ? (process.env.WHATSAPP_WORKOUT_TEMPLATE_NAME_ES || 'imagen_ejercicio_semanal')
        : (process.env.WHATSAPP_WORKOUT_TEMPLATE_NAME_EN || 'workout_image_weekly');
      const result = await sendWorkoutImageTemplate(phoneNumber, workoutTemplateName, workout, language);

      const senior = await getSeniorByPhone(phoneNumber);
      if (senior) {
        const status = result.success ? 'sent' : 'failed';
        await logWorkoutSent(senior.id, workout.id, status, 'workout');
      }

      if (!result.success) {
        return res.status(500).json({ success: false, error: result.error });
      }

      return res.json({
        success: true,
        message: 'Test workout image sent',
        details: {
          phoneNumber,
          workoutTitle: workout.title,
          theme: workout.theme,
          messageId: result.messageId
        }
      });
    }

    // Legacy: test with video
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
