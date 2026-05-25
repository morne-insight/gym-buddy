import cron from 'node-cron';
import type Database from 'better-sqlite3';
import { deliverPendingMessages, type MessageContentGenerator } from './deliverMessages.js';
import { schedulePreWorkoutCheckIns } from './preWorkoutCheckIn.js';
import { detectMissedWorkouts } from './missedWorkout.js';
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
    const result = schedulePreWorkoutCheckIns(db);
    console.log(`[Cron] Pre-workout check-ins: ${result.scheduled} scheduled, ${result.skipped} rest days`);
  });

  cron.schedule('0 22 * * *', () => {
    const result = detectMissedWorkouts(db);
    console.log(`[Cron] Missed workouts: ${result.missed} missed, ${result.completed} completed`);
  });

  console.log('Cron jobs started (delivery: every minute, pre-workout: 21:00, missed: 22:00)');
}
