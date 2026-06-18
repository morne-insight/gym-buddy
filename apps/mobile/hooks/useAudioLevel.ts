import { useMemo } from 'react';
import type { TrackReferenceOrPlaceholder } from '@livekit/components-react';
import { useMultibandTrackVolume } from '@livekit/react-native';
import { reduceMagnitudes } from '../components/aura/auraMath';

/**
 * Live, normalized 0..1 audio level for an agent audio track.
 *
 * Wraps the **native** (FFT-backed) `useMultibandTrackVolume` from
 * `@livekit/react-native` — NOT the Web-Audio hook of the same name in
 * `@livekit/components-react`, which does not work on React Native. The
 * per-band magnitudes are reduced to a single normalized level via the pure
 * `reduceMagnitudes` helper.
 *
 * Keep this hook inside the visualizer subtree: it updates at ~25fps (the
 * native default of one update every 40ms), so co-locating it with the Skia
 * canvas keeps those re-renders scoped to the visualizer.
 *
 * Returns 0 when no track is available yet (placeholder).
 */
export function useAudioLevel(
  audioTrack?: TrackReferenceOrPlaceholder,
  bands = 7,
): number {
  const magnitudes = useMultibandTrackVolume(audioTrack, {
    bands,
    updateInterval: 40,
  });
  return useMemo(() => reduceMagnitudes(magnitudes), [magnitudes]);
}
