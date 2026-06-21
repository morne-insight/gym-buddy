import { useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useConnection } from '../hooks/useConnection';

const DEBUG_CONNECTION = process.env.EXPO_PUBLIC_DEBUG_CONNECTION === '1';

export default function HomeScreen() {
  const router = useRouter();
  const { connection, connect, disconnect } = useConnection();

  useEffect(() => {
    if (DEBUG_CONNECTION) {
      console.log('[home] connection state changed', {
        status: connection.status,
        attemptId: connection.attemptId,
        roomName: connection.roomName,
        hasReadyPayload: Boolean(connection.readyPayload),
      });
    }
    if (connection.status === 'ready') {
      router.push('/session');
    }
  }, [connection, router]);

  const starting = connection.status === 'starting';
  const failed = connection.status === 'failed';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gym Buddy</Text>
      <Text style={styles.subtitle}>Your AI training partner</Text>

      <Pressable
        style={styles.button}
        onPress={connect}
        disabled={starting || connection.status === 'disconnecting'}
      >
        {starting ? (
          <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
        ) : null}
        <Text style={styles.buttonText}>
          {starting ? 'Connecting...' : failed ? 'Retry Workout' : 'Start Workout'}
        </Text>
      </Pressable>

      {starting ? (
        <Pressable style={styles.secondaryButton} onPress={disconnect}>
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </Pressable>
      ) : null}

      {failed ? (
        <>
          <Text style={styles.errorText}>{connection.error ?? 'Unable to start workout'}</Text>
          <Pressable style={styles.secondaryButton} onPress={disconnect}>
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </Pressable>
        </>
      ) : null}
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
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888888',
    marginBottom: 48,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e63946',
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 12,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButton: {
    marginTop: 16,
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: '#bbbbbb',
    fontSize: 16,
    fontWeight: '500',
  },
  errorText: {
    color: '#ff8a8a',
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
  },
});
