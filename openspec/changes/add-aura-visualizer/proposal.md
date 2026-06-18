## Why

The mobile session screen represents the AI Buddy with a static bordered circle and a
swapped emoji — it gives no sense of presence or that the Buddy is actually listening and
speaking. The design target (`design/voice-aura.png`) is a glowing, audio-reactive "Aura"
energy ring. LiveKit's official `AgentAudioVisualizerAura` cannot be reused: it is a web-only
component (shadcn/ui + WebGL, renders `<div>`/`<canvas>`, installed via the shadcn CLI), which
is why its installation failed in this React Native / Expo app. We need a native equivalent.

## What Changes

- Add a native, audio-reactive **Aura** visualizer to the active session screen, replacing the
  static circle/emoji in `apps/mobile/app/session.tsx`.
- Render it with `@shopify/react-native-skia` (a closed wobbling **Path** + cyan→purple
  **sweep gradient** + **blur** glow), animated via reanimated.
- Drive its motion/intensity from **live audio amplitude** using the **native**
  `useMultibandTrackVolume` hook from `@livekit/react-native` (FFT-backed), reduced to a single
  normalized level by a new `useAudioLevel` hook.
- React to the four agent states — **Connecting, Listening, Speaking, Thinking** — via color and
  motion. First milestone is a working audio-reactive aura; per-state behaviors are refined after
  the base aura works.
- Add `@shopify/react-native-skia` as a dependency (native module → requires a native rebuild).
- Preserve existing behaviors flagged in the handoff: the semantic `agentStatus` label/dot, the
  `useConnection` AudioSession + 30s connect timeout, and the exercise GIF overlay states.

## Capabilities

### New Capabilities
- `aura-visualizer`: A native, audio-reactive voice visualizer on the mobile session screen that
  renders a glowing energy ring reflecting the Buddy's live audio level and its agent state
  (Connecting, Listening, Speaking, Thinking).

### Modified Capabilities
<!-- None — existing specs (rotation-scheduling, schedule-type-resolution) are server-domain and unaffected. -->

## Impact

- **Mobile app (`apps/mobile/`):**
  - `app/session.tsx` — swap the static circle/emoji for the new visualizer.
  - `components/AuraVisualizer.tsx` — **new** Skia component.
  - `hooks/useAudioLevel.ts` — **new** hook wrapping native `useMultibandTrackVolume`.
  - `package.json` — new `@shopify/react-native-skia` dependency.
  - `metro.config.js` — **new, only if** the known SDK-54 `SkiaViewApi` import-ordering bug
    surfaces (workaround: disable `experimentalImportSupport`).
- **Build:** native rebuild required (`npm run android` / `npm run ios`) after adding Skia.
- **No server changes**; no changes to the agent data contract (`exercise_progress`, `rest_timer`,
  `exercise_media`).
- Uses `agent.audioTrack` / `agent.state` already available from `useAgent()` in `session.tsx`.
