import { buildSystemPrompt } from '../prompts/index.js';
import type { DB } from '../db/index.js';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const MAX_HISTORY = 10;
const chatHistories = new Map<string, ChatMessage[]>();

export type ChatCompletionFn = (
  systemPrompt: string,
  messages: ChatMessage[],
) => Promise<string>;

export function createMessageHandler(
  db: DB,
  chatCompletion: ChatCompletionFn,
) {
  return async (userId: string, text: string): Promise<string> => {
    const { prompt } = await buildSystemPrompt(db, userId);
    const systemPrompt = `${prompt}\n\nYou are responding via Telegram text chat, not voice. Keep responses concise. Use short paragraphs. No voice-specific instructions apply here.`;

    const history = chatHistories.get(userId) ?? [];
    history.push({ role: 'user', content: text });

    if (history.length > MAX_HISTORY) {
      history.splice(0, history.length - MAX_HISTORY);
    }

    const reply = await chatCompletion(systemPrompt, history);

    history.push({ role: 'assistant', content: reply });

    if (history.length > MAX_HISTORY) {
      history.splice(0, history.length - MAX_HISTORY);
    }

    chatHistories.set(userId, history);

    return reply;
  };
}

export function clearChatHistory(userId: string): void {
  chatHistories.delete(userId);
}

export function getChatHistory(userId: string): ChatMessage[] {
  return chatHistories.get(userId) ?? [];
}
