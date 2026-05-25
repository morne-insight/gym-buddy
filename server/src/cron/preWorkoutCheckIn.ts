import type Database from 'better-sqlite3';
import { getAllUsers, getScheduleForDay, scheduleMessage } from '../db/index.js';

export interface CheckInResult {
  checked: number;
  scheduled: number;
  skipped: number;
}

export function schedulePreWorkoutCheckIns(
  db: Database.Database,
  tomorrowDayOfWeek?: number,
): CheckInResult {
  const tomorrow = tomorrowDayOfWeek ?? ((new Date().getDay() + 1) % 7);
  const users = getAllUsers(db);
  const result: CheckInResult = { checked: 0, scheduled: 0, skipped: 0 };

  for (const user of users) {
    result.checked++;

    const schedule = getScheduleForDay(db, user.id, tomorrow);
    if (!schedule) {
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
      message_type: 'pre_workout',
      content: `Tomorrow is ${schedule.workout_name}. Get your gear ready and rest up tonight.`,
      image_url: null,
      created_by: 'cron_pre_workout',
    });

    result.scheduled++;
  }

  return result;
}
