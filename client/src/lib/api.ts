/** Thin typed wrappers around the server's /api endpoints. */

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

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
  const ext = audio.type.includes('mp4') ? 'mp4' : audio.type.includes('ogg') ? 'ogg' : 'webm';
  form.append('audio', audio, `speech.${ext}`);

  const res = await fetch('/api/transcribe', { method: 'POST', body: form });
  if (!res.ok) await asError(res);
  const data = await res.json();
  return (data.text || '').trim();
}

/** Send conversation history, get back the assistant's Hebrew reply. */
export async function chat(messages: ChatMessage[]): Promise<string> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) await asError(res);
  const data = await res.json();
  return (data.reply || '').trim();
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
