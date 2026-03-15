import { supabase } from '../config/supabase.js';

export async function insertSenior(phone, name, language) {
  const { data, error } = await supabase
    .from('seniors')
    .insert([{ phone_number: phone, name, language, active: true }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getActiveSeniors() {
  const { data, error } = await supabase
    .from('seniors')
    .select('*')
    .eq('active', true);

  if (error) {
    console.error('Error fetching seniors:', error);
    throw error;
  }

  return data;
}

export async function getSeniorByPhone(phoneNumber) {
  // Normalize: WhatsApp sends '13055629885', DB stores '+13055629885'
  const normalized = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
  const { data, error } = await supabase
    .from('seniors')
    .select('*')
    .eq('phone_number', normalized)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching senior:', error);
    throw error;
  }

  return data;
}

export async function getNextVideoForSenior(seniorId, language) {
  // Get the last video sent to this senior
  const { data: lastLog, error: lastLogError } = await supabase
    .from('logs')
    .select('video_id, videos(sequence_order)')
    .eq('senior_id', seniorId)
    .order('sent_at', { ascending: false })
    .limit(1)
    .single();

  if (lastLogError && lastLogError.code !== 'PGRST116') {
    console.error('Error fetching last log for senior:', lastLogError);
    throw lastLogError;
  }

  let nextSequence = 1;

  if (lastLog?.videos?.sequence_order) {
    // Get the next video in sequence
    const { data: nextVideo, error: nextVideoError } = await supabase
      .from('videos')
      .select('*')
      .eq('language', language)
      .gt('sequence_order', lastLog.videos.sequence_order)
      .order('sequence_order', { ascending: true })
      .limit(1)
      .single();

    if (nextVideoError && nextVideoError.code !== 'PGRST116') {
      console.error('Error fetching next video:', nextVideoError);
      throw nextVideoError;
    }

    if (nextVideo) {
      return nextVideo;
    }

    // If no next video, cycle back to first
    nextSequence = 1;
  }

  // Get first video or cycle back to beginning
  const { data: video, error } = await supabase
    .from('videos')
    .select('*')
    .eq('language', language)
    .eq('sequence_order', nextSequence)
    .single();

  if (error) {
    console.error('Error fetching video:', error);
    throw error;
  }

  return video;
}

export async function deactivateSenior(seniorId) {
  const { data, error } = await supabase
    .from('seniors')
    .update({ active: false })
    .eq('id', seniorId)
    .select()
    .single();

  if (error) {
    console.error('Error deactivating senior:', error);
    throw error;
  }

  return data;
}

export async function reactivateSenior(seniorId) {
  const { data, error } = await supabase
    .from('seniors')
    .update({ active: true })
    .eq('id', seniorId)
    .select()
    .single();

  if (error) {
    console.error('Error reactivating senior:', error);
    throw error;
  }

  return data;
}

export async function logMessageSent(seniorId, videoId, status = 'sent', type = 'video') {
  const { data, error } = await supabase
    .from('logs')
    .insert({
      senior_id: seniorId,
      video_id: videoId,
      status: status,
      type: type
    })
    .select()
    .single();

  if (error) {
    console.error('Error logging message:', error);
    throw error;
  }

  return data;
}

export async function logReply(seniorId, replyText, isCompletion = false) {
  // Find the most recent video log entry for this senior (not reminder logs)
  const { data: lastLog } = await supabase
    .from('logs')
    .select('id')
    .eq('senior_id', seniorId)
    .eq('type', 'video')
    .is('replied_at', null)
    .order('sent_at', { ascending: false })
    .limit(1)
    .single();

  if (!lastLog) {
    console.warn('No recent log found to update with reply');
    return null;
  }

  const updateData = {
    reply_text: replyText,
    replied_at: new Date().toISOString(),
    status: 'read'
  };

  if (isCompletion) {
    updateData.completed = true;
  }

  const { data, error } = await supabase
    .from('logs')
    .update(updateData)
    .eq('id', lastLog.id)
    .select()
    .single();

  if (error) {
    console.error('Error logging reply:', error);
    throw error;
  }

  return data;
}

export async function getCompletionStreak(seniorId) {
  // Only count logs from the weekly model onward to avoid inflated streaks
  const WEEKLY_MODEL_START = '2026-02-08T00:00:00Z';

  const { data, error } = await supabase
    .from('logs')
    .select('completed, sent_at')
    .eq('senior_id', seniorId)
    .gte('sent_at', WEEKLY_MODEL_START)
    .in('type', ['video', 'workout'])
    .order('sent_at', { ascending: false })
    .limit(52);

  if (error || !data) return 0;

  let streak = 0;
  for (const log of data) {
    if (log.completed) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

export async function getThisWeeksLog(seniorId) {
  const now = new Date();
  const daysSinceSunday = now.getUTCDay(); // 0=Sun, 1=Mon, ... 6=Sat
  const startOfWeek = new Date(now);
  startOfWeek.setUTCDate(now.getUTCDate() - daysSinceSunday);
  startOfWeek.setUTCHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('logs')
    .select('id, senior_id, video_id, sent_at, completed, replied_at, videos(title, youtube_url)')
    .eq('senior_id', seniorId)
    .gte('sent_at', startOfWeek.toISOString())
    .eq('type', 'video')
    .order('sent_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching this week log:', error);
    throw error;
  }

  return data;
}

export async function markIncompleteLogsAsSkipped(seniorId) {
  const { data, error } = await supabase
    .from('logs')
    .update({ status: 'skipped' })
    .eq('senior_id', seniorId)
    .in('type', ['video', 'workout'])
    .eq('status', 'sent')
    .is('completed', null)
    .select();

  if (error) {
    console.error('Error marking logs as skipped:', error);
    throw error;
  }

  return data;
}

export async function getVideoBySequence(language, sequenceOrder = 1) {
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .eq('language', language)
    .eq('sequence_order', sequenceOrder)
    .single();

  if (error) {
    console.error('Error fetching video by sequence:', error);
    throw error;
  }

  return data;
}

export async function getRecentLogsWithDetails(limit = 50) {
  const { data, error } = await supabase
    .from('logs')
    .select('id, sent_at, status, type, reply_text, replied_at, completed, seniors(name, phone_number, language), videos(title, youtube_url), workouts(title, image_url, theme)')
    .order('sent_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching recent logs:', error);
    throw error;
  }

  return data;
}

export async function getAllVideos() {
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .order('sequence_order', { ascending: true });

  if (error) {
    console.error('Error fetching videos:', error);
    throw error;
  }

  return data;
}

// ---- Workout-based functions (image program model) ----

export async function getCurrentWorkout(language) {
  const now = new Date();
  const currentMonth = now.getUTCMonth() + 1; // 1-12
  const currentYear = now.getUTCFullYear();

  // Calculate which week of the month we're in (1-5)
  const firstDayOfMonth = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
  const dayOfMonth = now.getUTCDate();
  const weekOfMonth = Math.ceil(dayOfMonth / 7);

  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .eq('language', language)
    .eq('year', currentYear)
    .eq('month', currentMonth)
    .eq('week_number', weekOfMonth)
    .eq('active', true)
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching current workout:', error);
    throw error;
  }

  return data;
}

export async function getNextWorkoutForSenior(seniorId, language) {
  // First try to get a workout for the current week/month
  const currentWorkout = await getCurrentWorkout(language);
  if (currentWorkout) return currentWorkout;

  // Fallback: get the next workout by sequence order (cycling)
  const { data: lastLog } = await supabase
    .from('logs')
    .select('workout_id, workouts(sequence_order)')
    .eq('senior_id', seniorId)
    .eq('type', 'workout')
    .not('workout_id', 'is', null)
    .order('sent_at', { ascending: false })
    .limit(1)
    .single();

  let nextSequence = 1;

  if (lastLog?.workouts?.sequence_order) {
    const { data: nextWorkout } = await supabase
      .from('workouts')
      .select('*')
      .eq('language', language)
      .eq('active', true)
      .gt('sequence_order', lastLog.workouts.sequence_order)
      .order('sequence_order', { ascending: true })
      .limit(1)
      .single();

    if (nextWorkout) return nextWorkout;
  }

  // Cycle back to first
  const { data: firstWorkout, error } = await supabase
    .from('workouts')
    .select('*')
    .eq('language', language)
    .eq('active', true)
    .eq('sequence_order', nextSequence)
    .single();

  if (error) {
    console.error('Error fetching fallback workout:', error);
    throw error;
  }

  return firstWorkout;
}

export async function logWorkoutSent(seniorId, workoutId, status = 'sent', type = 'workout') {
  const { data, error } = await supabase
    .from('logs')
    .insert({
      senior_id: seniorId,
      workout_id: workoutId,
      status: status,
      type: type
    })
    .select()
    .single();

  if (error) {
    console.error('Error logging workout message:', error);
    throw error;
  }

  return data;
}

export async function getThisWeeksWorkoutLog(seniorId) {
  const now = new Date();
  const daysSinceSunday = now.getUTCDay();
  const startOfWeek = new Date(now);
  startOfWeek.setUTCDate(now.getUTCDate() - daysSinceSunday);
  startOfWeek.setUTCHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('logs')
    .select('id, senior_id, workout_id, sent_at, completed, replied_at, workouts(title, image_url, theme)')
    .eq('senior_id', seniorId)
    .gte('sent_at', startOfWeek.toISOString())
    .eq('type', 'workout')
    .order('sent_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching this week workout log:', error);
    throw error;
  }

  return data;
}

