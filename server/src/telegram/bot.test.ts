import { createTestDatabase, seedTestUser, seedTestPersona } from '../db/test-helpers.js';
import { getUser, updateUserTelegram } from '../db/index.js';
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

describe('bot /start deep link', () => {
  it('links telegram chat ID to existing user', () => {
    const userId = seedTestUser(db);

    updateUserTelegram(db, userId, '99999');

    const user = getUser(db, userId);
    expect(user?.telegram_chat_id).toBe('99999');
  });

  it('does not crash when user does not exist', () => {
    const user = getUser(db, 'nonexistent-user');
    expect(user).toBeUndefined();
  });

  it('overwrites previous chat ID on re-link', () => {
    const userId = seedTestUser(db);

    updateUserTelegram(db, userId, '11111');
    updateUserTelegram(db, userId, '22222');

    const user = getUser(db, userId);
    expect(user?.telegram_chat_id).toBe('22222');
  });
});

describe('bot message routing', () => {
  it('finds user by telegram chat ID', () => {
    const userId = seedTestUser(db);
    updateUserTelegram(db, userId, '12345');

    const row = db
      .prepare('SELECT id FROM users WHERE telegram_chat_id = ?')
      .get('12345') as { id: string } | undefined;

    expect(row).toBeDefined();
    expect(row!.id).toBe(userId);
  });

  it('returns undefined for unknown chat ID', () => {
    const row = db
      .prepare('SELECT id FROM users WHERE telegram_chat_id = ?')
      .get('unknown') as { id: string } | undefined;

    expect(row).toBeUndefined();
  });
});
