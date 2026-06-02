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
    ttsVoice: process.env.OPENAI_TTS_VOICE || 'shimmer',
    transcribe: process.env.OPENAI_TRANSCRIBE_MODEL || 'whisper-1',
  },
  corsOrigin: (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  isProduction: process.env.NODE_ENV === 'production',
};
