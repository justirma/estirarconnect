import { supabase } from '../config/supabase.js';

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

export async function logMessageSent(seniorId, videoId, status = 'sent') {
  const { data, error } = await supabase
    .from('logs')
    .insert({
      senior_id: seniorId,
      video_id: videoId,
      status: status
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
  // Find the most recent log entry for this senior
  const { data: lastLog } = await supabase
    .from('logs')
    .select('id')
    .eq('senior_id', seniorId)
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
    .select('id, sent_at, status, reply_text, replied_at, completed, seniors(phone_number, language), videos(title, youtube_url)')
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
