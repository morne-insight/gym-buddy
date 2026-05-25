import { View, Text, StyleSheet } from 'react-native';
import { useEffect, useState, useRef } from 'react';
import type { RestTimerPayload } from '../hooks/useDataMessages';

interface RestTimerProps {
  timerData: RestTimerPayload | null;
}

export function RestTimer({ timerData }: RestTimerProps) {
  const [remaining, setRemaining] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!timerData || timerData.action === 'end') {
      setRemaining(0);
      return;
    }

    setRemaining(timerData.durationSeconds);

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          intervalRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timerData]);

  if (remaining <= 0) return null;

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const display = minutes > 0
    ? `${minutes}:${seconds.toString().padStart(2, '0')}`
    : `${seconds}`;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>REST</Text>
      <Text style={styles.timer}>{display}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  label: {
    color: '#f4a261',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 4,
    marginBottom: 4,
  },
  timer: {
    color: '#ffffff',
    fontSize: 56,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
