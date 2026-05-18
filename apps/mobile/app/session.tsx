import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export default function SessionScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.statusContainer}>
        <View style={styles.statusDot} />
        <Text style={styles.statusText}>Connecting...</Text>
      </View>

      <Text style={styles.listening}>Listening</Text>

      <Pressable style={styles.endButton} onPress={() => router.back()}>
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
    marginBottom: 48,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#f4a261',
    marginRight: 8,
  },
  statusText: {
    color: '#f4a261',
    fontSize: 14,
  },
  listening: {
    fontSize: 24,
    color: '#ffffff',
    fontWeight: '600',
    marginBottom: 64,
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
