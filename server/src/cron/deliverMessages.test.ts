import { deliverPendingMessages } from './deliverMessages.js';
import {
  createTestDatabase,
  setupTestSchema,
  resetTestData,
  closeTestPool,
  seedTestUser,
  seedTestPersona,
} from '../db/test-helpers.js';
import { updateUserTelegram, scheduleMessage, getPendingMessages, type DB } from '../db/index.js';
import { beforeAll, beforeEach, afterAll, describe, it, expect } from '@jest/globals';

let db: DB;

beforeAll(async () => {
  db = createTestDatabase();
  await setupTestSchema();
});

beforeEach(async () => {
  await resetTestData();
  await seedTestPersona(db);
});

afterAll(async () => {
  await closeTestPool();
});

describe('deliverPendingMessages', () => {
  it('delivers a text message and marks it delivered', async () => {
    const userId = await seedTestUser(db);
    await updateUserTelegram(db, userId, '12345');

    await scheduleMessage(db, {
      user_id: userId,
      deliver_at: new Date(Date.now() - 60000).toISOString(),
      message_type: 'motivation',
      content: 'Keep pushing!',
      image_url: null,
      created_by: 'test',
    });

    const sent: Array<{ chatId: string; text: string }> = [];
    const sendText = async (chatId: string, text: string) => {
      sent.push({ chatId, text });
    };
    const sendMedia = async () => {};

    const result = await deliverPendingMessages(db, sendText, sendMedia);

    expect(result.delivered).toBe(1);
    expect(result.failed).toBe(0);
    expect(sent).toHaveLength(1);
    expect(sent[0].chatId).toBe('12345');
    expect(sent[0].text).toBe('Keep pushing!');

    const pending = await getPendingMessages(db);
    expect(pending).toHaveLength(0);
  });

  it('delivers a media message with caption', async () => {
    const userId = await seedTestUser(db);
    await updateUserTelegram(db, userId, '12345');

    await scheduleMessage(db, {
      user_id: userId,
      deliver_at: new Date(Date.now() - 60000).toISOString(),
      message_type: 'goal_reminder',
      content: 'Remember your goal!',
      image_url: 'https://example.com/goal.jpg',
      created_by: 'test',
    });

    const media: Array<{ chatId: string; imageUrl: string; caption?: string }> = [];
    const sendText = async () => {};
    const sendMedia = async (chatId: string, imageUrl: string, caption?: string) => {
      media.push({ chatId, imageUrl, caption });
    };

    const result = await deliverPendingMessages(db, sendText, sendMedia);

    expect(result.delivered).toBe(1);
    expect(media).toHaveLength(1);
    expect(media[0].imageUrl).toBe('https://example.com/goal.jpg');
    expect(media[0].caption).toBe('Remember your goal!');
  });

  it('skips users without Telegram linked', async () => {
    const userId = await seedTestUser(db);

    await scheduleMessage(db, {
      user_id: userId,
      deliver_at: new Date(Date.now() - 60000).toISOString(),
      message_type: 'motivation',
      content: 'You got this!',
      image_url: null,
      created_by: 'test',
    });

    const sendText = async () => {};
    const sendMedia = async () => {};

    const result = await deliverPendingMessages(db, sendText, sendMedia);

    expect(result.delivered).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.errors[0]).toMatch(/no Telegram/i);
  });

  it('does not deliver future messages', async () => {
    const userId = await seedTestUser(db);
    await updateUserTelegram(db, userId, '12345');

    await scheduleMessage(db, {
      user_id: userId,
      deliver_at: new Date(Date.now() + 3600000).toISOString(),
      message_type: 'motivation',
      content: 'Future message',
      image_url: null,
      created_by: 'test',
    });

    const sendText = async () => {};
    const sendMedia = async () => {};

    const result = await deliverPendingMessages(db, sendText, sendMedia);

    expect(result.delivered).toBe(0);
    expect(result.failed).toBe(0);
  });

  it('uses content generator when content is null', async () => {
    const userId = await seedTestUser(db);
    await updateUserTelegram(db, userId, '12345');

    await scheduleMessage(db, {
      user_id: userId,
      deliver_at: new Date(Date.now() - 60000).toISOString(),
      message_type: 'motivation',
      content: null,
      image_url: null,
      created_by: 'test',
    });

    const sent: string[] = [];
    const sendText = async (_chatId: string, text: string) => {
      sent.push(text);
    };
    const sendMedia = async () => {};
    const generator = async () => 'Generated motivational message';

    const result = await deliverPendingMessages(db, sendText, sendMedia, generator);

    expect(result.delivered).toBe(1);
    expect(sent[0]).toBe('Generated motivational message');
  });
});
