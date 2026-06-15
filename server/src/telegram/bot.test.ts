import {
  createTestDatabase,
  setupTestSchema,
  resetTestData,
  closeTestPool,
  seedTestUser,
  seedTestPersona,
} from '../db/test-helpers.js';
import { getUser, updateUserTelegram, getUserByTelegramChatId, type DB } from '../db/index.js';
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

describe('bot /start deep link', () => {
  it('links telegram chat ID to existing user', async () => {
    const userId = await seedTestUser(db);

    await updateUserTelegram(db, userId, '99999');

    const user = await getUser(db, userId);
    expect(user?.telegram_chat_id).toBe('99999');
  });

  it('does not crash when user does not exist', async () => {
    const user = await getUser(db, 'nonexistent-user');
    expect(user).toBeUndefined();
  });

  it('overwrites previous chat ID on re-link', async () => {
    const userId = await seedTestUser(db);

    await updateUserTelegram(db, userId, '11111');
    await updateUserTelegram(db, userId, '22222');

    const user = await getUser(db, userId);
    expect(user?.telegram_chat_id).toBe('22222');
  });
});

describe('bot message routing', () => {
  it('finds user by telegram chat ID', async () => {
    const userId = await seedTestUser(db);
    await updateUserTelegram(db, userId, '12345');

    const row = await getUserByTelegramChatId(db, '12345');

    expect(row).toBeDefined();
    expect(row!.id).toBe(userId);
  });

  it('returns undefined for unknown chat ID', async () => {
    const row = await getUserByTelegramChatId(db, 'unknown');

    expect(row).toBeUndefined();
  });
});
