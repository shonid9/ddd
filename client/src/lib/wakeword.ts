/**
 * Wake-word listener built on the browser SpeechRecognition API (Hebrew).
 *
 * Runs only while the session is idle: it continuously listens for a trigger
 * phrase ("אורקל" / "היי אורקל") and fires `onWake`. It deliberately stops
 * while a full conversation session is active so it doesn't fight the VAD for
 * the microphone.
 */
type SR = typeof window & {
  SpeechRecognition?: new () => SpeechRecognition;
  webkitSpeechRecognition?: new () => SpeechRecognition;
};

const TRIGGERS = ['אורקל', 'הי אורקל', 'היי אורקל', 'אוקיי אורקל', 'oracle', 'hey oracle'];

export function wakeWordSupported(): boolean {
  const w = window as SR;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export class WakeWord {
  private recog: SpeechRecognition | null = null;
  private running = false;
  private onWake: () => void;

  constructor(onWake: () => void) {
    this.onWake = onWake;
  }

  start(): void {
    if (this.running || !wakeWordSupported()) return;
    const w = window as SR;
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition!;
    const recog = new Ctor();
    recog.lang = 'he-IL';
    recog.continuous = true;
    recog.interimResults = true;

    recog.onresult = (ev: SpeechRecognitionEvent) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const text = ev.results[i][0].transcript.toLowerCase();
        if (TRIGGERS.some((t) => text.includes(t))) {
          this.stop();
          this.onWake();
          return;
        }
      }
    };
    // Keep it alive: Chrome stops recognition periodically; restart while running.
    recog.onend = () => {
      if (this.running) {
        try {
          recog.start();
        } catch {
          /* already started */
        }
      }
    };
    recog.onerror = () => {
      /* transient (no-speech / network) — onend will restart */
    };

    this.recog = recog;
    this.running = true;
    try {
      recog.start();
    } catch {
      /* ignore double-start */
    }
  }

  stop(): void {
    this.running = false;
    if (this.recog) {
      try {
        this.recog.onend = null;
        this.recog.stop();
      } catch {
        /* ignore */
      }
      this.recog = null;
    }
  }
}
