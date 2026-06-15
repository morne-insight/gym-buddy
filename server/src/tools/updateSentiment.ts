import { updateSessionSentiment, getActiveSession, type DB } from '../db/index.js';

interface UpdateSentimentParams {
  sessionId?: string;
  userId?: string;
  sentiment: string;
}

export interface UpdateSentimentResult {
  updated: boolean;
  error?: string;
}

export async function updateSentiment(
  db: DB,
  params: UpdateSentimentParams,
): Promise<UpdateSentimentResult> {
  let sessionId = params.sessionId;

  if (!sessionId && params.userId) {
    const session = await getActiveSession(db, params.userId);
    sessionId = session?.id;
  }

  if (!sessionId) {
    return { updated: false, error: 'No active session found' };
  }

  await updateSessionSentiment(db, sessionId, params.sentiment);
  return { updated: true };
}
