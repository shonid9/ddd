/**
 * AudioEngine owns a single AudioContext + AnalyserNode.
 *
 * Both the microphone (while listening) and the spoken reply (while speaking)
 * are routed through the analyser, so `getLevel()` always reflects whatever
 * sound the avatar should be reacting to — that single number drives the
 * liquid-eye shader.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private freqData: Uint8Array<ArrayBuffer> = new Uint8Array(0);

  private mediaStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];

  private currentSource: AudioBufferSourceNode | null = null;

  /** Lazily create/resume the context — must run inside a user gesture on iOS. */
  async ensure(): Promise<AudioContext> {
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new Ctor();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.8;
      this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    return this.ctx;
  }

  /** Current loudness 0..1, perceptually weighted, for the avatar. */
  getLevel(): number {
    if (!this.analyser) return 0;
    this.analyser.getByteFrequencyData(this.freqData);
    let sum = 0;
    for (let i = 0; i < this.freqData.length; i++) {
      const v = this.freqData[i] / 255;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / this.freqData.length);
    // Expand the useful range and clamp.
    return Math.min(1, Math.pow(rms, 0.7) * 2.2);
  }

  // ----------------------------------------------------------- recording
  async startRecording(): Promise<void> {
    const ctx = await this.ensure();
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    this.micSource = ctx.createMediaStreamSource(this.mediaStream);
    this.micSource.connect(this.analyser!); // feed the visualiser, not the speakers

    const mimeType = pickMimeType();
    this.recorder = new MediaRecorder(this.mediaStream, mimeType ? { mimeType } : undefined);
    this.chunks = [];
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start();
  }

  /** Stops recording and resolves with the captured audio Blob. */
  stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const rec = this.recorder;
      if (!rec) return reject(new Error('not recording'));
      rec.onstop = () => {
        const type = rec.mimeType || 'audio/webm';
        const blob = new Blob(this.chunks, { type });
        this.teardownMic();
        resolve(blob);
      };
      rec.stop();
    });
  }

  cancelRecording(): void {
    try {
      this.recorder?.stop();
    } catch {
      /* ignore */
    }
    this.teardownMic();
  }

  private teardownMic(): void {
    this.micSource?.disconnect();
    this.micSource = null;
    this.mediaStream?.getTracks().forEach((t) => t.stop());
    this.mediaStream = null;
    this.recorder = null;
    this.chunks = [];
  }

  // ----------------------------------------------------------- playback
  /** Decodes and plays audio bytes through the analyser. Resolves when done. */
  async play(data: ArrayBuffer): Promise<void> {
    const ctx = await this.ensure();
    const buffer = await ctx.decodeAudioData(data.slice(0));
    this.stopPlayback();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.analyser!);
    this.currentSource = source;
    return new Promise((resolve) => {
      source.onended = () => {
        if (this.currentSource === source) this.currentSource = null;
        resolve();
      };
      source.start();
    });
  }

  stopPlayback(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch {
        /* already stopped */
      }
      this.currentSource = null;
    }
  }
}

/** Pick a MediaRecorder mime type the current browser actually supports. */
function pickMimeType(): string | undefined {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return undefined;
  return candidates.find((c) => MediaRecorder.isTypeSupported(c));
}
