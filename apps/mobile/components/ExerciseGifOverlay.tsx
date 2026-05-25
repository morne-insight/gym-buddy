import { View, Text, Image, Pressable, StyleSheet, Modal } from 'react-native';

interface ExerciseGifOverlayProps {
  visible: boolean;
  gifUrl: string | null;
  exerciseName: string | null;
  onDismiss: () => void;
}

export function ExerciseGifOverlay({ visible, gifUrl, exerciseName, onDismiss }: ExerciseGifOverlayProps) {
  if (!gifUrl || !exerciseName) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <View style={styles.container}>
          <Image source={{ uri: gifUrl }} style={styles.gif} resizeMode="contain" />
          <Text style={styles.label}>{exerciseName}</Text>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    width: '85%',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  gif: {
    width: '100%',
    height: 280,
    borderRadius: 8,
  },
  label: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
  },
});
