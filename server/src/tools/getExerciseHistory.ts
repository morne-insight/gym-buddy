import type Database from 'better-sqlite3';
import { getExerciseHistory } from '../db/index.js';

interface HistoryEntry {
  date: string;
  sets: number | null;
  reps: string | null;
  weight: number | null;
  skipped: boolean;
  notes: string | null;
}

type WeightTrend = 'increasing' | 'decreasing' | 'stable' | 'none';

export interface ExerciseHistoryResult {
  entries: HistoryEntry[];
  skipCount: number;
  totalSessions: number;
  weightTrend: WeightTrend;
}

function computeWeightTrend(entries: HistoryEntry[]): WeightTrend {
  const weights = entries
    .filter((e) => !e.skipped && e.weight != null)
    .map((e) => e.weight!);

  if (weights.length < 2) return 'none';

  // entries are newest-first, reverse for chronological order
  const chronological = [...weights].reverse();

  let increases = 0;
  let decreases = 0;
  for (let i = 1; i < chronological.length; i++) {
    if (chronological[i] > chronological[i - 1]) increases++;
    else if (chronological[i] < chronological[i - 1]) decreases++;
  }

  if (increases > decreases) return 'increasing';
  if (decreases > increases) return 'decreasing';
  return 'stable';
}

export function getExerciseHistoryTool(
  db: Database.Database,
  userId: string,
  exerciseName: string,
): ExerciseHistoryResult {
  const rawHistory = getExerciseHistory(db, userId, exerciseName);

  const entries: HistoryEntry[] = rawHistory.map((h) => ({
    date: h.started_at,
    sets: h.actual_sets,
    reps: h.actual_reps,
    weight: h.actual_weight,
    skipped: h.skipped === 1,
    notes: h.notes,
  }));

  const skipCount = entries.filter((e) => e.skipped).length;

  return {
    entries,
    skipCount,
    totalSessions: entries.length,
    weightTrend: computeWeightTrend(entries),
  };
}
