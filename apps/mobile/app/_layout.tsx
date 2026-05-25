import { Stack } from 'expo-router';
import { registerGlobals } from '@livekit/react-native';
import { ConnectionProvider } from '../hooks/useConnection';

registerGlobals();

export default function RootLayout() {
  return (
    <ConnectionProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0a0a0a' },
          headerTintColor: '#ffffff',
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Gym Buddy' }} />
        <Stack.Screen name="session" options={{ title: 'Workout Session', headerShown: false }} />
      </Stack>
    </ConnectionProvider>
  );
}
