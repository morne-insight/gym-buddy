export interface ExerciseInfoData {
  name: string;
  targetMuscles: string[];
  instructions: string[];
  gifUrl: string;
}

export type ExerciseInfoFetcher = (exerciseName: string) => Promise<ExerciseInfoData | null>;

export interface ExerciseInfoResult {
  found: boolean;
  exercise: ExerciseInfoData | null;
  error?: string;
}

const cache = new Map<string, ExerciseInfoData | null>();

export async function getExerciseInfo(
  exerciseName: string,
  fetcher: ExerciseInfoFetcher,
): Promise<ExerciseInfoResult> {
  const key = exerciseName.toLowerCase();

  if (cache.has(key)) {
    const cached = cache.get(key)!;
    return cached ? { found: true, exercise: cached } : { found: false, exercise: null };
  }

  try {
    const data = await fetcher(exerciseName);
    cache.set(key, data);

    if (data) {
      return { found: true, exercise: data };
    }
    return { found: false, exercise: null };
  } catch (err) {
    return {
      found: false,
      exercise: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function clearExerciseInfoCache() {
  cache.clear();
}
