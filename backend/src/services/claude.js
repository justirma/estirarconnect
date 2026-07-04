import Anthropic from '@anthropic-ai/sdk';

// Client is created once at module load — not per request.
// If ANTHROPIC_API_KEY is missing, calls will throw and the caller's catch handles it.
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Generates a reply to a senior's WhatsApp message using Claude.
 *
 * Returns structured data so the caller can:
 * - Send response directly
 * - Detect completions the keyword list missed
 * - Log topic + token counts to PostHog for cost tracking
 *
 * @param {string} message      - The senior's raw message text
 * @param {string} language     - 'en' or 'es'
 * @param {string|null} workoutTitle - Title of this week's workout (optional context)
 * @returns {{ response, isCompletion, topic, inputTokens, outputTokens }}
 */
export async function generateSeniorReply(message, language, workoutTitle = null) {
  const langInstruction = language === 'es' ? 'Respond in Spanish.' : 'Respond in English.';
  const workoutContext = workoutTitle ? `This week's workout is: "${workoutTitle}".` : '';

  // Tight system prompt — keeps Claude on-topic and forces JSON output.
  // JSON output is the key pattern here: instead of parsing free text,
  // we get structured fields we can act on (isCompletion) and log (topic).
  const systemPrompt = `You are a warm, friendly assistant for Estirar Connect, a chair exercise program for seniors. ${langInstruction} ${workoutContext}

Reply to the senior's WhatsApp message helpfully. Keep it short — 2-3 sentences max. Only answer questions about exercises, health, motivation, or this program. If they ask something off-topic, kindly redirect.

If asked how often, how long, or how many times/reps to do the exercises: recommend doing the set daily or every other day, about 5 minutes, 1 round through each exercise — with once a week as the bare minimum.

You MUST respond with valid JSON only — no explanation, no markdown, just the JSON object:
{
  "response": "your reply to the senior",
  "is_completion": false,
  "topic": "question_about_exercise"
}

Valid values for "topic": question_about_exercise | motivation | technical_help | completion | off_topic | other
Set "is_completion" to true only if the message clearly means they finished the workout (e.g. "ya terminé", "done!", "I did it", "lo hice").`;

  // Haiku is cheapest + fast enough for conversational replies (~$0.001 per exchange).
  // max_tokens: 256 is plenty for 2-3 sentence replies and the JSON wrapper.
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    system: systemPrompt,
    messages: [{ role: 'user', content: message }]
  });

  const raw = msg.content[0].text.trim();

  // Strip markdown code fences — Claude sometimes wraps JSON in ```json ``` despite instructions
  const jsonStr = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  const parsed = JSON.parse(jsonStr); // throws if malformed — caller's try/catch handles it

  return {
    response: parsed.response,
    isCompletion: parsed.is_completion === true,
    topic: parsed.topic || 'other',
    // Expose token counts so the caller can log cost to PostHog.
    // Haiku pricing: ~$0.25/M input tokens + $1.25/M output tokens.
    inputTokens: msg.usage.input_tokens,
    outputTokens: msg.usage.output_tokens
  };
}
