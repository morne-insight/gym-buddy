import { useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useConnection } from '../hooks/useConnection';

export default function HomeScreen() {
  const router = useRouter();
  const { isConnectionActive, connect } = useConnection();

  useEffect(() => {
    if (isConnectionActive) {
      router.push('/session');
    }
  }, [isConnectionActive, router]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gym Buddy</Text>
      <Text style={styles.subtitle}>Your AI training partner</Text>

      <Pressable
        style={styles.button}
        onPress={connect}
        disabled={isConnectionActive}
      >
        {isConnectionActive ? (
          <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
        ) : null}
        <Text style={styles.buttonText}>
          {isConnectionActive ? 'Connecting...' : 'Start Workout'}
        </Text>
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
});
