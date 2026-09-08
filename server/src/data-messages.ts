export interface ExerciseMediaPayload {
  gifUrl: string;
  exerciseName: string;
}

export interface ExerciseProgressPayload {
  attemptId?: string;
  roomName?: string;
  exerciseName: string;
  targetSets: number;
  targetReps: string;
  targetWeight: number | null;
  completedSets: number;
  currentSetNumber: number;
  exerciseIndex: number;
  totalExercises: number;
}

export interface RestTimerPayload {
  action: 'start' | 'end';
  durationSeconds: number;
  remainingSeconds?: number;
}

export interface SessionReadyPayload {
  attemptId: string;
  roomName: string;
  sessionId: string;
  restDay: boolean;
  workoutName: string | null;
  initialExerciseProgress: ExerciseProgressPayload | null;
}

export interface SessionFailedPayload {
  attemptId: string;
  roomName: string;
  code: 'user_resolution_failed' | 'workout_resolution_failed' | 'session_creation_failed' | 'agent_start_failed';
  message: string;
}

export type DataMessage =
  | { type: 'exercise_media'; payload: ExerciseMediaPayload }
  | { type: 'exercise_progress'; payload: ExerciseProgressPayload }
  | { type: 'rest_timer'; payload: RestTimerPayload }
  | { type: 'session_ready'; payload: SessionReadyPayload }
  | { type: 'session_failed'; payload: SessionFailedPayload };

export function encodeDataMessage(msg: DataMessage): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(msg));
}

export function decodeDataMessage(data: Uint8Array): DataMessage | null {
  try {
    const text = new TextDecoder().decode(data);
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed.type === 'string' && parsed.payload) {
      return parsed as DataMessage;
    }
    return null;
  } catch {
    return null;
  }
}
