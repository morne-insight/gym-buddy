import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAgent } from '@livekit/components-react';
import { useConnection } from '../hooks/useConnection';

function stateLabel(state: string | undefined): string {
  switch (state) {
    case 'connecting':
    case 'initializing':
      return 'Connecting...';
    case 'listening':
      return 'Listening';
    case 'thinking':
      return 'Thinking...';
    case 'speaking':
      return 'Speaking';
    default:
      return 'Connecting...';
  }
}

function stateColor(state: string | undefined): string {
  switch (state) {
    case 'listening':
      return '#4ecdc4';
    case 'thinking':
      return '#f4a261';
    case 'speaking':
      return '#e63946';
    default:
      return '#888888';
  }
}

export default function SessionScreen() {
  const router = useRouter();
  const { disconnect } = useConnection();
  const { state } = useAgent();

  const handleEnd = () => {
    disconnect();
    router.back();
  };

  const color = stateColor(state);

  return (
    <View style={styles.container}>
      <View style={styles.statusContainer}>
        <View style={[styles.statusDot, { backgroundColor: color }]} />
        <Text style={[styles.statusText, { color }]}>{stateLabel(state)}</Text>
      </View>

      <View style={[styles.circle, { borderColor: color }]}>
        <Text style={styles.circleEmoji}>
          {state === 'speaking' ? '🗣️' : state === 'thinking' ? '🧠' : '🎧'}
        </Text>
      </View>

      <Pressable style={styles.endButton} onPress={handleEnd}>
        <Text style={styles.endButtonText}>End Workout</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0a0a',
    padding: 24,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 64,
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
  circle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 64,
  },
  circleEmoji: {
    fontSize: 48,
  },
  endButton: {
    backgroundColor: '#333333',
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 12,
  },
  endButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
