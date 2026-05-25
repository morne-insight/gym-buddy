import cron from 'node-cron';
import type Database from 'better-sqlite3';
import { deliverPendingMessages, type MessageContentGenerator } from './deliverMessages.js';
import { runEveningCheckIn } from './eveningCheckIn.js';
import type { TelegramSender } from '../tools/sendTelegramMedia.js';

export interface CronDependencies {
  db: Database.Database;
  sendText: (chatId: string, text: string) => Promise<void>;
  sendMedia: TelegramSender;
  generateContent?: MessageContentGenerator;
}

export function startCronJobs(deps: CronDependencies): void {
  const { db, sendText, sendMedia, generateContent } = deps;

  cron.schedule('* * * * *', async () => {
    const result = await deliverPendingMessages(db, sendText, sendMedia, generateContent);
    if (result.delivered > 0 || result.failed > 0) {
      console.log(`[Cron] Delivered: ${result.delivered}, Failed: ${result.failed}`);
    }
  });

  cron.schedule('0 21 * * *', () => {
    const result = runEveningCheckIn(db);
    console.log(`[Cron] Evening check-in: ${result.messaged} messaged, ${result.skipped} skipped`);
  });

  console.log('Cron jobs started (delivery: every minute, evening check-in: 21:00)');
}
