import type Database from 'better-sqlite3';
import { getAllUsers, getScheduleForDay, getSessionsForDate, scheduleMessage } from '../db/index.js';

export interface MissedWorkoutResult {
  checked: number;
  missed: number;
  completed: number;
  noWorkout: number;
}

export function detectMissedWorkouts(
  db: Database.Database,
  dateStr?: string,
  dayOfWeek?: number,
): MissedWorkoutResult {
  const now = new Date();
  const date = dateStr ?? now.toISOString().split('T')[0];
  const dow = dayOfWeek ?? now.getDay();

  const users = getAllUsers(db);
  const result: MissedWorkoutResult = { checked: 0, missed: 0, completed: 0, noWorkout: 0 };

  for (const user of users) {
    result.checked++;

    const schedule = getScheduleForDay(db, user.id, dow);
    if (!schedule) {
      result.noWorkout++;
      continue;
    }

    const sessions = getSessionsForDate(db, user.id, date);
    if (sessions.length > 0) {
      result.completed++;
      continue;
    }

    const deliverAt = new Date();
    deliverAt.setHours(22, 0, 0, 0);
    if (deliverAt.getTime() < Date.now()) {
      deliverAt.setDate(deliverAt.getDate() + 1);
    }

    scheduleMessage(db, {
      user_id: user.id,
      deliver_at: deliverAt.toISOString(),
      message_type: 'missed_workout',
      content: `You had ${schedule.workout_name} scheduled today and didn't show up. What happened?`,
      image_url: null,
      created_by: 'cron_missed_workout',
    });

    result.missed++;
  }

  return result;
}
