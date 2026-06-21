import { decodeDataMessage } from './useDataMessages';

function asciiBytes(value: string): Uint8Array {
  return Uint8Array.from(Array.from(value).map((char) => char.charCodeAt(0)));
}

describe('decodeDataMessage', () => {
  it('decodes session_ready without a native TextDecoder global', () => {
    const originalTextDecoder = globalThis.TextDecoder;
    Object.defineProperty(globalThis, 'TextDecoder', {
      configurable: true,
      value: undefined,
    });

    try {
      const message = {
        type: 'session_ready',
        payload: {
          attemptId: 'workout-user-founder-123',
          roomName: 'workout-user-founder-123',
          sessionId: 'session-1',
          restDay: false,
          workoutName: 'Push Day',
          initialExerciseProgress: null,
        },
      };

      expect(decodeDataMessage(asciiBytes(JSON.stringify(message)))).toEqual(message);
    } finally {
      Object.defineProperty(globalThis, 'TextDecoder', {
        configurable: true,
        value: originalTextDecoder,
      });
    }
  });
});
