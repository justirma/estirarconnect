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
  const { data, error } = await supabase
    .from('seniors')
    .select('*')
    .eq('phone_number', phoneNumber)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching senior:', error);
    throw error;
  }

  return data;
}

export async function getNextVideoForSenior(seniorId, language) {
  // Get the last video sent to this senior
  const { data: lastLog } = await supabase
    .from('logs')
    .select('video_id, videos(sequence_order)')
    .eq('senior_id', seniorId)
    .order('sent_at', { ascending: false })
    .limit(1)
    .single();

  let nextSequence = 1;

  if (lastLog?.videos?.sequence_order) {
    // Get the next video in sequence
    const { data: nextVideo } = await supabase
      .from('videos')
      .select('*')
      .eq('language', language)
      .gt('sequence_order', lastLog.videos.sequence_order)
      .order('sequence_order', { ascending: true })
      .limit(1)
      .single();

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

export async function logReply(seniorId, replyText) {
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

  const { data, error } = await supabase
    .from('logs')
    .update({
      reply_text: replyText,
      replied_at: new Date().toISOString()
    })
    .eq('id', lastLog.id)
    .select()
    .single();

  if (error) {
    console.error('Error logging reply:', error);
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
