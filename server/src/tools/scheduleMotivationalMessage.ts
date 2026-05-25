import type Database from 'better-sqlite3';
import { scheduleMessage } from '../db/index.js';

interface ScheduleMotivationalParams {
  userId: string;
  deliverInHours: number;
  context: string;
}

export interface ScheduleMotivationalResult {
  scheduled: boolean;
  messageId?: string;
  deliverAt?: string;
  error?: string;
}

export function scheduleMotivationalMessage(
  db: Database.Database,
  params: ScheduleMotivationalParams,
): ScheduleMotivationalResult {
  if (params.deliverInHours < 1 || params.deliverInHours > 24) {
    return { scheduled: false, error: 'deliverInHours must be between 1 and 24' };
  }

  const deliverAt = new Date(Date.now() + params.deliverInHours * 60 * 60 * 1000).toISOString();

  const msg = scheduleMessage(db, {
    user_id: params.userId,
    deliver_at: deliverAt,
    message_type: 'motivation',
    content: params.context,
    image_url: null,
    created_by: 'voice_session',
  });

  return {
    scheduled: true,
    messageId: msg.id,
    deliverAt,
  };
}
