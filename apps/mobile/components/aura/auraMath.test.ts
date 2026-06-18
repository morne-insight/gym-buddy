import {
  clamp01,
  lerp,
  reduceMagnitudes,
  hexToVec3,
  auraVisualForState,
} from './auraMath';

describe('clamp01', () => {
  it('passes through values already in range', () => {
    expect(clamp01(0)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(1)).toBe(1);
  });

  it('clamps out-of-range values', () => {
    expect(clamp01(-3)).toBe(0);
    expect(clamp01(2.5)).toBe(1);
  });
});

describe('lerp', () => {
  it('interpolates linearly', () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(0, 10, 0.5)).toBe(5);
  });
});

describe('reduceMagnitudes', () => {
  it('returns 0 for an empty/placeholder track', () => {
    expect(reduceMagnitudes([])).toBe(0);
  });

  it('returns 0 when all bands are silent', () => {
    expect(reduceMagnitudes([0, 0, 0, 0, 0])).toBe(0);
  });

  it('returns 1 when all bands are at full magnitude', () => {
    expect(reduceMagnitudes([1, 1, 1, 1])).toBe(1);
  });

  it('averages the bands into a normalized level', () => {
    expect(reduceMagnitudes([0, 1])).toBeCloseTo(0.5, 5);
    expect(reduceMagnitudes([0.2, 0.4, 0.6])).toBeCloseTo(0.4, 5);
  });

  it('clamps each band into 0..1 before averaging', () => {
    // -1 -> 0, 3 -> 1, mean = 0.5
    expect(reduceMagnitudes([-1, 3])).toBeCloseTo(0.5, 5);
  });

  it('always returns a value within 0..1', () => {
    const out = reduceMagnitudes([5, 5, 5]);
    expect(out).toBeGreaterThanOrEqual(0);
    expect(out).toBeLessThanOrEqual(1);
  });
});

describe('hexToVec3', () => {
  it('converts black and white to the 0..1 range', () => {
    expect(hexToVec3('#000000')).toEqual([0, 0, 0]);
    expect(hexToVec3('#ffffff')).toEqual([1, 1, 1]);
  });

  it('tolerates a missing leading hash', () => {
    expect(hexToVec3('ff0000')).toEqual([1, 0, 0]);
  });

  it('converts each channel independently', () => {
    const [r, g, b] = hexToVec3('#1FD5F9');
    expect(r).toBeCloseTo(0x1f / 255, 5);
    expect(g).toBeCloseTo(0xd5 / 255, 5);
    expect(b).toBeCloseTo(0xf9 / 255, 5);
  });
});

describe('auraVisualForState', () => {
  const states = [
    'connecting',
    'initializing',
    'listening',
    'thinking',
    'speaking',
    'disconnected',
    'failed',
  ] as const;

  it('returns a usable visual for every known state', () => {
    for (const s of states) {
      const v = auraVisualForState(s);
      expect(v.colors.length).toBeGreaterThanOrEqual(2);
      expect(v.speed).toBeGreaterThanOrEqual(0);
      expect(v.glow).toBeGreaterThanOrEqual(0);
      expect(v.audioAmp).toBeGreaterThanOrEqual(0);
    }
  });

  it('falls back to a safe default for an unknown state', () => {
    const v = auraVisualForState('something-unexpected');
    expect(v.colors.length).toBeGreaterThanOrEqual(2);
  });

  it('gives speaking a stronger audio-reactive pulse than listening', () => {
    expect(auraVisualForState('speaking').audioAmp).toBeGreaterThan(
      auraVisualForState('listening').audioAmp,
    );
  });

  it('makes connecting calmer (slower) than thinking', () => {
    expect(auraVisualForState('connecting').speed).toBeLessThan(
      auraVisualForState('thinking').speed,
    );
  });
});
