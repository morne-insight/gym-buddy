import { useCallback, useState } from 'react';
import { useDataChannel } from '@livekit/components-react';
import type { ReceivedDataMessage } from '@livekit/components-core';

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

type DataMessage =
  | { type: 'exercise_media'; payload: ExerciseMediaPayload }
  | { type: 'exercise_progress'; payload: ExerciseProgressPayload }
  | { type: 'rest_timer'; payload: RestTimerPayload };

function decodeDataMessage(data: Uint8Array): DataMessage | null {
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

export interface DataMessageState {
  exerciseMedia: ExerciseMediaPayload | null;
  exerciseProgress: ExerciseProgressPayload | null;
  restTimer: RestTimerPayload | null;
}

export function useDataMessages() {
  const [state, setState] = useState<DataMessageState>({
    exerciseMedia: null,
    exerciseProgress: null,
    restTimer: null,
  });

  const onMessage = useCallback((msg: ReceivedDataMessage) => {
    const message = decodeDataMessage(msg.payload);
    if (!message) return;

    switch (message.type) {
      case 'exercise_media':
        setState((prev) => ({ ...prev, exerciseMedia: message.payload }));
        break;
      case 'exercise_progress':
        setState((prev) => ({ ...prev, exerciseProgress: message.payload }));
        break;
      case 'rest_timer':
        setState((prev) => ({ ...prev, restTimer: message.payload }));
        break;
    }
  }, []);

  useDataChannel(onMessage);

  const reset = useCallback(() => {
    setState({ exerciseMedia: null, exerciseProgress: null, restTimer: null });
  }, []);

  return { ...state, reset };
}
