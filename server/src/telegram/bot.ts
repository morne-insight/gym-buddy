import TelegramBot from 'node-telegram-bot-api';
import type Database from 'better-sqlite3';
import { updateUserTelegram, getUser } from '../db/index.js';

export interface TelegramBotOptions {
  token: string;
  db: Database.Database;
  onUserMessage?: (userId: string, text: string, chatId: string) => Promise<string>;
}

export function createTelegramBot(options: TelegramBotOptions): TelegramBot {
  const { token, db, onUserMessage } = options;
  const bot = new TelegramBot(token, { polling: true });

  bot.onText(/\/start\s+(.+)/, (msg, match) => {
    const chatId = msg.chat.id.toString();
    const userId = match?.[1]?.trim();

    if (!userId) {
      bot.sendMessage(chatId, 'Send /start followed by your user ID to link your account.');
      return;
    }

    const user = getUser(db, userId);
    if (!user) {
      bot.sendMessage(chatId, `No account found for user ID: ${userId}`);
      return;
    }

    updateUserTelegram(db, userId, chatId);
    bot.sendMessage(chatId, `Linked! You're connected as ${user.name}. I'll send you updates here.`);
  });

  bot.onText(/\/start$/, (msg) => {
    const chatId = msg.chat.id.toString();
    bot.sendMessage(chatId, 'Send /start followed by your user ID to link your account.');
  });

  bot.on('message', (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return;
    if (!onUserMessage) return;

    const chatId = msg.chat.id.toString();
    const userRow = db
      .prepare('SELECT id FROM users WHERE telegram_chat_id = ?')
      .get(chatId) as { id: string } | undefined;

    if (!userRow) {
      bot.sendMessage(chatId, 'Your Telegram is not linked to an account. Send /start <userId> first.');
      return;
    }

    onUserMessage(userRow.id, msg.text, chatId).then(
      (reply) => bot.sendMessage(chatId, reply),
      (err) => {
        console.error('[Telegram] Error handling message:', err);
        bot.sendMessage(chatId, 'Something went wrong. Try again.');
      },
    );
  });

  return bot;
}
