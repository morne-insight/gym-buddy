export interface ExerciseMediaPayload {
  gifUrl: string;
  exerciseName: string;
}

export interface ExerciseProgressPayload {
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

export type DataMessage =
  | { type: 'exercise_media'; payload: ExerciseMediaPayload }
  | { type: 'exercise_progress'; payload: ExerciseProgressPayload }
  | { type: 'rest_timer'; payload: RestTimerPayload };

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
