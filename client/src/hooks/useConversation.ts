import { useCallback, useEffect, useRef, useState } from 'react';
import { MicVAD } from '@ricky0123/vad-web';
import { AudioEngine, float32ToWav } from '../lib/audio';
import { chat, transcribe, tts, vision, summarize } from '../lib/api';
import { memory } from '../lib/memory';
import { WakeWord, wakeWordSupported } from '../lib/wakeword';
import { RealtimeSession } from '../lib/realtime';
import type { Card, ChatMessage } from '../types';

export type Status = 'idle' | 'loading' | 'listening' | 'thinking' | 'speaking' | 'error';

const VAD_BASE = 'https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.30/dist/';
const ORT_BASE = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/';
const CARD_TTL = 40000; // auto-dismiss cards after 40s
const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Math.random());

/**
 * The conversation brain. Coordinates the classic hands-free voice loop (VAD →
 * transcribe → chat → speak), the live Realtime mode, vision/summary requests,
 * the HUD cards, persistent memory and the wake word — exposing a single tidy
 * API to the UI.
 */
export function useConversation() {
  const engineRef = useRef<AudioEngine | null>(null);
  if (!engineRef.current) engineRef.current = new AudioEngine();
  const engine = engineRef.current;

  const vadRef = useRef<MicVAD | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef(false);
  const busyRef = useRef(false);
  const rtRef = useRef<RealtimeSession | null>(null);
  const wakeRef = useRef<WakeWord | null>(null);
  const cardTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const [status, setStatus] = useState<Status>('idle');
  const [active, setActive] = useState(false);
  const [live, setLive] = useState(false);
  const [wakeEnabled, setWakeEnabled] = useState(true);
  const [primed, setPrimed] = useState(false);
  const [lastUser, setLastUser] = useState('');
  const [lastReply, setLastReply] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [facts, setFacts] = useState<string[]>(memory.loadFacts());

  const messagesRef = useRef<ChatMessage[]>(memory.loadHistory());

  /** Persist new memory facts and reflect them in state (for the UI section). */
  const remember = useCallback((list: string[]) => {
    if (!list.length) return;
    setFacts(memory.addFacts(list));
  }, []);

  // ---------------------------------------------------------------- cards
  const dismissCard = useCallback((id: string) => {
    setCards((cs) => cs.filter((c) => c.id !== id));
    clearTimeout(cardTimers.current[id]);
    delete cardTimers.current[id];
  }, []);

  const addCard = useCallback(
    (card: Omit<Card, 'id'>) => {
      const id = uid();
      setCards((cs) => [...cs, { ...card, id }].slice(-4));
      cardTimers.current[id] = setTimeout(() => dismissCard(id), CARD_TTL);
    },
    [dismissCard],
  );

  // ---------------------------------------------------------------- speak
  const speak = useCallback(
    async (text: string) => {
      if (!text) return;
      setStatus('speaking');
      const bytes = await tts(text);
      await engine.play(bytes);
    },
    [engine],
  );

  // ---------------------------------------------- classic loop: one utterance
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

        const result = await chat(history, memory.loadFacts());
        const reply = result.reply.trim();
        setLastReply(reply);
        if (result.memory.length) remember(result.memory);
        result.cards.forEach(addCard);

        messagesRef.current = [...history, { role: 'assistant', content: reply }];
        memory.saveHistory(messagesRef.current);

        if (reply) await speak(reply);
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
    [addCard, speak, remember],
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
        positiveSpeechThreshold: 0.55,
        negativeSpeechThreshold: 0.4,
        redemptionMs: 480,
        minSpeechMs: 200,
        preSpeechPadMs: 240,
        getStream: async () => {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
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

  // ------------------------------------------------------------- live mode
  const startLive = useCallback(async () => {
    setError(null);
    setStatus('loading');
    try {
      await engine.ensure();
      const rt = new RealtimeSession({
        onRemoteStream: (s) => void engine.attachRemoteStream(s),
        onMicStream: (s) => engine.visualizeStream(s),
        onUserText: (t) => t && setLastUser(t),
        onAssistantText: (t, final) => {
          setLastReply(t);
          setStatus(final ? 'listening' : 'speaking');
        },
        onCard: addCard,
        onMemory: (f) => remember([f]),
        onStatus: (s, msg) => {
          if (s === 'live') {
            setLive(true);
            setStatus('listening');
          } else if (s === 'error') {
            setError(msg || 'מצב חי נכשל.');
            setStatus('error');
          }
        },
      });
      await rt.connect('');
      rtRef.current = rt;
      setLive(true);
    } catch (err) {
      setLive(false);
      rtRef.current = null;
      setError(
        err instanceof Error && /unavailable|handshake/i.test(err.message)
          ? 'מצב חי לא זמין בחשבון ה-OpenAI. ממשיך במצב הרגיל.'
          : 'לא ניתן להפעיל מצב חי.',
      );
      setStatus('idle');
    }
  }, [engine, addCard, remember]);

  const stopLive = useCallback(() => {
    rtRef.current?.close();
    rtRef.current = null;
    engine.detachRemoteStream();
    engine.unvisualizeStream();
    setLive(false);
    setStatus('idle');
  }, [engine]);

  const toggleLive = useCallback(() => {
    if (rtRef.current) stopLive();
    else void startLive();
  }, [startLive, stopLive]);

  /** Main button: start or stop the hands-free session. */
  const toggle = useCallback(() => {
    if (live) return; // live mode owns the mic; ignore the classic button
    if (sessionRef.current) stopSession();
    else void startSession();
  }, [live, startSession, stopSession]);

  // --------------------------------------------------- vision & summarise
  const runOneShot = useCallback(
    async (work: () => Promise<{ reply: string; card: Omit<Card, 'id'> }>) => {
      setError(null);
      const wasListening = sessionRef.current;
      try {
        if (wasListening) vadRef.current?.pause();
        await engine.ensure();
        setStatus('thinking');
        const { reply, card } = await work();
        setLastReply(reply);
        addCard(card);
        messagesRef.current = [...messagesRef.current, { role: 'assistant', content: reply }];
        memory.saveHistory(messagesRef.current);
        if (reply) await speak(reply);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'אירעה שגיאה.');
        setStatus('error');
      } finally {
        if (sessionRef.current) {
          vadRef.current?.start();
          setStatus('listening');
        } else {
          setStatus('idle');
        }
      }
    },
    [engine, addCard, speak],
  );

  const describeImage = useCallback(
    (image: Blob, prompt?: string) =>
      runOneShot(async () => {
        const reply = await vision(image, prompt);
        return { reply, card: { kind: 'vision', title: 'מה אני רואה', body: reply } as Omit<Card, 'id'> };
      }),
    [runOneShot],
  );

  const summarizeUrl = useCallback(
    (url: string) =>
      runOneShot(async () => {
        const reply = await summarize({ url });
        return {
          reply,
          card: { kind: 'summary', title: 'סיכום', body: reply, source: url } as Omit<Card, 'id'>,
        };
      }),
    [runOneShot],
  );

  // ----------------------------------------------------------- misc / reset
  const reset = useCallback(() => {
    messagesRef.current = [];
    memory.clearHistory();
    setLastUser('');
    setLastReply('');
    setError(null);
    setCards([]);
    engine.stopPlayback();
  }, [engine]);

  const clearMemory = useCallback(() => {
    memory.clearFacts();
    setFacts([]);
  }, []);
  const getLevel = useCallback(() => engine.getLevel(), [engine]);

  /**
   * First user gesture: unlock audio (required on iOS) and immediately begin
   * hands-free listening, so from here on the user just talks — no per-turn
   * taps, and no reliance on the wake word (which iOS Safari doesn't support).
   */
  const prime = useCallback(async () => {
    setPrimed(true);
    try {
      await engine.ensure();
      await startSession();
    } catch {
      /* startSession already surfaces mic errors */
    }
  }, [engine, startSession]);

  // ----------------------------------------------------------- wake word
  useEffect(() => {
    if (!wakeEnabled || !primed || active || live) {
      wakeRef.current?.stop();
      wakeRef.current = null;
      return;
    }
    const wake = new WakeWord(() => void startSession());
    wake.start();
    wakeRef.current = wake;
    return () => {
      wake.stop();
      wakeRef.current = null;
    };
  }, [wakeEnabled, primed, active, live, startSession]);

  // Clean up everything on unmount.
  useEffect(
    () => () => {
      stopSession();
      stopLive();
      wakeRef.current?.stop();
      Object.values(cardTimers.current).forEach(clearTimeout);
    },
    [stopSession, stopLive],
  );

  return {
    status,
    active,
    live,
    primed,
    wakeEnabled,
    wakeSupported: wakeWordSupported(),
    lastUser,
    lastReply,
    error,
    cards,
    facts,
    prime,
    toggle,
    toggleLive,
    setWakeEnabled,
    dismissCard,
    describeImage,
    summarizeUrl,
    reset,
    clearMemory,
    getLevel,
  };
}

/** The full conversation API, for components that receive it as a prop. */
export type Conversation = ReturnType<typeof useConversation>;

function micErrorMessage(err: unknown): string {
  const name = (err as { name?: string })?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'אין הרשאה למיקרופון. אפשר גישה בהגדרות הדפדפן.';
  }
  if (name === 'NotFoundError') return 'לא נמצא מיקרופון במכשיר.';
  return 'לא ניתן להפעיל את מנוע הקול. בדוק חיבור לאינטרנט והרשאות מיקרופון.';
}