export async function logWorkoutReply(seniorId, replyText, isCompletion = false) {
  // Find the most recent workout log entry (not reminder)
  const { data: lastLog } = await supabase
    .from('logs')
    .select('id')
    .eq('senior_id', seniorId)
    .eq('type', 'workout')
    .is('replied_at', null)
    .order('sent_at', { ascending: false })
    .limit(1)
    .single();

  if (!lastLog) {
    // Try video-based log as fallback (transition period: senior may have
    // a video log from before the switch or a workout log already replied to)
    console.warn(`No unreplied workout log found for senior ${seniorId}, trying video fallback`);
    return await logReply(seniorId, replyText, isCompletion);
  }

  const updateData = {
    reply_text: replyText,
    replied_at: new Date().toISOString(),
    status: 'read'
  };

  if (isCompletion) {
    updateData.completed = true;
  }

  const { data, error } = await supabase
    .from('logs')
    .update(updateData)
    .eq('id', lastLog.id)
    .select()
    .single();

  if (error) {
    console.error('Error logging workout reply:', error);
    throw error;
  }

  return data;
}

export async function getAllWorkouts() {
  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .eq('active', true)
    .order('year', { ascending: true })
    .order('month', { ascending: true })
    .order('week_number', { ascending: true });

  if (error) {
    console.error('Error fetching workouts:', error);
    throw error;
  }

  return data;
}

export async function getWorkoutBySequence(language, sequenceOrder = 1) {
  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .eq('language', language)
    .eq('active', true)
    .eq('sequence_order', sequenceOrder)
    .single();

  if (error) {
    console.error('Error fetching workout by sequence:', error);
    throw error;
  }

  return data;
}
