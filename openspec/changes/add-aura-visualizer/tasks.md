## 1. Dependency & build setup

- [x] 1.1 Add Skia: `cd apps/mobile && npx expo install @shopify/react-native-skia` (resolved to `2.2.12`, recorded in `package.json`; hoisted to root `node_modules`)
- [x] 1.2 Native relink + rebuild — root cause of the "missing Skia exports" error: `android/` was generated before Skia, so the native module wasn't autolinked (no `react-native-skia` refs in it). Fixed with `npx expo prebuild --clean --platform android`; **`./gradlew :app:assembleDebug` → BUILD SUCCESSFUL** (Skia C++/JNI compiled & linked, `app-debug.apk` produced). On-device boot still to be confirmed by you (`adb install`/launch hangs in the agent sandbox; run `npm run android` locally).
- [ ] 1.3 If `ReferenceError: SkiaViewApi is not defined` appears at app launch, add `apps/mobile/metro.config.js` from `expo/metro-config` disabling `experimentalImportSupport`, then restart Metro with `-c` — **conditional, only if the error shows up at runtime**

> Test infra added to support TDD (the mobile app had no Jest): `jest`, `jest-expo`,
> `@types/jest`, `react-test-renderer` devDeps + `babel.config.js` (`babel-preset-expo`) +
> `"test": "jest"` script and `jest` preset config in `package.json`.

## 2. Audio level hook

- [x] 2.1 Created `apps/mobile/hooks/useAudioLevel.ts` wrapping the **native** `useMultibandTrackVolume` from `@livekit/react-native`
- [x] 2.2 Reduce per-band magnitudes to a single normalized `0..1` level via pure `reduceMagnitudes` (mean of per-band clamps); returns `0` when the track is missing/placeholder — unit-tested
- [x] 2.3 Hook is self-contained (called inside `AuraVisualizer`, so its ~25fps updates re-render only the visualizer subtree)

## 3. AuraVisualizer component (base aura)

- [x] 3.1 Created `apps/mobile/components/AuraVisualizer.tsx` with props `{ state: AgentState; audioTrack?: TrackReferenceOrPlaceholder; size?: number }`
- [x] 3.2 Calls `useAudioLevel(audioTrack)`; mirrors level into a reanimated shared value and lerps toward target each frame (single `useFrameCallback` does clock + smoothing)
- [x] 3.3 Wobbling ring built as an `SkPath` in a `useDerivedValue`: per-point radius via pure `ringRadius(angle, time, level, ...)` (clock-driven, fixed integer lobe count for a seamless seam) — `ringRadius` unit-tested
- [x] 3.4 Renders `<Canvas>` → `<Path style="stroke">` with cyan→purple `SweepGradient` + `BlurMask` glow (base `#1FD5F9`, palette per `design/voice-aura.png`)
- [x] 3.5 Continuous ambient wobble when `audioLevel` is `0` (clock keeps animating; never a frozen image)

## 4. Agent-state treatment

- [x] 4.1 `auraVisualForState()` maps Connecting/Listening/Speaking/Thinking (+ disconnected/failed/default) to colour/speed/glow/audioAmp/opacity — rough first pass, unit-tested (speaking pulses more than listening; connecting calmer than thinking)
- [x] 4.2 State changes ease via `withTiming` (no abrupt jumps); connecting/initializing reads as calm/dim, not failed/frozen

## 5. Integrate into the session screen

- [x] 5.1 In `apps/mobile/app/session.tsx`, replaced the static circle/emoji with `<AuraVisualizer state={state} audioTrack={agent.microphoneTrack} />` (the agent's audio track is `microphoneTrack`, not `audioTrack`)
- [x] 5.2 `agentStatus(agent)` label/dot logic untouched; removed now-unused `circle`/`circleEmoji` styles
- [x] 5.3 No other session wiring changed (overlay, rest timer, FAB, End Workout intact); `tsc --noEmit` passes

## 6. Verify on device — **on SM-A260F (Galaxy A2 Core, 32-bit / armeabi-v7a)**

- [x] 6.1 App built/installed/launched on device; session connects (after fixing a stale `EXPO_PUBLIC_TOKEN_ENDPOINT` IP in `.env.local`: `192.168.1.202` → `192.168.1.66`). Connection works but not 100% reliable yet — **deferred, revisit separately** (see handoff).
- [x] 6.2 Aura renders & reacts: dim grey ring when `Disconnected`, cyan→purple ring in `Listening`, animating via the clock. (Speaking-pulse not yet closely scrutinised.)
- [ ] 6.3 Full regression sweep (audio audible, GIF overlay + rest timer + FAB, End Workout) — not yet exhaustively re-checked
- [x] 6.4 Compared against `design/voice-aura.png`: the Path version is only a thin outline, not the volumetric grainy field → **drove the decision to move to an SkSL shader (section 7)**

## 7. Next milestone — SkSL shader energy field (see design.md 2026-06-17 update)

- [x] 7.1 Added the shader render path in `AuraVisualizer.tsx`: `Skia.RuntimeEffect.Make(buildAuraSksl(octaves))` (memoized) feeding `<Canvas><Fill><Shader source uniforms /></Fill></Canvas>`; returns `null` if the effect fails to compile (validated on first device run). SkSL lives in new `components/aura/auraShader.ts`.
- [x] 7.2 SkSL energy field (`auraShader.ts`). Initial fbm-warped ribbon was replaced (per on-device review + user-supplied references, see design.md 2026-06-17b) by a **polar port of ShaderToy `tffSDr`**: woven additive sine strands with a rainbow cosine palette, crisp cores (inlined smoothstep), and a soft radial halo for the blurred inner/outer edges. Integer lobe counts keep the ring seamless; premultiplied emissive output over the dark background.
- [x] 7.3 Uniforms (`u_resolution`, `u_time`, `u_level`, `u_speed`, `u_audioAmp`, `u_glow`, `u_opacity`, `u_color0/1/2`) packed in a `useDerivedValue`. Reuses `useAudioLevel` (smoothed level) and `auraVisualForState`; a single `useFrameCallback` advances the clock, smooths the level, and eases the per-state colour/motion params toward their targets (smooth, non-abrupt state transitions).
- [x] 7.4 Retired `ringRadius`/`RingRadiusParams` (geometry moved into the shader); added pure `hexToVec3` for colour→`float3` uniforms. `reduceMagnitudes`/`auraVisualForState`/`clamp01`/`lerp` tests stay green (+ new `hexToVec3` tests) — 16/16 pass; `tsc --noEmit` clean.
- [ ] 7.5 Quality scaling implemented (fbm `octaves` = 3 for `size ≤ 240`, else 4, injected at shader build time). On-device profiling/tuning on the SM-A260F against `design/voice-aura.png` still to be done by you (GPU timing can't be measured in the agent sandbox).
