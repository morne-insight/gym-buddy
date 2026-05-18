import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Gym Buddy' }} />
      <Stack.Screen name="session" options={{ title: 'Workout Session', headerBackTitle: 'End' }} />
    </Stack>
  );
}
