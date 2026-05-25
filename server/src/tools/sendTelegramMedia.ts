import type Database from 'better-sqlite3';
import { getUser } from '../db/index.js';

export type TelegramSender = (chatId: string, imageUrl: string, caption?: string) => Promise<void>;

interface SendTelegramMediaParams {
  userId: string;
  imageUrl: string;
  caption?: string;
}

interface SendTelegramMediaResult {
  sent: boolean;
  error?: string;
}

export async function sendTelegramMedia(
  db: Database.Database,
  params: SendTelegramMediaParams,
  sender: TelegramSender,
): Promise<SendTelegramMediaResult> {
  const user = getUser(db, params.userId);

  if (!user?.telegram_chat_id) {
    return { sent: false, error: 'User has no Telegram account linked' };
  }

  try {
    await sender(user.telegram_chat_id, params.imageUrl, params.caption);
    return { sent: true };
  } catch (err) {
    return {
      sent: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
