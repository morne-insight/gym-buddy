import { sendTelegramMedia, type TelegramSender } from './sendTelegramMedia.js';
import { createTestDatabase, seedTestUser, seedTestPersona } from '../db/test-helpers.js';
import { updateUserTelegram } from '../db/index.js';
import type Database from 'better-sqlite3';
import { beforeEach, afterEach, describe, it, expect } from '@jest/globals';

let db: Database.Database;

beforeEach(() => {
  db = createTestDatabase();
  seedTestPersona(db);
});

afterEach(() => {
  db.close();
});

describe('sendTelegramMedia', () => {
  it('sends media to a user with linked telegram', async () => {
    const userId = seedTestUser(db);
    updateUserTelegram(db, userId, '12345');

    const sent: Array<{ chatId: string; imageUrl: string; caption?: string }> = [];
    const mockSender: TelegramSender = async (chatId, imageUrl, caption) => {
      sent.push({ chatId, imageUrl, caption });
    };

    const result = await sendTelegramMedia(db, {
      userId,
      imageUrl: 'https://example.com/exercise.gif',
      caption: 'Bench Press form',
    }, mockSender);

    expect(result.sent).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0].chatId).toBe('12345');
    expect(sent[0].imageUrl).toBe('https://example.com/exercise.gif');
    expect(sent[0].caption).toBe('Bench Press form');
  });

  it('fails when user has no telegram linked', async () => {
    const userId = seedTestUser(db);

    const mockSender: TelegramSender = async () => {};

    const result = await sendTelegramMedia(db, {
      userId,
      imageUrl: 'https://example.com/exercise.gif',
    }, mockSender);

    expect(result.sent).toBe(false);
    expect(result.error).toMatch(/telegram/i);
  });

  it('handles send failures gracefully', async () => {
    const userId = seedTestUser(db);
    updateUserTelegram(db, userId, '12345');

    const failingSender: TelegramSender = async () => {
      throw new Error('Telegram API error');
    };

    const result = await sendTelegramMedia(db, {
      userId,
      imageUrl: 'https://example.com/exercise.gif',
    }, failingSender);

    expect(result.sent).toBe(false);
    expect(result.error).toBe('Telegram API error');
  });
});
