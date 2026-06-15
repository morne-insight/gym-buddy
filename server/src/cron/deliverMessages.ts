import { getPendingMessages, markMessageDelivered, getUser, type DB } from '../db/index.js';
import type { TelegramSender } from '../tools/sendTelegramMedia.js';

export type MessageContentGenerator = (
  messageType: string,
  context: string | null,
  userId: string,
) => Promise<string>;

export interface DeliveryResult {
  delivered: number;
  failed: number;
  errors: string[];
}

export async function deliverPendingMessages(
  db: DB,
  sendText: (chatId: string, text: string) => Promise<void>,
  sendMedia: TelegramSender,
  generateContent?: MessageContentGenerator,
): Promise<DeliveryResult> {
  const pending = await getPendingMessages(db);
  const result: DeliveryResult = { delivered: 0, failed: 0, errors: [] };

  for (const msg of pending) {
    const user = await getUser(db, msg.user_id);
    if (!user?.telegram_chat_id) {
      result.failed++;
      result.errors.push(`User ${msg.user_id} has no Telegram linked`);
      continue;
    }

    try {
      let content = msg.content;

      if (!content && generateContent) {
        content = await generateContent(msg.message_type, msg.content, msg.user_id);
      }

      if (!content) {
        result.failed++;
        result.errors.push(`Message ${msg.id} has no content and no generator available`);
        continue;
      }

      if (msg.image_url) {
        await sendMedia(user.telegram_chat_id, msg.image_url, content);
      } else {
        await sendText(user.telegram_chat_id, content);
      }

      await markMessageDelivered(db, msg.id);
      result.delivered++;
    } catch (err) {
      result.failed++;
      result.errors.push(`Message ${msg.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return result;
}
