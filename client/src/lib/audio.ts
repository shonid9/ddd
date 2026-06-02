/**
 * AudioEngine owns a single AudioContext + AnalyserNode used purely for the
 * avatar's visual reaction.
 *
 * - While LISTENING, the live microphone stream (provided by the VAD) is tapped
 *   into the analyser so the eye reacts to the user's voice. The mic is NOT
 *   routed to the speakers (no feedback).
 * - While SPEAKING, the decoded reply is routed to both the analyser (so the
 *   eye "talks") and the speakers.
 *
 * Speech capture/segmentation itself is handled by the Silero VAD; this engine
 * only deals with playback + visualisation.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private freqData: Uint8Array<ArrayBuffer> = new Uint8Array(0);

  private micSource: MediaStreamAudioSourceNode | null = null;
  private currentSource: AudioBufferSourceNode | null = null;

  /** Lazily create/resume the context — must run inside a user gesture on iOS. */
  async ensure(): Promise<AudioContext> {
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.8;
      this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
      // NOTE: analyser is intentionally NOT connected to destination.
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
    return Math.min(1, Math.pow(rms, 0.7) * 2.2);
  }

  /** Tap a live mic stream into the analyser so the eye reacts while listening. */
  visualizeStream(stream: MediaStream): void {
    if (!this.ctx || !this.analyser) return;
    this.unvisualizeStream();
    this.micSource = this.ctx.createMediaStreamSource(stream);
    this.micSource.connect(this.analyser); // visualise only — never to speakers
  }

  unvisualizeStream(): void {
    this.micSource?.disconnect();
    this.micSource = null;
  }

  // ----------------------------------------------------------- playback
  /** Decodes and plays audio bytes through the analyser + speakers. */
  async play(data: ArrayBuffer): Promise<void> {
    const ctx = await this.ensure();
    const buffer = await ctx.decodeAudioData(data.slice(0));
    this.stopPlayback();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.analyser!); // drive the visual
    source.connect(ctx.destination); // and actually play it
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

/**
 * Encode mono Float32 PCM samples (as produced by the VAD, 16 kHz) into a
 * 16-bit WAV Blob suitable for upload to the transcription endpoint.
 */
export function float32ToWav(samples: Float32Array, sampleRate = 16000): Blob {
  const numFrames = samples.length;
  const buffer = new ArrayBuffer(44 + numFrames * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numFrames * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // format = PCM
  view.setUint16(22, 1, true); // channels = mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, 'data');
  view.setUint32(40, numFrames * 2, true);

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}
