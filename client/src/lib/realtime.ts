/**
 * Optional live "JARVIS" mode using the OpenAI Realtime API over WebRTC.
 *
 * This is true speech-to-speech: natural prosody, laughs, breaths and barge-in
 * (you can interrupt mid-sentence). The browser talks directly to OpenAI using
 * a short-lived ephemeral key minted by our server, so the real API key is
 * never exposed. Falls back gracefully — if the account lacks Realtime access
 * the caller stays on the classic transcribe→chat→tts loop.
 */
import { realtimeSession } from './api';
import type { Card } from '../types';

export interface RealtimeCallbacks {
  onRemoteStream: (stream: MediaStream) => void;
  onMicStream?: (stream: MediaStream) => void;
  onUserText?: (text: string) => void;
  onAssistantText?: (text: string, final: boolean) => void;
  onCard?: (card: Omit<Card, 'id'>) => void;
  onMemory?: (fact: string) => void;
  onStatus?: (s: 'connecting' | 'live' | 'closed' | 'error', msg?: string) => void;
}

// Realtime tool schemas (web_search isn't available here, only functions).
const REALTIME_TOOLS = [
  {
    type: 'function',
    name: 'show_panel',
    description:
      'Open a holographic HUD card to display structured info (weather, news, summary, recommendation, list, note, reminder). Always also speak a short Hebrew sentence.',
    parameters: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          enum: ['weather', 'news', 'search', 'summary', 'recommendation', 'list', 'note', 'reminder'],
        },
        title: { type: 'string' },
        subtitle: { type: 'string' },
        body: { type: 'string' },
        bullets: { type: 'array', items: { type: 'string' } },
        source: { type: 'string' },
      },
      required: ['kind', 'title'],
    },
  },
  {
    type: 'function',
    name: 'remember',
    description: 'Persist a durable personal fact about the user for future conversations.',
    parameters: {
      type: 'object',
      properties: { fact: { type: 'string' } },
      required: ['fact'],
    },
  },
];

export class RealtimeSession {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private mic: MediaStream | null = null;
  private cb: RealtimeCallbacks;
  private assistantBuf = '';

  constructor(cb: RealtimeCallbacks) {
    this.cb = cb;
  }

  async connect(instructions: string): Promise<void> {
    this.cb.onStatus?.('connecting');
    const session = await realtimeSession();
    const ephemeral = session?.client_secret?.value;
    if (!ephemeral) throw new Error('Realtime session unavailable.');

    const pc = new RTCPeerConnection();
    this.pc = pc;

    pc.ontrack = (e) => this.cb.onRemoteStream(e.streams[0]);
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') this.cb.onStatus?.('live');
      if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) this.cb.onStatus?.('closed');
    };

    this.mic = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    this.mic.getTracks().forEach((t) => pc.addTrack(t, this.mic!));
    this.cb.onMicStream?.(this.mic);

    const dc = pc.createDataChannel('oai-events');
    this.dc = dc;
    dc.onopen = () => this.configure(session?.instructions || instructions);
    dc.onmessage = (e) => this.onEvent(e.data);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const model = session.model || 'gpt-4o-realtime-preview';
    const resp = await fetch(`https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`, {
      method: 'POST',
      body: offer.sdp,
      headers: { Authorization: `Bearer ${ephemeral}`, 'Content-Type': 'application/sdp' },
    });
    if (!resp.ok) throw new Error('Realtime handshake failed.');
    const answer = await resp.text();
    await pc.setRemoteDescription({ type: 'answer', sdp: answer });
  }

  private configure(instructions: string): void {
    this.send({
      type: 'session.update',
      session: {
        modalities: ['audio', 'text'],
        instructions,
        voice: 'ash',
        input_audio_transcription: { model: 'whisper-1' },
        turn_detection: { type: 'server_vad', threshold: 0.5, silence_duration_ms: 500 },
        tools: REALTIME_TOOLS,
        tool_choice: 'auto',
      },
    });
  }

  private onEvent(raw: string): void {
    let ev: Record<string, unknown>;
    try {
      ev = JSON.parse(raw);
    } catch {
      return;
    }
    const type = ev.type as string;

    switch (type) {
      case 'response.audio_transcript.delta':
        this.assistantBuf += (ev.delta as string) || '';
        this.cb.onAssistantText?.(this.assistantBuf, false);
        break;
      case 'response.audio_transcript.done':
        this.cb.onAssistantText?.((ev.transcript as string) || this.assistantBuf, true);
        this.assistantBuf = '';
        break;
      case 'conversation.item.input_audio_transcription.completed':
        this.cb.onUserText?.((ev.transcript as string) || '');
        break;
      case 'response.function_call_arguments.done':
        this.handleToolCall(ev);
        break;
      default:
        break;
    }
  }

  private handleToolCall(ev: Record<string, unknown>): void {
    const name = ev.name as string;
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse((ev.arguments as string) || '{}');
    } catch {
      args = {};
    }
    if (name === 'show_panel' && args.title) {
      this.cb.onCard?.({
        kind: (args.kind as Card['kind']) || 'note',
        title: String(args.title),
        subtitle: args.subtitle ? String(args.subtitle) : undefined,
        body: args.body ? String(args.body) : undefined,
        bullets: Array.isArray(args.bullets) ? (args.bullets as unknown[]).map(String) : undefined,
        source: args.source ? String(args.source) : undefined,
      });
    } else if (name === 'remember' && args.fact) {
      this.cb.onMemory?.(String(args.fact));
    }
    // Acknowledge the tool call so the model can continue the turn.
    const callId = ev.call_id as string | undefined;
    if (callId) {
      this.send({
        type: 'conversation.item.create',
        item: { type: 'function_call_output', call_id: callId, output: '{"ok":true}' },
      });
      this.send({ type: 'response.create' });
    }
  }

  private send(obj: unknown): void {
    if (this.dc && this.dc.readyState === 'open') this.dc.send(JSON.stringify(obj));
  }

  close(): void {
    try {
      this.dc?.close();
    } catch {
      /* ignore */
    }
    this.mic?.getTracks().forEach((t) => t.stop());
    try {
      this.pc?.close();
    } catch {
      /* ignore */
    }
    this.dc = null;
    this.pc = null;
    this.mic = null;
    this.cb.onStatus?.('closed');
  }
}
