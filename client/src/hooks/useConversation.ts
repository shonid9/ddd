import { useCallback, useRef, useState } from 'react';
import { AudioEngine } from '../lib/audio';
import { chat, transcribe, tts, type ChatMessage } from '../lib/api';

export type Status = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

export interface ConversationState {
  status: Status;
  messages: ChatMessage[];
  lastUser: string;
  lastReply: string;
  error: string | null;
}

/**
 * Drives the full voice loop: record → transcribe → chat → speak.
 * Exposes the AudioEngine so the avatar can read the live level.
 */
export function useConversation() {
  const engineRef = useRef<AudioEngine | null>(null);
  if (!engineRef.current) engineRef.current = new AudioEngine();
  const engine = engineRef.current;

  const [status, setStatus] = useState<Status>('idle');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastUser, setLastUser] = useState('');
  const [lastReply, setLastReply] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Keep a ref of messages so the async loop always sees the latest history.
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  const beginListening = useCallback(async () => {
    setError(null);
    try {
      engine.stopPlayback();
      await engine.startRecording();
      setStatus('listening');
    } catch (err) {
      setStatus('error');
      setError(micErrorMessage(err));
    }
  }, [engine]);

  const finishAndRespond = useCallback(async () => {
    setStatus('thinking');
    try {
      const blob = await engine.stopRecording();
      const text = await transcribe(blob);

      if (!text) {
        setStatus('idle');
        setError('לא שמעתי כלום. נסה שוב.');
        return;
      }

      setLastUser(text);
      const userMsg: ChatMessage = { role: 'user', content: text };
      const history = [...messagesRef.current, userMsg];
      setMessages(history);

      const reply = await chat(history);
      setLastReply(reply);
      setMessages([...history, { role: 'assistant', content: reply }]);

      setStatus('speaking');
      const audio = await tts(reply);
      await engine.play(audio);

      setStatus('idle');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'אירעה שגיאה.');
    }
  }, [engine]);

  /** Main button handler — toggles between listening and responding. */
  const toggle = useCallback(() => {
    if (status === 'idle' || status === 'error') {
      void beginListening();
    } else if (status === 'listening') {
      void finishAndRespond();
    } else if (status === 'speaking') {
      // Interrupt the reply and go back to idle.
      engine.stopPlayback();
      setStatus('idle');
    }
    // 'thinking' is intentionally non-interactive.
  }, [status, beginListening, finishAndRespond, engine]);

  const reset = useCallback(() => {
    engine.stopPlayback();
    engine.cancelRecording();
    setMessages([]);
    setLastUser('');
    setLastReply('');
    setError(null);
    setStatus('idle');
  }, [engine]);

  const getLevel = useCallback(() => engine.getLevel(), [engine]);

  return { status, messages, lastUser, lastReply, error, toggle, reset, getLevel };
}

function micErrorMessage(err: unknown): string {
  const name = (err as { name?: string })?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'אין הרשאה למיקרופון. אפשר גישה בהגדרות הדפדפן.';
  }
  if (name === 'NotFoundError') return 'לא נמצא מיקרופון במכשיר.';
  return 'לא ניתן לגשת למיקרופון.';
}
