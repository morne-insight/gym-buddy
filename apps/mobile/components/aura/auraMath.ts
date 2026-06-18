// Pure, framework-free math for the Aura visualizer.
//
// These helpers are deliberately free of Skia/React/Reanimated imports so they
// can be unit-tested directly (see auraMath.test.ts). The geometry helpers are
// marked as worklets so they can also run on the UI thread inside the Skia
// `useDerivedValue` path builder — the 'worklet' directive is an inert string
// when the functions are called on the JS thread (e.g. in tests).

/** Clamp a number into the inclusive 0..1 range. */
export function clamp01(x: number): number {
  'worklet';
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

/** Linear interpolation from a to b by t (t is not clamped). */
export function lerp(a: number, b: number, t: number): number {
  'worklet';
  return a + (b - a) * t;
}

/**
 * Reduce the per-band FFT magnitudes from `useMultibandTrackVolume` into a
 * single normalized 0..1 audio level. Each band is clamped before averaging so
 * a single hot band can't push the result out of range, and an empty array
 * (missing / placeholder track) yields 0.
 */
export function reduceMagnitudes(magnitudes: number[]): number {
  if (!magnitudes || magnitudes.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < magnitudes.length; i++) {
    sum += clamp01(magnitudes[i] ?? 0);
  }
  return clamp01(sum / magnitudes.length);
}

/**
 * Convert a `#rrggbb` hex colour to a linear 0..1 RGB triple for use as an SkSL
 * `float3` uniform. (The Aura energy field is now a shader, so colours are
 * passed to the GPU as numeric vectors rather than CSS strings.)
 */
export function hexToVec3(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  return [r, g, b];
}

/** Visual treatment for a given agent state. */
export interface AuraVisual {
  /** sweep-gradient colour stops (>= 2) */
  colors: string[];
  /** wobble rotation speed */
  speed: number;
  /** blur radius for the glow, px */
  glow: number;
  /** how strongly the audio level expands the ring, px */
  audioAmp: number;
  /** how many lobes the ring has */
  lobes: number;
  /** resting opacity of the ring */
  opacity: number;
}

// Aura brand palette (cyan -> purple), per design/voice-aura.png. Base cyan
// matches LiveKit's Aura default (#1FD5F9).
const CYAN = '#1FD5F9';
const PURPLE = '#A855F7';
const PINK = '#EC4899';
const AMBER = '#F4A261';
const GREY = '#3A4250';

const DEFAULT_VISUAL: AuraVisual = {
  colors: [CYAN, PURPLE, CYAN],
  speed: 1,
  glow: 18,
  audioAmp: 28,
  lobes: 5,
  opacity: 0.9,
};

/**
 * Map an agent state to its Aura treatment. This is an intentionally rough
 * first pass — per-state choreography is refined after the base aura is
 * validated on device (see the change's design.md). Returns a safe default for
 * unknown states.
 */
export function auraVisualForState(state: string | undefined): AuraVisual {
  switch (state) {
    case 'connecting':
    case 'initializing':
      // Calm, slow, dim — clearly "warming up", not failed/frozen.
      return { colors: [GREY, CYAN, GREY], speed: 0.4, glow: 12, audioAmp: 0, lobes: 4, opacity: 0.55 };
    case 'listening':
      // The design north-star palette (cyan -> purple -> pink, per
      // voice-aura.png). Calmness comes from the lower opacity/glow/audioAmp and
      // slower speed below, not from desaturating to cyan-only.
      return { colors: [CYAN, PURPLE, PINK], speed: 0.8, glow: 16, audioAmp: 18, lobes: 5, opacity: 0.85 };
    case 'thinking':
      // Warmer accent, faster wobble; not strongly audio-reactive.
      return { colors: [CYAN, AMBER, PURPLE], speed: 1.6, glow: 18, audioAmp: 8, lobes: 6, opacity: 0.9 };
    case 'speaking':
      // Brightest, biggest audio-reactive pulse — the Buddy is talking.
      return { colors: [CYAN, PURPLE, PINK], speed: 1.2, glow: 26, audioAmp: 48, lobes: 5, opacity: 1 };
    case 'disconnected':
    case 'failed':
      return { colors: [GREY, '#5A6270', GREY], speed: 0.25, glow: 8, audioAmp: 0, lobes: 4, opacity: 0.4 };
    default:
      return DEFAULT_VISUAL;
  }
}
