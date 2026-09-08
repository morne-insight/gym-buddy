import { useCallback, useState } from 'react';
import { useDataChannel } from '@livekit/components-react';
import type { ReceivedDataMessage } from '@livekit/components-core';

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

type DataMessageBytes = Uint8Array | ArrayBuffer | ArrayBufferView;

function toUint8Array(data: DataMessageBytes): Uint8Array {
  if (data instanceof Uint8Array) {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}

function decodeUtf8(data: DataMessageBytes): string {
  const bytes = toUint8Array(data);

  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder().decode(bytes);
  }

  let output = '';
  for (let i = 0; i < bytes.length; i += 1) {
    const byte = bytes[i]!;

    if (byte < 0x80) {
      output += String.fromCharCode(byte);
    } else if (byte >= 0xc0 && byte < 0xe0) {
      const byte2 = bytes[++i]!;
      output += String.fromCharCode(((byte & 0x1f) << 6) | (byte2 & 0x3f));
    } else if (byte >= 0xe0 && byte < 0xf0) {
      const byte2 = bytes[++i]!;
      const byte3 = bytes[++i]!;
      output += String.fromCharCode(
        ((byte & 0x0f) << 12) | ((byte2 & 0x3f) << 6) | (byte3 & 0x3f),
      );
    } else {
      const byte2 = bytes[++i]!;
      const byte3 = bytes[++i]!;
      const byte4 = bytes[++i]!;
      const codePoint =
        ((byte & 0x07) << 18) | ((byte2 & 0x3f) << 12) | ((byte3 & 0x3f) << 6) | (byte4 & 0x3f);
      output += String.fromCodePoint(codePoint);
    }
  }
  return output;
}

export function decodeDataMessage(data: DataMessageBytes): DataMessage | null {
  try {
    const text = decodeUtf8(data);
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
  sessionReady: SessionReadyPayload | null;
  sessionFailed: SessionFailedPayload | null;
}

export function useDataMessages(activeAttempt?: { attemptId: string | null; roomName: string | null }) {
  const [state, setState] = useState<DataMessageState>({
    exerciseMedia: null,
    exerciseProgress: null,
    restTimer: null,
    sessionReady: null,
    sessionFailed: null,
  });

  const onMessage = useCallback((msg: ReceivedDataMessage) => {
    const message = decodeDataMessage(msg.payload);
    if (!message) return;

    switch (message.type) {
      case 'exercise_media':
        setState((prev) => ({ ...prev, exerciseMedia: message.payload }));
        break;
      case 'exercise_progress':
        if (
          message.payload.attemptId &&
          message.payload.roomName &&
          activeAttempt &&
          (message.payload.attemptId !== activeAttempt.attemptId ||
            message.payload.roomName !== activeAttempt.roomName)
        ) {
          break;
        }
        setState((prev) => ({ ...prev, exerciseProgress: message.payload }));
        break;
      case 'rest_timer':
        setState((prev) => ({ ...prev, restTimer: message.payload }));
        break;
      case 'session_ready':
        setState((prev) => ({
          ...prev,
          sessionReady: message.payload,
          exerciseProgress: message.payload.initialExerciseProgress ?? prev.exerciseProgress,
        }));
        break;
      case 'session_failed':
        setState((prev) => ({ ...prev, sessionFailed: message.payload }));
        break;
    }
  }, [activeAttempt]);

  useDataChannel(onMessage);

  const reset = useCallback(() => {
    setState({
      exerciseMedia: null,
      exerciseProgress: null,
      restTimer: null,
      sessionReady: null,
      sessionFailed: null,
    });
  }, []);

  return { ...state, reset };
}
