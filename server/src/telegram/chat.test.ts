import { createMessageHandler, clearChatHistory, getChatHistory, type ChatCompletionFn } from './chat.js';
import {
  createTestDatabase,
  setupTestSchema,
  resetTestData,
  closeTestPool,
  seedTestUser,
  seedTestPersona,
} from '../db/test-helpers.js';
import { beforeAll, beforeEach, afterAll, describe, it, expect } from '@jest/globals';
import type { DB } from '../db/index.js';

let db: DB;

beforeAll(async () => {
  db = createTestDatabase();
  await setupTestSchema();
});

beforeEach(async () => {
  await resetTestData();
  await seedTestPersona(db);
  clearChatHistory('test-user-1');
  clearChatHistory('test-user-a');
  clearChatHistory('test-user-b');
});

afterAll(async () => {
  await closeTestPool();
});

describe('createMessageHandler', () => {
  it('sends user message to LLM with system prompt and returns reply', async () => {
    const userId = await seedTestUser(db);
    let capturedSystem = '';
    let capturedMessages: Array<{ role: string; content: string }> = [];

    const mockCompletion: ChatCompletionFn = async (system, messages) => {
      capturedSystem = system;
      capturedMessages = [...messages];
      return 'Drop and give me twenty!';
    };

    const handler = createMessageHandler(db, mockCompletion);
    const reply = await handler(userId, 'I feel lazy today');

    expect(reply).toBe('Drop and give me twenty!');
    expect(capturedSystem).toContain('Telegram');
    expect(capturedMessages).toHaveLength(1);
    expect(capturedMessages[0].role).toBe('user');
    expect(capturedMessages[0].content).toBe('I feel lazy today');
  });

  it('maintains conversation history across calls', async () => {
    const userId = await seedTestUser(db);
    let lastMessages: Array<{ role: string; content: string }> = [];

    const mockCompletion: ChatCompletionFn = async (_system, messages) => {
      lastMessages = [...messages];
      return `Reply ${messages.length}`;
    };

    const handler = createMessageHandler(db, mockCompletion);

    await handler(userId, 'First message');
    expect(lastMessages).toHaveLength(1);

    await handler(userId, 'Second message');
    expect(lastMessages).toHaveLength(3);
    expect(lastMessages[0]).toEqual({ role: 'user', content: 'First message' });
    expect(lastMessages[1]).toEqual({ role: 'assistant', content: 'Reply 1' });
    expect(lastMessages[2]).toEqual({ role: 'user', content: 'Second message' });
  });

  it('limits history to 10 messages', async () => {
    const userId = await seedTestUser(db);

    const mockCompletion: ChatCompletionFn = async () => 'ok';
    const handler = createMessageHandler(db, mockCompletion);

    for (let i = 0; i < 8; i++) {
      await handler(userId, `Message ${i}`);
    }

    const history = getChatHistory(userId);
    expect(history.length).toBeLessThanOrEqual(10);
  });

  it('clears history when requested', async () => {
    const userId = await seedTestUser(db);

    const mockCompletion: ChatCompletionFn = async () => 'ok';
    const handler = createMessageHandler(db, mockCompletion);

    await handler(userId, 'Hello');
    expect(getChatHistory(userId)).toHaveLength(2);

    clearChatHistory(userId);
    expect(getChatHistory(userId)).toHaveLength(0);
  });

  it('keeps separate history per user', async () => {
    const user1 = await seedTestUser(db, { id: 'test-user-a', name: 'User A' });
    const user2 = await seedTestUser(db, { id: 'test-user-b', name: 'User B' });

    const mockCompletion: ChatCompletionFn = async () => 'ok';
    const handler = createMessageHandler(db, mockCompletion);

    await handler(user1, 'User 1 message');
    await handler(user2, 'User 2 message');

    expect(getChatHistory(user1)).toHaveLength(2);
    expect(getChatHistory(user2)).toHaveLength(2);
    expect(getChatHistory(user1)[0].content).toBe('User 1 message');
    expect(getChatHistory(user2)[0].content).toBe('User 2 message');
  });
});
