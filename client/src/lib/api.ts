/** Thin typed wrappers around the server's /api endpoints. */
import type { ChatMessage, ChatResult } from '../types';

export type { ChatMessage };

async function asError(res: Response): Promise<never> {
  let message = `${res.status} ${res.statusText}`;
  try {
    const body = await res.json();
    if (body?.message) message = body.message;
  } catch {
    /* non-JSON error */
  }
  throw new Error(message);
}

/** Send recorded audio, get back Hebrew text. */
export async function transcribe(audio: Blob): Promise<string> {
  const form = new FormData();
  const t = audio.type;
  const ext = t.includes('wav')
    ? 'wav'
    : t.includes('mp4')
      ? 'mp4'
      : t.includes('ogg')
        ? 'ogg'
        : 'webm';
  form.append('audio', audio, `speech.${ext}`);

  const res = await fetch('/api/transcribe', { method: 'POST', body: form });
  if (!res.ok) await asError(res);
  const data = await res.json();
  return (data.text || '').trim();
}

/** Send conversation history (+ memory), get the reply, HUD cards and new facts. */
export async function chat(messages: ChatMessage[], memory: string[] = []): Promise<ChatResult> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, memory }),
  });
  if (!res.ok) await asError(res);
  const data = await res.json();
  return {
    reply: (data.reply || '').trim(),
    cards: Array.isArray(data.cards) ? data.cards : [],
    memory: Array.isArray(data.memory) ? data.memory : [],
  };
}

/** Convert text to spoken Hebrew audio bytes. */
export async function tts(text: string): Promise<ArrayBuffer> {
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) await asError(res);
  return res.arrayBuffer();
}

/** Send an image (camera frame / screenshot / file) → Hebrew description. */
export async function vision(image: Blob, prompt?: string): Promise<string> {
  const form = new FormData();
  form.append('image', image, 'capture.jpg');
  if (prompt) form.append('prompt', prompt);
  const res = await fetch('/api/vision', { method: 'POST', body: form });
  if (!res.ok) await asError(res);
  const data = await res.json();
  return (data.reply || '').trim();
}

/** Summarise a URL (fetched server-side) or raw text → Hebrew summary. */
export async function summarize(input: { url?: string; text?: string }): Promise<string> {
  const res = await fetch('/api/summarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) await asError(res);
  const data = await res.json();
  return (data.reply || '').trim();
}

/** Mint an ephemeral Realtime session (for live speech-to-speech mode). */
export async function realtimeSession(): Promise<{
  client_secret?: { value: string };
  model: string;
  instructions?: string;
}> {
  const res = await fetch('/api/realtime/session', { method: 'POST' });
  if (!res.ok) await asError(res);
  return res.json();
}
