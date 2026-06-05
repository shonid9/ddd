import { Router } from 'express';
import multer from 'multer';
import OpenAI, { toFile } from 'openai';
import { config } from './config.js';
import { SYSTEM_PROMPT, REALTIME_INSTRUCTIONS, VISION_PROMPT, SUMMARY_PROMPT } from './prompt.js';
import { TOOLS, parseResponse } from './tools.js';

const openai = new OpenAI({ apiKey: config.openaiApiKey });

// Audio/image uploads are small; keep them in memory and cap the size.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

export const router = Router();

/** Tiny async wrapper so route handlers can throw and hit the error middleware. */
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Compose the system instructions, folding in any remembered user facts. */
function buildInstructions(memory) {
  const facts = Array.isArray(memory)
    ? memory.map((m) => String(m).slice(0, 300)).filter(Boolean).slice(0, 30)
    : [];
  if (facts.length === 0) return SYSTEM_PROMPT;
  return `${SYSTEM_PROMPT}\n\nמה שאתה כבר יודע על המשתמש (השתמש בזה בטבעיות, אל תכריז עליו):\n- ${facts.join('\n- ')}`;
}

/**
 * POST /api/transcribe — multipart "audio" → { text }  (Hebrew).
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
      prompt:
        'תמלול שיחה בעברית מדוברת וטבעית. כתוב בעברית תקנית עם ניקוד פיסוק נכון, ושמור על שמות, מספרים ומונחים מדויקים.',
      response_format: 'json',
      temperature: 0,
    });

    res.json({ text: (result.text || '').trim() });
  }),
);

/**
 * POST /api/chat
 * Body: { messages: [{ role, content }], memory?: string[] }
 * Returns: { reply, cards, memory }
 */
router.post(
  '/chat',
  wrap(async (req, res) => {
    const history = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const sanitized = history
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

    if (sanitized.length === 0) {
      return res.status(400).json({ error: 'empty_messages', message: 'No messages provided.' });
    }

    const instructions = buildInstructions(req.body?.memory);

    // Primary path: Responses API with live web search + HUD/memory tools.
    try {
      const response = await openai.responses.create({
        model: config.models.chat,
        instructions,
        input: sanitized,
        tools: TOOLS,
        max_output_tokens: 900,
      });
      const parsed = parseResponse(response);
      if (parsed.reply || parsed.cards.length) {
        return res.json(parsed);
      }
    } catch (err) {
      console.warn('[chat] responses/tools path failed, falling back:', err?.message || err);
    }

    // Fallback: plain chat completion (no tools), still works without Responses.
    const completion = await openai.chat.completions.create({
      model: config.models.chat,
      temperature: 0.6,
      max_tokens: 800,
      messages: [{ role: 'system', content: instructions }, ...sanitized],
    });
    res.json({ reply: completion.choices[0]?.message?.content?.trim() || '', cards: [], memory: [] });
  }),
);

/**
 * POST /api/vision — multipart "image" (+ optional "prompt") → { reply }.
 * Reads a camera frame / screenshot / document and summarises it in Hebrew.
 */
router.post(
  '/vision',
  upload.single('image'),
  wrap(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'missing_image', message: 'No image received.' });
    }
    const dataUrl = `data:${req.file.mimetype || 'image/jpeg'};base64,${req.file.buffer.toString('base64')}`;
    const ask = (req.body?.prompt || 'תאר ותסכם בעברית מה רואים בתמונה.').toString().slice(0, 1000);

    const completion = await openai.chat.completions.create({
      model: config.models.vision,
      max_tokens: 600,
      messages: [
        { role: 'system', content: VISION_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: ask },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
    });

    res.json({ reply: completion.choices[0]?.message?.content?.trim() || '' });
  }),
);

/**
 * POST /api/summarize — { url?: string, text?: string } → { reply }.
 * Fetches a URL server-side (or takes raw text) and summarises it in Hebrew.
 */
router.post(
  '/summarize',
  wrap(async (req, res) => {
    let source = (req.body?.text || '').toString();
    const url = (req.body?.url || '').toString().trim();

    if (!source && url) {
      if (!/^https?:\/\//i.test(url)) {
        return res.status(400).json({ error: 'bad_url', message: 'Invalid URL.' });
      }
      const r = await fetch(url, { headers: { 'User-Agent': 'OracleBot/1.0' } });
      const html = await r.text();
      source = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    source = source.slice(0, 14000);
    if (!source) {
      return res.status(400).json({ error: 'empty_source', message: 'Nothing to summarise.' });
    }

    const completion = await openai.chat.completions.create({
      model: config.models.chat,
      temperature: 0.4,
      max_tokens: 700,
      messages: [
        { role: 'system', content: SUMMARY_PROMPT },
        { role: 'user', content: source },
      ],
    });

    res.json({ reply: completion.choices[0]?.message?.content?.trim() || '' });
  }),
);

/**
 * POST /api/tts — { text, voice? } → audio/mpeg.
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
      instructions: config.models.ttsInstructions,
      response_format: 'mp3',
    });

    const buffer = Buffer.from(await speech.arrayBuffer());
    res.set('Content-Type', 'audio/mpeg');
    res.set('Content-Length', String(buffer.length));
    res.set('Cache-Control', 'no-store');
    res.send(buffer);
  }),
);

/**
 * POST /api/realtime/session — mint a short-lived ephemeral key so the browser
 * can open a WebRTC Realtime session directly with OpenAI (the real API key
 * never leaves the server). Returns the raw session JSON from OpenAI.
 */
router.post(
  '/realtime/session',
  wrap(async (req, res) => {
    const r = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.openaiApiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'realtime=v1',
      },
      body: JSON.stringify({
        model: config.models.realtime,
        voice: config.models.realtimeVoice,
        instructions: REALTIME_INSTRUCTIONS,
      }),
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return res
        .status(r.status)
        .json({ error: 'realtime_unavailable', message: data?.error?.message || 'Realtime API unavailable.' });
    }
    res.json({
      ...data,
      model: config.models.realtime,
      voice: config.models.realtimeVoice,
      instructions: REALTIME_INSTRUCTIONS,
    });
  }),
);

export default router;
