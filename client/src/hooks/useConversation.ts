import { useCallback, useEffect, useRef, useState } from 'react';
import { MicVAD } from '@ricky0123/vad-web';
import { AudioEngine, float32ToWav } from '../lib/audio';
import { chat, transcribe, tts, type ChatMessage } from '../lib/api';

export type Status = 'idle' | 'loading' | 'listening' | 'thinking' | 'speaking' | 'error';

// Pin CDN asset paths to the installed package versions (worklet + onnx model
// + onnxruntime wasm are fetched from jsDelivr at runtime).
const VAD_BASE = 'https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.30/dist/';
const ORT_BASE = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/';

/**
 * Hands-free voice loop. Once the session starts, the Silero VAD listens
 * continuously: when the user finishes speaking it transcribes → chats →
 * speaks the reply, then automatically resumes listening. No button press per
 * turn. While the avatar is speaking the VAD is paused to avoid it hearing
 * itself.
 */
export function useConversation() {
  const engineRef = useRef<AudioEngine | null>(null);
  if (!engineRef.current) engineRef.current = new AudioEngine();
  const engine = engineRef.current;

  const vadRef = useRef<MicVAD | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef(false);
  const busyRef = useRef(false);

  const [status, setStatus] = useState<Status>('idle');
  const [active, setActive] = useState(false);
  const [lastUser, setLastUser] = useState('');
  const [lastReply, setLastReply] = useState('');
  const [error, setError] = useState<string | null>(null);

  const messagesRef = useRef<ChatMessage[]>([]);

  // Process one finished utterance, then resume listening.
  const handleUtterance = useCallback(
    async (audio: Float32Array) => {
      if (busyRef.current || !sessionRef.current) return;
      busyRef.current = true;
      try {
        vadRef.current?.pause();
        setStatus('thinking');

        const wav = float32ToWav(audio, 16000);
        const text = (await transcribe(wav)).trim();
        if (!text) {
          if (sessionRef.current) {
            vadRef.current?.start();
            setStatus('listening');
          }
          busyRef.current = false;
          return;
        }

        setLastUser(text);
        const history = [...messagesRef.current, { role: 'user', content: text } as ChatMessage];
        messagesRef.current = history;

        const reply = (await chat(history)).trim();
        setLastReply(reply);
        messagesRef.current = [...history, { role: 'assistant', content: reply }];

        if (reply) {
          setStatus('speaking');
          const audioBytes = await tts(reply);
          await engine.play(audioBytes);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'אירעה שגיאה.');
        setStatus('error');
      } finally {
        busyRef.current = false;
        if (sessionRef.current) {
          vadRef.current?.start();
          setStatus('listening');
        }
      }
    },
    [engine],
  );

  const startSession = useCallback(async () => {
    setError(null);
    setStatus('loading');
    try {
      await engine.ensure();

      const vad = await MicVAD.new({
        model: 'v5',
        baseAssetPath: VAD_BASE,
        onnxWASMBasePath: ORT_BASE,
        // Tuned for natural conversational turn-taking.
        positiveSpeechThreshold: 0.55,
        negativeSpeechThreshold: 0.4,
        redemptionMs: 480, // silence before a turn is considered finished
        minSpeechMs: 200, // ignore very short noise blips
        preSpeechPadMs: 240,
        // Create our own stream so the avatar can visualise the live mic.
        getStream: async () => {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              channelCount: 1,
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
          streamRef.current = stream;
          engine.visualizeStream(stream);
          return stream;
        },
        onSpeechStart: () => {
          if (sessionRef.current && !busyRef.current) setStatus('listening');
        },
        onSpeechEnd: (audio) => {
          void handleUtterance(audio);
        },
      });

      vadRef.current = vad;
      sessionRef.current = true;
      setActive(true);
      vad.start();
      setStatus('listening');
    } catch (err) {
      setError(micErrorMessage(err));
      setStatus('error');
      sessionRef.current = false;
      setActive(false);
    }
  }, [engine, handleUtterance]);

  const stopSession = useCallback(() => {
    sessionRef.current = false;
    busyRef.current = false;
    setActive(false);
    engine.stopPlayback();
    try {
      vadRef.current?.pause();
      vadRef.current?.destroy();
    } catch {
      /* ignore */
    }
    vadRef.current = null;
    engine.unvisualizeStream();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStatus('idle');
  }, [engine]);

  /** Main button: start or stop the hands-free session. */
  const toggle = useCallback(() => {
    if (sessionRef.current) stopSession();
    else void startSession();
  }, [startSession, stopSession]);

  const reset = useCallback(() => {
    messagesRef.current = [];
    setLastUser('');
    setLastReply('');
    setError(null);
    engine.stopPlayback();
  }, [engine]);

  const getLevel = useCallback(() => engine.getLevel(), [engine]);

  // Clean up on unmount.
  useEffect(() => () => stopSession(), [stopSession]);

  return { status, active, lastUser, lastReply, error, toggle, reset, getLevel };
}

function micErrorMessage(err: unknown): string {
  const name = (err as { name?: string })?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'אין הרשאה למיקרופון. אפשר גישה בהגדרות הדפדפן.';
  }
  if (name === 'NotFoundError') return 'לא נמצא מיקרופון במכשיר.';
  return 'לא ניתן להפעיל את מנוע הקול. בדוק חיבור לאינטרנט והרשאות מיקרופון.';
}
