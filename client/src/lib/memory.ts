/**
 * Lightweight persistent memory backed by localStorage.
 *
 * - `facts` are durable user facts the assistant chose to remember (name,
 *   preferences, etc.) — sent back as context on every chat turn.
 * - `history` is the recent conversation so a refresh doesn't lose context.
 */
import type { ChatMessage } from '../types';

const FACTS_KEY = 'oracle.memory.facts.v1';
const HISTORY_KEY = 'oracle.memory.history.v1';
const MAX_FACTS = 40;
const MAX_HISTORY = 30;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full / unavailable — non-fatal */
  }
}

export const memory = {
  loadFacts(): string[] {
    return read<string[]>(FACTS_KEY, []);
  },

  addFacts(facts: string[]): string[] {
    if (!facts.length) return memory.loadFacts();
    const existing = memory.loadFacts();
    const merged = [...existing];
    for (const f of facts) {
      const clean = f.trim();
      if (clean && !merged.some((m) => m.toLowerCase() === clean.toLowerCase())) merged.push(clean);
    }
    const trimmed = merged.slice(-MAX_FACTS);
    write(FACTS_KEY, trimmed);
    return trimmed;
  },

  clearFacts(): void {
    write(FACTS_KEY, []);
  },

  loadHistory(): ChatMessage[] {
    return read<ChatMessage[]>(HISTORY_KEY, []);
  },

  saveHistory(history: ChatMessage[]): void {
    write(HISTORY_KEY, history.slice(-MAX_HISTORY));
  },

  clearHistory(): void {
    write(HISTORY_KEY, []);
  },
};
