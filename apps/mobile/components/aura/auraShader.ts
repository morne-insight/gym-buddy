// SkSL fragment shader for the Aura energy field.
//
// This is a polar (circular) port of the ShaderToy "clean lines" shader
// tffSDr (docs/shaders/tffSDr-clean-lines.glsl): a stack of additive sine
// strands with a rainbow cosine palette and crisp cores that bloom soft at the
// edges. Wrapped into a ring, the horizontal strands become undulating rings;
// the crisp-core / soft-edge quality is preserved RADIALLY — crisp woven
// strands form the band, with a soft glow toward the inner hole and outer edge
// (matching design/voice-aura.png).
//
// Driven entirely by uniforms (no per-frame React state), so all animation runs
// on the GPU. Kept lean for the entry-level SM-A260F GPU in the spirit of the
// optimized variant in docs/shaders/tffSDr-clean-lines-Comment.md: integer wave
// frequencies (seamless wrap), an inlined smoothstep polynomial, no pow(), and
// per-pixel constants hoisted out of the layer loop. Layer count scales with
// canvas size (see buildAuraSksl / AuraVisualizer).
//
// Uniforms (plumbed from AuraVisualizer via a reanimated useDerivedValue):
//   u_resolution  canvas size in px
//   u_time        elapsed seconds (continuous clock -> ambient motion)
//   u_level       smoothed audio level 0..1 (expands + energizes the ring)
//   u_speed       motion speed multiplier (per agent state)
//   u_audioAmp    how far a full audio level pushes the ring out, normalized
//   u_glow        edge softness 0..~0.7 (bigger = softer, glowier)
//   u_opacity     overall opacity 0..1

const SKSL_TEMPLATE = (layers: number) => `
uniform float2 u_resolution;
uniform float  u_time;
uniform float  u_level;
uniform float  u_speed;
uniform float  u_audioAmp;
uniform float  u_glow;
uniform float  u_opacity;

const float PI = 3.14159265;

// Rainbow cosine palette (from tffSDr): cyan / orange / purple band.
float3 palette(float t) {
  float3 a = float3(0.5);
  float3 b = float3(0.5);
  float3 c = float3(1.0);
  float3 d = float3(0.1, 0.4, 0.5);
  return a + b * cos(2.0 * PI * (c * t + d));
}

half4 main(float2 fragCoord) {
  // Centered coords, y in [-1, 1] (canvas is square, so x matches).
  float2 p = (2.0 * fragCoord - u_resolution) / u_resolution.y;
  float ang = atan(p.y, p.x);   // -PI..PI
  float rad = length(p);
  float s = ang / PI;           // -1..1, seam at +/-PI stays continuous

  float t = u_time * u_speed;
  // Base ring radius (normalized); the live audio level pushes it outward.
  float R0 = 0.52 + u_level * u_audioAmp;
  float audioBoost = 1.0 + u_level * 1.8;
  float dr = rad - R0;          // signed distance from the ring (the "y" axis)

  // --- Woven crisp strands (the clean lines) -------------------------------
  // Radial early-reject: the centre hole and outer corners are far from the
  // ring band and add no strand colour, so skip the whole loop there. Big GPU
  // win on the entry-level SM-A260F (those empty regions are large contiguous
  // blocks). 0.36 safely exceeds the max strand reach (amp + thickness at full
  // audio), so no strand is ever clipped.
  float3 strands = float3(0.0);
  const int N = ${layers};
  if (abs(dr) < 0.36) {
    for (int i = 0; i < N; i++) {
      float layer = float(i) / float(N);
      // Amplitude breathes per layer and grows with audio.
      float amp = (0.05 + 0.05 * sin(t + layer * 6.2832) * (1.0 - layer)) * audioBoost;
      // Integer lobe count -> the ring closes seamlessly at the +/-PI seam.
      float freq = 3.0 + floor(layer * 3.5);   // 3..6
      float phase = t * (1.0 - 0.6 * layer);
      float wy = dr + amp * sin(freq * ang - phase);
      // Crisp core: thin band, slightly softer on outer layers + with glow.
      float thick = (0.010 + u_glow * 0.012) * (1.0 + 0.6 * layer);
      float x = 1.0 - abs(wy) / thick;
      float bright = x > 0.0 ? x * x * (3.0 - 2.0 * x) : 0.0; // inlined smoothstep
      strands += bright * palette(0.5 * s + layer - 0.3 * t);
    }
  }

  // --- Soft radial halo (the blurred inner/outer edges) --------------------
  float hw = 0.15 + u_glow * 0.09 + u_level * 0.05;   // halo half-width
  float halo = exp(-(dr * dr) / (2.0 * hw * hw));
  float3 color = strands + halo * palette(0.5 * s - 0.3 * t) * 0.30;

  // Vignette: fade to zero before the square canvas edge so the Canvas bounds
  // never show as a faint rectangle (the radial glow otherwise reaches the
  // vertical edges/corners at high audio levels).
  color *= 1.0 - smoothstep(0.85, 1.0, rad);

  // Emissive premultiplied output over the dark session background.
  color = clamp(color, 0.0, 1.0);
  float lum = max(max(color.r, color.g), color.b);
  float a = lum * u_opacity;
  return half4(color * u_opacity, a);
}
`;

/**
 * Build the Aura SkSL source. `layers` is the number of additive strands and
 * the dominant cost knob: more strands = richer weave, more GPU work. The bound
 * is injected as a compile-time literal because SkSL loop bounds must be
 * constant. AuraVisualizer scales it down on small canvases for the SM-A260F.
 */
export function buildAuraSksl(layers = 10): string {
  return SKSL_TEMPLATE(layers);
}
