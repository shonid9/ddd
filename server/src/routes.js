import { Router } from 'express';
import multer from 'multer';
import OpenAI, { toFile } from 'openai';
import { config } from './config.js';
import { SYSTEM_PROMPT } from './prompt.js';

const openai = new OpenAI({ apiKey: config.openaiApiKey });

// Audio uploads are small; keep them in memory and cap the size defensively.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

export const router = Router();

/** Tiny async wrapper so route handlers can throw and hit the error middleware. */
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/**
 * POST /api/transcribe
 * Body: multipart/form-data with field "audio".
 * Returns: { text }
 */
router.post(
  '/transcribe',
  upload.single('audio'),
  wrap(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'missing_audio', message: 'No audio file received.' });
    }

    const file = await toFile(req.file.buffer, req.file.originalname || 'audio.webm', {
      type: req.file.mimetype || 'audio/webm',
    });

    const result = await openai.audio.transcriptions.create({
      file,
      model: config.models.transcribe,
      language: 'he',
    });

    res.json({ text: (result.text || '').trim() });
  }),
);

/**
 * POST /api/chat
 * Body: { messages: [{ role, content }] }  (history, newest last)
 * Returns: { reply }
 */
router.post(
  '/chat',
  wrap(async (req, res) => {
    const history = Array.isArray(req.body?.messages) ? req.body.messages : [];

    // Keep only the safe fields and a bounded window of recent turns.
    const sanitized = history
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

    if (sanitized.length === 0) {
      return res.status(400).json({ error: 'empty_messages', message: 'No messages provided.' });
    }

    const completion = await openai.chat.completions.create({
      model: config.models.chat,
      temperature: 0.7,
      max_tokens: 500,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...sanitized],
    });

    const reply = completion.choices[0]?.message?.content?.trim() || '';
    res.json({ reply });
  }),
);

/**
 * POST /api/tts
 * Body: { text, voice? }
 * Returns: audio/mpeg stream
 */
router.post(
  '/tts',
  wrap(async (req, res) => {
    const text = (req.body?.text || '').toString().trim();
    if (!text) {
      return res.status(400).json({ error: 'empty_text', message: 'No text to speak.' });
    }

    const speech = await openai.audio.speech.create({
      model: config.models.tts,
      voice: (req.body?.voice || config.models.ttsVoice).toString(),
      input: text.slice(0, 4000),
      response_format: 'mp3',
    });

    const buffer = Buffer.from(await speech.arrayBuffer());
    res.set('Content-Type', 'audio/mpeg');
    res.set('Content-Length', String(buffer.length));
    res.set('Cache-Control', 'no-store');
    res.send(buffer);
  }),
);

export default router;
