import { getExerciseInfo, clearExerciseInfoCache, type ExerciseInfoFetcher } from './getExerciseInfo.js';
import { beforeEach, describe, it, expect } from '@jest/globals';

beforeEach(() => {
  clearExerciseInfoCache();
});

describe('getExerciseInfo', () => {
  const mockFetcher: ExerciseInfoFetcher = async (name: string) => {
    if (name.toLowerCase().includes('bench press')) {
      return {
        name: 'Barbell Bench Press',
        targetMuscles: ['pectorals'],
        instructions: ['Lie on bench', 'Grip bar', 'Lower to chest', 'Press up'],
        gifUrl: 'https://example.com/bench-press.gif',
      };
    }
    return null;
  };

  it('returns exercise info for a known exercise', async () => {
    const result = await getExerciseInfo('bench press', mockFetcher);
    expect(result.found).toBe(true);
    expect(result.exercise!.name).toBe('Barbell Bench Press');
    expect(result.exercise!.targetMuscles).toContain('pectorals');
    expect(result.exercise!.instructions).toHaveLength(4);
    expect(result.exercise!.gifUrl).toBe('https://example.com/bench-press.gif');
  });

  it('returns not found for unknown exercise', async () => {
    const result = await getExerciseInfo('underwater basket weaving', mockFetcher);
    expect(result.found).toBe(false);
    expect(result.exercise).toBeNull();
  });

  it('handles API errors gracefully', async () => {
    const failingFetcher: ExerciseInfoFetcher = async () => {
      throw new Error('API timeout');
    };

    const result = await getExerciseInfo('bench press', failingFetcher);
    expect(result.found).toBe(false);
    expect(result.error).toBe('API timeout');
  });

  it('uses cached results for repeated lookups', async () => {
    let callCount = 0;
    const countingFetcher: ExerciseInfoFetcher = async (name: string) => {
      callCount++;
      return {
        name,
        targetMuscles: ['chest'],
        instructions: ['Do the thing'],
        gifUrl: 'https://example.com/exercise.gif',
      };
    };

    await getExerciseInfo('bench press', countingFetcher);
    await getExerciseInfo('bench press', countingFetcher);
    await getExerciseInfo('bench press', countingFetcher);

    expect(callCount).toBe(1);
  });

  it('caches per exercise name (case-insensitive)', async () => {
    let callCount = 0;
    const countingFetcher: ExerciseInfoFetcher = async (name: string) => {
      callCount++;
      return {
        name,
        targetMuscles: ['chest'],
        instructions: ['Press'],
        gifUrl: 'https://example.com/exercise.gif',
      };
    };

    await getExerciseInfo('Bench Press', countingFetcher);
    await getExerciseInfo('bench press', countingFetcher);
    await getExerciseInfo('BENCH PRESS', countingFetcher);

    expect(callCount).toBe(1);
  });
});
