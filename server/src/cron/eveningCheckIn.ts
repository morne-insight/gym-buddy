import type Database from 'better-sqlite3';
import {
  getAllUsers,
  getUser,
  getPersona,
  getActiveProgram,
  getScheduleForDay,
  getSchedulesByProgram,
  getWorkoutById,
  getRotationState,
  getSessionsForDate,
  peekNextRotationWorkout,
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

    const program = getActiveProgram(db, user.id);
    if (!program) {
      result.skipped++;
      continue;
    }

    const persona = getPersona(db, user.persona_id);
    const sessionsToday = getSessionsForDate(db, user.id, date);
    const completedToday = sessionsToday.some(s => s.status === 'completed');

    let todayWorkoutName: string | null = null;
    let nextWorkoutName: string | null = null;
    let missedToday = false;

    if (program.type === 'rotation') {
      const state = getRotationState(db, user.id, program.id);
      if (state) {
        const schedules = getSchedulesByProgram(db, program.id);
        const currentSchedule = schedules.find(s => s.sort_order === state.current_index);
        if (currentSchedule) {
          const currentWorkout = getWorkoutById(db, currentSchedule.workout_id);
          if (!completedToday && sessionsToday.length === 0) {
            todayWorkoutName = currentWorkout?.name ?? null;
            missedToday = true;
          }
        }
        const nextWorkout = peekNextRotationWorkout(db, user.id, program.id);
        nextWorkoutName = nextWorkout?.name ?? null;
      }
    } else {
      const todaySchedule = getScheduleForDay(db, user.id, tDow);
      if (todaySchedule) {
        const workout = getWorkoutById(db, todaySchedule.workout_id);
        todayWorkoutName = workout?.name ?? null;
        if (sessionsToday.length === 0) {
          missedToday = true;
        }
      }

      const tomorrowSchedule = getScheduleForDay(db, user.id, tmDow);
      if (tomorrowSchedule) {
        const workout = getWorkoutById(db, tomorrowSchedule.workout_id);
        nextWorkoutName = workout?.name ?? null;
      }
    }

    let content: string | null = null;
    let messageType: string;

    const isRotation = program.type === 'rotation';
    const nextLabel = isRotation ? 'Next up is' : 'Tomorrow is';

    if (missedToday && nextWorkoutName) {
      if (persona?.example_no_show_reaction) {
        content = `${persona.example_no_show_reaction} You had ${todayWorkoutName} today. ${nextLabel} ${nextWorkoutName} — don't miss that too.`;
      } else {
        content = `You had ${todayWorkoutName} today and didn't show. ${nextLabel} ${nextWorkoutName} — don't miss that too. Get your gear ready.`;
      }
      messageType = 'missed_and_preview';
    } else if (missedToday) {
      if (persona?.example_no_show_reaction) {
        content = `${persona.example_no_show_reaction} You had ${todayWorkoutName} scheduled today.`;
      } else {
        content = `You had ${todayWorkoutName} scheduled today and didn't show up. What happened?`;
      }
      messageType = 'missed_workout';
    } else if (nextWorkoutName) {
      content = `${nextLabel} ${nextWorkoutName}. Get your gear ready and rest up tonight.`;
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
