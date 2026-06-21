import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useVoiceAssistant } from '@livekit/components-react';
import type { VoiceAssistant } from '@livekit/components-react';
import { useConnection } from '../hooks/useConnection';
import { useDataMessages } from '../hooks/useDataMessages';
import { ExerciseGifOverlay } from '../components/ExerciseGifOverlay';
import { ExerciseDataCard } from '../components/ExerciseDataCard';
import { RestTimer } from '../components/RestTimer';
import { SessionFab } from '../components/SessionFab';
import { AuraVisualizer } from '../components/AuraVisualizer';

// Derive the status from the agent's semantic flags rather than the raw state
// string. The AgentState union includes states the UI used to miss
// (pre-connect-buffering, idle, disconnected, failed), all of which previously
// fell through to "Connecting..." — leaving the label stuck on "Connecting..."
// even after the agent was connected and listening.
function agentStatus(assistant: VoiceAssistant): { label: string; color: string } {
  switch (assistant.state) {
    case 'speaking':
      return { label: 'Speaking', color: '#e63946' };
    case 'thinking':
      return { label: 'Thinking...', color: '#f4a261' };
    case 'listening':
      return { label: 'Listening', color: '#4ecdc4' };
    case 'failed':
      return { label: 'Connection failed', color: '#e63946' };
    case 'disconnected':
      return { label: 'Disconnected', color: '#888888' };
  }

  // pre-connect-buffering: the client can already hear the user while the
  // preconnect audio buffer is active, so treat it as listening.
  if (assistant.agent && assistant.state === 'connecting') {
    return { label: 'Listening', color: '#4ecdc4' };
  }

  // connecting / initializing / idle (isPending) — genuinely not ready yet.
  return { label: 'Connecting...', color: '#888888' };
}

export default function SessionScreen() {
  const router = useRouter();
  const { connection, disconnect } = useConnection();
  const assistant = useVoiceAssistant();
  const { state } = assistant;
  const { exerciseMedia, exerciseProgress: liveExerciseProgress, restTimer, reset } = useDataMessages({
    attemptId: connection.attemptId,
    roomName: connection.roomName,
  });
  const exerciseProgress = liveExerciseProgress ?? connection.readyPayload?.initialExerciseProgress ?? null;

  const [gifVisible, setGifVisible] = useState(false);
  const [progressPinned, setProgressPinned] = useState(false);

  const handleEnd = useCallback(async () => {
    reset();
    setGifVisible(false);
    setProgressPinned(false);
    await disconnect();
    router.back();
  }, [disconnect, router, reset]);

  const { label, color } = agentStatus(assistant);

  return (
    <View style={styles.container}>
      {progressPinned && (
        <View style={styles.cardContainer}>
          <ExerciseDataCard progress={exerciseProgress} />
        </View>
      )}

      <RestTimer timerData={restTimer} />

      <View style={styles.centerContent}>
        <View style={styles.statusContainer}>
          <View style={[styles.statusDot, { backgroundColor: color }]} />
          <Text style={[styles.statusText, { color }]}>{label}</Text>
        </View>

        <AuraVisualizer state={state} audioTrack={assistant.audioTrack} />
      </View>

      <Pressable style={styles.endButton} onPress={handleEnd}>
        <Text style={styles.endButtonText}>End Workout</Text>
      </Pressable>

      <SessionFab
        onShowExercise={() => setGifVisible(true)}
        onToggleProgress={() => setProgressPinned((prev) => !prev)}
        exerciseAvailable={!!(exerciseMedia || exerciseProgress)}
        progressPinned={progressPinned}
      />

      <ExerciseGifOverlay
        visible={gifVisible}
        gifUrl={exerciseMedia?.gifUrl ?? null}
        exerciseName={exerciseMedia?.exerciseName ?? exerciseProgress?.exerciseName ?? null}
        onDismiss={() => setGifVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    padding: 24,
  },
  cardContainer: {
    paddingTop: 48,
    paddingHorizontal: 8,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '500',
  },
  endButton: {
    backgroundColor: '#333333',
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 12,
    alignSelf: 'center',
    marginBottom: 24,
  },
  endButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
