import 'dotenv/config';

/**
 * Centralised, validated configuration for the server.
 * Throws early with a clear message if the OpenAI key is missing so the
 * developer is not confused by opaque 401s at request time.
 */
function required(name) {
  const value = process.env[name];
  if (!value || value.trim() === '' || value.includes('your-key-here')) {
    console.error(
      `\n[config] Missing required env var "${name}".\n` +
        `Copy server/.env.example to server/.env and fill it in.\n`,
    );
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT) || 8787,
  openaiApiKey: required('OPENAI_API_KEY'),
  models: {
    chat: process.env.OPENAI_CHAT_MODEL || 'gpt-4o',
    tts: process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
    // Deep male voice; "onyx"/"ash" are the most male-leaning options.
    ttsVoice: process.env.OPENAI_TTS_VOICE || 'onyx',
    // Style guidance for gpt-4o-mini-tts: synthetic, slightly robotic / alien
    // yet still natural and intelligible. Override via env if desired.
    ttsInstructions:
      process.env.OPENAI_TTS_INSTRUCTIONS ||
      'Speak as a calm, deep male synthetic intelligence. Tone: slightly robotic and otherworldly, like a refined alien AI, yet smooth, clear and realistic — not cartoonish. Steady, controlled pacing, low pitch, minimal emotion, faint metallic resonance. Pronounce Hebrew clearly and naturally.',
    // gpt-4o-transcribe is far more accurate than whisper-1 (esp. for Hebrew).
    transcribe: process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-transcribe',
    // Multimodal model used to read images / camera frames / screenshots.
    vision: process.env.OPENAI_VISION_MODEL || 'gpt-4o',
    // Speech-to-speech model for the optional live "JARVIS" mode (laughs,
    // breaths, barge-in). Requires Realtime API access on the account.
    realtime: process.env.OPENAI_REALTIME_MODEL || 'gpt-4o-realtime-preview',
    realtimeVoice: process.env.OPENAI_REALTIME_VOICE || 'ash',
  },
  corsOrigin: (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  isProduction: process.env.NODE_ENV === 'production',
};
