## Context

The session screen (`apps/mobile/app/session.tsx`) renders the Buddy as a static bordered
circle with a state emoji. The design target (`design/voice-aura.png`) is a glowing,
audio-reactive energy ring. LiveKit's official `AgentAudioVisualizerAura` is part of the
Agents UI library, which is built on **shadcn/ui + WebGL** and renders DOM (`<div>`/`<canvas>`);
it is installed via the shadcn CLI and only runs on the web. Attempting to install it into this
Expo/React Native app failed for exactly that reason. We will recreate the look natively.

Current stack (relevant): Expo SDK 54, React Native 0.81, React 19, new architecture enabled,
`react-native-reanimated` 4.1.1 + `react-native-worklets` 0.5.1, `@livekit/react-native` 2.10.3,
`@livekit/components-react` 2.9.21. `session.tsx` already has `useAgent()` exposing
`agent.audioTrack` and `agent.state`.

## Goals / Non-Goals

**Goals:**
- A native, performant, audio-reactive Aura on the session screen matching `voice-aura.png`.
- Reuse the existing native audio pipeline (no Web Audio, no WebView).
- Keep the visualizer self-contained so its high-frequency updates don't re-render the screen.
- Preserve all existing session behaviors (status, audio routing, overlays).

**Non-Goals (for the *base* milestone):**
- Using the actual web `AgentAudioVisualizerAura` component (incompatible with RN).
- Pixel-perfect reproduction of the Unicorn Studio energy field. The base milestone uses
  Path + gradient + blur; a full SkSL shader is now the **next milestone** (see the
  2026-06-17 update below) rather than a deferred maybe.
- Final, tuned per-state choreography for all four states — the base aura comes first; the four
  states get distinct-but-rough treatments now and are refined in a follow-up.

## Decisions

### Decision: Recreate natively with `@shopify/react-native-skia` (Path + sweep gradient + blur)
Skia is officially Expo-supported and resolves via `npx expo install`. We draw a closed
**wobbling ring** as an `SkPath` (N points around a circle, per-point radius = base +
time-varying noise + `audioLevel * amplitude`), stroke it with a cyan→purple→cyan
**`SweepGradient`**, and apply a **`Blur`** mask for the glow. Animation is driven by a Skia/
reanimated clock inside `useDerivedValue`, so no per-frame React state hits the render path.
- *Alternatives:* full SkSL `RuntimeEffect` shader (higher fidelity, more authoring/tuning risk
  — deferred); native `BarVisualizer` from `@livekit/react-native` (supported but wrong look);
  Expo DOM/WebView running the real component (can't pass the live audio track across the bridge,
  heavier, jank risk).

### Decision: Audio via native `useMultibandTrackVolume` from `@livekit/react-native`
This hook is FFT-backed by native code and returns `number[]` magnitudes (~25fps at the default
40ms interval). A new `hooks/useAudioLevel.ts` wraps it and reduces bands to a single normalized
`0..1` level. This is distinct from the same-named **Web Audio** hook in `@livekit/components-react`,
which does not work on RN.
- *Alternatives:* Web Audio `useMultibandTrackVolume` (unavailable in RN); custom native module
  (unnecessary — the SDK already exposes this).

### Decision: Smooth the level into a reanimated shared value
The 25fps source is mirrored into a `useSharedValue` and lerped toward its target each frame so
the ring motion is fluid and decoupled from the sampling rate. The Skia derived path reads the
smoothed shared value.

### Decision: Keep the visualizer self-contained
`useAudioLevel` and all animation live inside `AuraVisualizer`, so the frequent updates re-render
only the visualizer subtree, not `SessionScreen`. `session.tsx` only passes `state` and
`audioTrack` props and keeps its existing `agentStatus` label/dot logic untouched.

### Decision: State→visual mapping aligned with existing status colors
Map the four states to color/motion consistent with `agentStatus()` in `session.tsx`
(connecting/disconnected = dim grey + slow; listening = calm cyan; thinking = warmer + faster
wobble; speaking = brighter + larger audio-reactive pulse). Base palette is cyan→purple
(`#1FD5F9` base, matching the Aura default and the png). Exact tuning is a follow-up.

## Risks / Trade-offs

- **SDK-54 `ReferenceError: SkiaViewApi is not defined`** (Metro `experimentalImportSupport`
  reorders imports) → Mitigation: add a `metro.config.js` from `expo/metro-config` disabling
  `experimentalImportSupport`, restart Metro with `-c`. Only applied if the error appears.
- **Native rebuild required** (Skia is a native module; the app already uses a dev build) →
  Mitigation: run `npm run android` / `npm run ios` after `expo install`; document it.
- **Performance of blur + path on lower-end devices** → Mitigation: modest point count and blur
  radius, animate via shared/derived values (no React re-renders), tune on-device.
- **Fidelity gap vs the grainy reference** (Path+gradient ≈ 85% of the png) → Accepted for this
  milestone; full SkSL shader can follow if desired.
