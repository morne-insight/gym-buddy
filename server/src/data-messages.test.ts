import { describe, it, expect } from '@jest/globals';
import { encodeDataMessage, decodeDataMessage, type DataMessage } from './data-messages.js';
import { publishDataMessage, type DataPublisher } from './publish-data.js';

describe('DataMessage encoding/decoding', () => {
  it('encodes and decodes exercise_media message', () => {
    const msg: DataMessage = {
      type: 'exercise_media',
      payload: { gifUrl: 'https://example.com/bench.gif', exerciseName: 'Bench Press' },
    };

    const encoded = encodeDataMessage(msg);
    const decoded = decodeDataMessage(encoded);

    expect(decoded).toEqual(msg);
  });

  it('encodes and decodes exercise_progress message', () => {
    const msg: DataMessage = {
      type: 'exercise_progress',
      payload: {
        exerciseName: 'Overhead Press',
        targetSets: 3,
        targetReps: '10-12',
        targetWeight: 40,
        completedSets: 1,
        currentSetNumber: 2,
        exerciseIndex: 1,
        totalExercises: 3,
      },
    };

    const encoded = encodeDataMessage(msg);
    const decoded = decodeDataMessage(encoded);

    expect(decoded).toEqual(msg);
  });

  it('encodes and decodes rest_timer message', () => {
    const msg: DataMessage = {
      type: 'rest_timer',
      payload: { action: 'start', durationSeconds: 90 },
    };

    const encoded = encodeDataMessage(msg);
    const decoded = decodeDataMessage(encoded);

    expect(decoded).toEqual(msg);
  });

  it('returns null for invalid data', () => {
    const invalid = new TextEncoder().encode('not json');
    expect(decodeDataMessage(invalid)).toBeNull();
  });

  it('returns null for valid JSON without required fields', () => {
    const noType = new TextEncoder().encode(JSON.stringify({ foo: 'bar' }));
    expect(decodeDataMessage(noType)).toBeNull();
  });
});

describe('publishDataMessage', () => {
  it('publishes encoded data with reliable mode', async () => {
    let publishedData: Uint8Array | null = null;
    let publishedOptions: { reliable: boolean } | null = null;

    const mockPublisher: DataPublisher = {
      publishData: async (data, options) => {
        publishedData = data;
        publishedOptions = options;
      },
    };

    const msg: DataMessage = {
      type: 'exercise_media',
      payload: { gifUrl: 'https://example.com/curl.gif', exerciseName: 'Bicep Curl' },
    };

    await publishDataMessage(mockPublisher, msg);

    expect(publishedOptions).toEqual({ reliable: true });
    expect(publishedData).not.toBeNull();

    const decoded = decodeDataMessage(publishedData!);
    expect(decoded).toEqual(msg);
  });
});
