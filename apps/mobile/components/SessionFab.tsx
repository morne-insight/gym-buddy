import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { useState, useRef } from 'react';

interface SessionFabProps {
  onShowExercise: () => void;
  onToggleProgress: () => void;
  exerciseAvailable: boolean;
  progressPinned: boolean;
}

export function SessionFab({
  onShowExercise,
  onToggleProgress,
  exerciseAvailable,
  progressPinned,
}: SessionFabProps) {
  const [open, setOpen] = useState(false);
  const animation = useRef(new Animated.Value(0)).current;

  const toggleMenu = () => {
    const toValue = open ? 0 : 1;
    Animated.spring(animation, {
      toValue,
      useNativeDriver: true,
      friction: 6,
    }).start();
    setOpen(!open);
  };

  const exerciseTranslate = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -120],
  });

  const progressTranslate = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -60],
  });

  const menuOpacity = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <View style={styles.container}>
      <Animated.View
        style={[styles.menuItem, { opacity: menuOpacity, transform: [{ translateY: exerciseTranslate }] }]}
      >
        <Pressable
          style={[styles.menuButton, !exerciseAvailable && styles.menuButtonDisabled]}
          onPress={() => {
            if (exerciseAvailable) {
              onShowExercise();
              toggleMenu();
            }
          }}
          disabled={!exerciseAvailable}
        >
          <Text style={styles.menuIcon}>🏋️</Text>
          <Text style={[styles.menuLabel, !exerciseAvailable && styles.menuLabelDisabled]}>
            Show Exercise
          </Text>
        </Pressable>
      </Animated.View>

      <Animated.View
        style={[styles.menuItem, { opacity: menuOpacity, transform: [{ translateY: progressTranslate }] }]}
      >
        <Pressable
          style={[styles.menuButton, progressPinned && styles.menuButtonActive]}
          onPress={() => {
            onToggleProgress();
            toggleMenu();
          }}
        >
          <Text style={styles.menuIcon}>📊</Text>
          <Text style={styles.menuLabel}>
            {progressPinned ? 'Unpin Progress' : 'Pin Progress'}
          </Text>
        </Pressable>
      </Animated.View>

      <Pressable style={styles.fab} onPress={toggleMenu}>
        <Text style={styles.fabIcon}>{open ? '✕' : '+'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    right: 24,
    alignItems: 'center',
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4ecdc4',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabIcon: {
    fontSize: 24,
    color: '#0a0a0a',
    fontWeight: '700',
  },
  menuItem: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  menuButtonDisabled: {
    opacity: 0.4,
  },
  menuButtonActive: {
    backgroundColor: '#4ecdc4',
  },
  menuIcon: {
    fontSize: 16,
  },
  menuLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '500',
  },
  menuLabelDisabled: {
    color: '#888888',
  },
});