- **reanimated 4 + Skia integration on new arch** → low risk (supported combo); verify on first
  native run.

## Migration Plan

Additive UI change, no data/schema/server impact and no persisted state. Rollback = revert the
diff and remove the Skia dependency. No migration steps required.

## Open Questions

- Keep a small state glyph centered inside the Aura, or rely on the existing status text/dot
  only? (Lean: rely on status text/dot; decide on-device.)

## Update (2026-06-17): base aura shipped on device → next milestone is an SkSL shader

The base aura (Path + `SweepGradient` + `BlurMask`) is built, compiled, installed, and
**running on a physical device** (SM-A260F): it shows the dim grey ring when `Disconnected`
and the cyan→purple ring in `Listening`, animating with the reanimated clock. Two findings
from on-device testing:

- **It works, but it's only an outline.** A stroked path produces a thin wobbly ring, not the
  volumetric, grainy, flowing energy field in `design/voice-aura.png`. The team has decided the
  base approach can't reach the target look — the **next milestone is a real SkSL fragment
  shader**.
- **Native linking required a relink.** Skia is a native module; `android/` had been generated
  before Skia was added, so it wasn't autolinked. Fixed via `expo prebuild --clean`. The device
  (SM-A260F, Galaxy A2 Core) is 32-bit, so `expo run:android` builds `armeabi-v7a` — the
  `[CXX5202] only 32-bit native libraries` warning is a Play-Store advisory, not a build error.

### Decision: implement the energy field as a Skia `RuntimeEffect` (SkSL) — next milestone
Replace the `<Path>` render with a `<Fill>`/shader node driven by `Skia.RuntimeEffect.Make(sksl)`.
The fragment shader renders a filled field (not a stroke): layered value/fbm noise warping a
radial ring, soft inner/outer falloff for the glow, the cyan→purple colour ramp, and fine grain.
Uniforms: `time` (clock), `audioLevel` (the smoothed level), `resolution`, and per-state inputs
(colour stops / intensity / motion).
- **Reuse, don't rebuild:** the existing plumbing stays — `useAudioLevel` (smoothed 0..1 level),
  `auraVisualForState` (state → colour/motion params), and the reanimated frame clock. Only the
  *render* swaps from Path to shader. The pure-logic unit tests stay green; geometry helpers
  (`ringRadius`) may be retired in favour of in-shader math.
- **Alternatives reconsidered:** keep tuning the Path version (rejected — can't produce a filled
  grainy field); Expo DOM/WebView running the real web component (rejected earlier — can't pass
  the live audio track across the bridge, heavier, jank risk).

### Risks for the shader milestone
- **SkSL authoring/tuning effort & GPU cost on low-end devices** (the SM-A260F is entry-level) →
  Mitigation: keep noise octaves modest, profile on-device, scale quality by `size`.
- **Skia `RuntimeEffect` SkSL parity / uniform plumbing with reanimated** → Mitigation: drive
  uniforms via a `useDerivedValue` returning the uniforms object; validate the shader compiles
  with a trivial effect first, then layer complexity.

### Open question for the shader
- How close to `voice-aura.png` is "good enough", and how much GPU budget is acceptable on the
  oldest target device? Tune iteratively against the reference.

## Update (2026-06-17b): shader pivoted to a polar port of ShaderToy `tffSDr`

On-device review of the first SkSL field (fbm-warped ribbon + grain) showed a dark "flower"
artifact in the centre and a cyan-dominant look. The user supplied four reference shaders
(saved under `docs/shaders/`) and chose `tffSDr` ("clean lines"): additive sine strands with a
rainbow cosine palette, razor-crisp cores that bloom soft at the edges.

### Decision: render the Aura as a circular (polar) port of `tffSDr`
The horizontal woven strands are remapped into a **ring**: angle → along-strand coordinate,
radius → the perpendicular ("y") axis, so the lines become undulating rings. The crisp-core /
soft-edge quality is preserved **radially** (user choice): crisp woven strands form the band,
with a soft Gaussian halo toward the inner hole and outer edge (matching `voice-aura.png`).
- **Reuse, don't rebuild:** unchanged plumbing — `useAudioLevel`, the reanimated frame clock, and
  the eased per-state params. Only the SkSL body changed.
- **State via motion, not hue:** the rainbow palette is kept, so agent state is reflected through
  motion/intensity (speed, audio expansion, edge softness, opacity) rather than colour. The
  `auraVisualForState` colour stops are now unused by the renderer (kept for a possible future
  per-state tint; tests stay green).
- **Low-end GPU:** kept lean in the spirit of the optimized variant the user provided
  (`docs/shaders/tffSDr-clean-lines-Comment.md`) — integer wave frequencies (seamless wrap),
  inlined smoothstep, no `pow()`, per-pixel constants hoisted, strand count scaled by `size`.
- **Audio:** still driven by the single smoothed `u_level`. Reference `wfsXDl` shows a richer
  per-band FFT path (sample the band array as a uniform); deferred as a possible upgrade.
