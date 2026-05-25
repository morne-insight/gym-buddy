import TelegramBot from 'node-telegram-bot-api';
import type { TelegramSender } from '../tools/sendTelegramMedia.js';

export function createTelegramSender(bot: TelegramBot): TelegramSender {
  return async (chatId: string, imageUrl: string, caption?: string) => {
    if (imageUrl.endsWith('.gif')) {
      await bot.sendAnimation(chatId, imageUrl, { caption });
    } else {
      await bot.sendPhoto(chatId, imageUrl, { caption });
    }
  };
}

export async function sendTextMessage(
  bot: TelegramBot,
  chatId: string,
  text: string,
): Promise<void> {
  await bot.sendMessage(chatId, text);
}
