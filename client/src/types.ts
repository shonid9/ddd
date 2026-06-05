/** A holographic HUD card opened by the assistant (or by a tool result). */
export type CardKind =
  | 'weather'
  | 'news'
  | 'search'
  | 'summary'
  | 'recommendation'
  | 'list'
  | 'note'
  | 'reminder'
  | 'vision';

export interface Card {
  id: string;
  kind: CardKind;
  title: string;
  subtitle?: string;
  body?: string;
  bullets?: string[];
  source?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResult {
  reply: string;
  cards: Omit<Card, 'id'>[];
  memory: string[];
}
