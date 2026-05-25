import type Database from 'better-sqlite3';
import {
  getAllUsers,
  getScheduleForDay,
  getSessionsForDate,
  scheduleMessage,
} from '../db/index.js';

export interface EveningCheckInResult {
  checked: number;
  messaged: number;
  skipped: number;
}

export function runEveningCheckIn(
  db: Database.Database,
  todayDate?: string,
  todayDow?: number,
  tomorrowDow?: number,
): EveningCheckInResult {
  const now = new Date();
  const date = todayDate ?? now.toISOString().split('T')[0];
  const tDow = todayDow ?? now.getDay();
  const tmDow = tomorrowDow ?? ((tDow + 1) % 7);

  const users = getAllUsers(db);
  const result: EveningCheckInResult = { checked: 0, messaged: 0, skipped: 0 };

  for (const user of users) {
    result.checked++;

    const todaySchedule = getScheduleForDay(db, user.id, tDow);
    const tomorrowSchedule = getScheduleForDay(db, user.id, tmDow);

    const missedToday =
      todaySchedule && getSessionsForDate(db, user.id, date).length === 0;

    let content: string | null = null;
    let messageType: string;

    if (missedToday && tomorrowSchedule) {
      content = `You had ${todaySchedule.workout_name} today and didn't show. Tomorrow is ${tomorrowSchedule.workout_name} — don't miss that too. Get your gear ready.`;
      messageType = 'missed_and_preview';
    } else if (missedToday) {
      content = `You had ${todaySchedule!.workout_name} scheduled today and didn't show up. What happened?`;
      messageType = 'missed_workout';
    } else if (tomorrowSchedule) {
      content = `Tomorrow is ${tomorrowSchedule.workout_name}. Get your gear ready and rest up tonight.`;
      messageType = 'pre_workout';
    } else {
      result.skipped++;
      continue;
    }

    const deliverAt = new Date();
    deliverAt.setHours(21, 0, 0, 0);
    if (deliverAt.getTime() < Date.now()) {
      deliverAt.setDate(deliverAt.getDate() + 1);
    }

    scheduleMessage(db, {
      user_id: user.id,
      deliver_at: deliverAt.toISOString(),
      message_type: messageType,
      content,
      image_url: null,
      created_by: 'cron_evening',
    });

    result.messaged++;
  }

  return result;
}
