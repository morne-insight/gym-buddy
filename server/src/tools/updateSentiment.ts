import type Database from 'better-sqlite3';
import { updateSessionSentiment, getActiveSession } from '../db/index.js';

interface UpdateSentimentParams {
  sessionId?: string;
  userId?: string;
  sentiment: string;
}

export interface UpdateSentimentResult {
  updated: boolean;
  error?: string;
}

export function updateSentiment(
  db: Database.Database,
  params: UpdateSentimentParams,
): UpdateSentimentResult {
  let sessionId = params.sessionId;

  if (!sessionId && params.userId) {
    const session = getActiveSession(db, params.userId);
    sessionId = session?.id;
  }

  if (!sessionId) {
    return { updated: false, error: 'No active session found' };
  }

  updateSessionSentiment(db, sessionId, params.sentiment);
  return { updated: true };
}
