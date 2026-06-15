import { View, Text, Image, Pressable, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';

interface ExerciseGifOverlayProps {
  visible: boolean;
  gifUrl: string | null;
  exerciseName: string | null;
  onDismiss: () => void;
}

type LoadStatus = 'loading' | 'loaded' | 'error';

export function ExerciseGifOverlay({ visible, gifUrl, exerciseName, onDismiss }: ExerciseGifOverlayProps) {
  const [status, setStatus] = useState<LoadStatus>('loading');

  // Restart the load cycle whenever the source changes or the modal reopens,
  // so a previously-failed image is retried and the spinner shows again.
  useEffect(() => {
    setStatus('loading');
  }, [gifUrl, visible]);

  if (!exerciseName) return null;

  const showPlaceholder = !gifUrl || status === 'error';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <View style={styles.container}>
          <View style={styles.media}>
            {gifUrl && status !== 'error' && (
              <Image
                source={{ uri: gifUrl }}
                style={styles.gif}
                resizeMode="contain"
                onLoad={() => setStatus('loaded')}
                onError={() => setStatus('error')}
              />
            )}

            {gifUrl && status === 'loading' && (
              <View style={styles.mediaOverlay}>
                <ActivityIndicator color="#4ecdc4" />
              </View>
            )}

            {showPlaceholder && (
              <View style={styles.mediaOverlay}>
                <Text style={styles.placeholderIcon}>🏋️</Text>
                <Text style={styles.placeholderText}>
                  {gifUrl ? 'Image unavailable' : 'No demo image for this exercise'}
                </Text>
              </View>
            )}
          </View>

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
  media: {
    width: '100%',
    height: 280,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#0f0f0f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gif: {
    width: '100%',
    height: '100%',
  },
  mediaOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  placeholderText: {
    color: '#888888',
    fontSize: 14,
  },
  label: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
  },
});
