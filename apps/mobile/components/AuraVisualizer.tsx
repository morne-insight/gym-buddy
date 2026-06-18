import { memo, useEffect, useMemo } from 'react';
import { Canvas, Fill, Shader, Skia } from '@shopify/react-native-skia';
import {
  useSharedValue,
  useDerivedValue,
  useFrameCallback,
  type SharedValue,
} from 'react-native-reanimated';
import type { AgentState, TrackReferenceOrPlaceholder } from '@livekit/components-react';
import { useAudioLevel } from '../hooks/useAudioLevel';
import { auraVisualForState, lerp } from './aura/auraMath';
import { buildAuraSksl } from './aura/auraShader';

export interface AuraVisualizerProps {
  state: AgentState;
  audioTrack?: TrackReferenceOrPlaceholder;
  /** canvas width/height in px */
  size?: number;
}

// How fast eased values chase their per-state target each frame (0..1). The
// audio level chases faster (it should feel responsive); motion/intensity
// params ease more slowly so state changes glide rather than snap.
const LEVEL_EASE = 0.15;
const PARAM_EASE = 0.08;

// Map the px-based AuraVisual params (tuned for the old Path renderer) onto the
// shader's normalized inputs.
const AUDIO_AMP_SCALE = 1 / 240; // px push -> fraction of canvas radius
const GLOW_SCALE = 1 / 40; // px blur -> edge softness 0..~0.65

/**
 * Leaf that samples the live audio level (~25fps) and writes it into a shared
 * value, rendering nothing. Isolating the hook here keeps its frequent
 * re-renders off the Canvas host: AuraVisualizer no longer re-renders on every
 * audio sample (only on agent-state changes), which removes the periodic
 * JS-thread reconciliation that showed up as micro-jank on low-end devices.
 */
const AudioLevelProbe = memo(function AudioLevelProbe({
  audioTrack,
  level,
}: {
  audioTrack?: TrackReferenceOrPlaceholder;
  level: SharedValue<number>;
}) {
  const value = useAudioLevel(audioTrack);
  useEffect(() => {
    level.value = value;
  }, [value, level]);
  return null;
});

/**
 * Native, audio-reactive "Aura" voice visualizer (replaces the old static
 * circle on the session screen).
 *
 * Rendered as a Skia `RuntimeEffect` (SkSL) — see components/aura/auraShader.ts
 * — a circular port of the ShaderToy "clean lines" shader: woven, undulating
 * rainbow strands with crisp cores and a soft radial glow on the inner/outer
 * edges. A single reanimated frame callback advances the clock, smooths the
 * live audio level (sampled by AudioLevelProbe), and eases the per-state
 * motion/intensity params toward their targets; a derived value packs them into
 * the shader uniforms. All animation lives on the UI/GPU thread, so it never
 * re-renders SessionScreen.
 *
 * Agent state is reflected through motion/intensity (speed, audio expansion,
 * edge softness, opacity) rather than hue, preserving the rainbow look.
 */
export const AuraVisualizer = memo(function AuraVisualizer({
  state,
  audioTrack,
  size = 280,
}: AuraVisualizerProps) {
  const visual = auraVisualForState(state);

  // Strand count scales with canvas size: fewer strands on small canvases keeps
  // the entry-level SM-A260F GPU comfortable (see tasks 7.5).
  const layers = size <= 240 ? 6 : 8;
  const effect = useMemo(
    () => Skia.RuntimeEffect.Make(buildAuraSksl(layers)),
    [layers],
  );

  // Continuous clock + smoothed audio level (the probe writes the raw level).
  const clock = useSharedValue(0);
  const smooth = useSharedValue(0);
  const target = useSharedValue(0);

  // Eased per-state params (current value chases the target each frame).
  const speed = useSharedValue(visual.speed);
  const audioAmp = useSharedValue(visual.audioAmp * AUDIO_AMP_SCALE);
  const glow = useSharedValue(visual.glow * GLOW_SCALE);
  const opacity = useSharedValue(visual.opacity);

  // Targets the eased values chase. Updated only when the agent state changes.
  const speedT = useSharedValue(speed.value);
  const audioAmpT = useSharedValue(audioAmp.value);
  const glowT = useSharedValue(glow.value);
  const opacityT = useSharedValue(opacity.value);

  useEffect(() => {
    speedT.value = visual.speed;
    audioAmpT.value = visual.audioAmp * AUDIO_AMP_SCALE;
    glowT.value = visual.glow * GLOW_SCALE;
    opacityT.value = visual.opacity;
  }, [visual, speedT, audioAmpT, glowT, opacityT]);

  useFrameCallback((info) => {
    'worklet';
    clock.value = info.timeSinceFirstFrame; // ms
    smooth.value = lerp(smooth.value, target.value, LEVEL_EASE);

    speed.value = lerp(speed.value, speedT.value, PARAM_EASE);
    audioAmp.value = lerp(audioAmp.value, audioAmpT.value, PARAM_EASE);
    glow.value = lerp(glow.value, glowT.value, PARAM_EASE);
    opacity.value = lerp(opacity.value, opacityT.value, PARAM_EASE);
  });

  const uniforms = useDerivedValue(() => ({
    u_resolution: [size, size],
    u_time: clock.value / 1000,
    u_level: smooth.value,
    u_speed: speed.value,
    u_audioAmp: audioAmp.value,
    u_glow: glow.value,
    u_opacity: opacity.value,
  }));

  // RuntimeEffect.Make returns null on a compile error; render nothing rather
  // than crash (the shader is validated on first device run — tasks 7.1).
  if (!effect) return null;

  return (
    <>
      <AudioLevelProbe audioTrack={audioTrack} level={target} />
      <Canvas style={{ width: size, height: size }}>
        <Fill>
          <Shader source={effect} uniforms={uniforms} />
        </Fill>
      </Canvas>
    </>
  );
});
