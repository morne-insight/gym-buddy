import { View, Text, StyleSheet } from 'react-native';
import type { ExerciseProgressPayload } from '../hooks/useDataMessages';

interface ExerciseDataCardProps {
  progress: ExerciseProgressPayload | null;
}

export function ExerciseDataCard({ progress }: ExerciseDataCardProps) {
  if (!progress) {
    return (
      <View style={styles.card}>
        <Text style={styles.loadingText}>Waiting for workout data...</Text>
      </View>
    );
  }

  const isComplete = progress.exerciseIndex >= progress.totalExercises - 1 &&
    progress.completedSets >= progress.targetSets;

  if (isComplete) {
    return (
      <View style={styles.card}>
        <Text style={styles.completeText}>Workout Complete</Text>
      </View>
    );
  }

  const setIndicators = Array.from({ length: progress.targetSets }, (_, i) => (
    <View
      key={i}
      style={[
        styles.setDot,
        i < progress.completedSets ? styles.setDotCompleted : styles.setDotPending,
      ]}
    />
  ));

  return (
    <View style={styles.card}>
      <Text style={styles.exerciseLabel}>
        {progress.exerciseIndex + 1}/{progress.totalExercises}
      </Text>
      <Text style={styles.exerciseName}>{progress.exerciseName}</Text>
      <Text style={styles.setInfo}>
        Set {progress.currentSetNumber} of {progress.targetSets}
      </Text>
      <Text style={styles.targetInfo}>
        {progress.targetReps} reps{progress.targetWeight ? ` @ ${progress.targetWeight}kg` : ''}
      </Text>
      <View style={styles.setIndicators}>{setIndicators}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    alignItems: 'center',
  },
  loadingText: {
    color: '#888888',
    fontSize: 14,
  },
  completeText: {
    color: '#4ecdc4',
    fontSize: 20,
    fontWeight: '700',
  },
  exerciseLabel: {
    color: '#888888',
    fontSize: 12,
    marginBottom: 4,
  },
  exerciseName: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  setInfo: {
    color: '#4ecdc4',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  targetInfo: {
    color: '#cccccc',
    fontSize: 14,
    marginBottom: 12,
  },
  setIndicators: {
    flexDirection: 'row',
    gap: 6,
  },
  setDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  setDotCompleted: {
    backgroundColor: '#4ecdc4',
  },
  setDotPending: {
    backgroundColor: '#333333',
  },
});
