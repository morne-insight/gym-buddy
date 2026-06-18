# Handoff — Gym Buddy (next focus: Aura SkSL shader)

**Date:** 2026-06-17
**Repo:** `C:\Work\Mobile\gym-buddy` (npm workspaces monorepo: `server/`, `apps/mobile/`)
**Branch:** `main` (changes below are **uncommitted** in the working tree)

## TL;DR
The **base** native "Aura" voice visualizer is built and **running on a physical device**
(SM-A260F). It replaced the old static circle/emoji on the session screen. It works but is only
a thin wobbly **outline** — the **next milestone is a real SkSL fragment shader** to reach the
volumetric, grainy energy field in `design/voice-aura.png`. Don't re-derive the plan: it's all
in the OpenSpec change.

## Source of truth — read these first (don't duplicate)
- `openspec/changes/add-aura-visualizer/proposal.md` — why/what + the `aura-visualizer` capability.
- `openspec/changes/add-aura-visualizer/specs/aura-visualizer/spec.md` — testable requirements.
- `openspec/changes/add-aura-visualizer/design.md` — **decisions + the 2026-06-17 update** that
  defines the shader milestone (RuntimeEffect approach, uniforms, reuse, risks).
- `openspec/changes/add-aura-visualizer/tasks.md` — **progress source of truth.** Sections 1–5
  done; section 6 = on-device verification (partial); **section 7 = the SkSL shader milestone (next).**
- Why the web `AgentAudioVisualizerAura` can't be used (shadcn/WebGL, web-only) is in proposal.md.

## What shipped this session (working tree, uncommitted)
- `apps/mobile/components/aura/auraMath.ts` (+ `auraMath.test.ts`, 16 tests) — pure, tested logic:
  `reduceMagnitudes`, `ringRadius`, `auraVisualForState`, `clamp01`, `lerp`.
- `apps/mobile/hooks/useAudioLevel.ts` — wraps the **native** `useMultibandTrackVolume` from
  `@livekit/react-native` (NOT the Web-Audio one in `@livekit/components-react`).
- `apps/mobile/components/AuraVisualizer.tsx` — Skia `<Canvas>`/`<Path>` + `SweepGradient` +
  `BlurMask`, reanimated clock + smoothed audio level.
- `apps/mobile/app/session.tsx` — static circle/emoji → `<AuraVisualizer state={state}
  audioTrack={agent.microphoneTrack} />` (note: the agent audio is `microphoneTrack`, not
  `audioTrack`).
- Deps/build: `@shopify/react-native-skia@2.2.12`; test infra added (`jest`, `jest-expo`,
  `babel.config.js`, `"test": "jest"`); `android/` regenerated via `expo prebuild --clean`.

## Next milestone — the SkSL shader (section 7 of tasks.md)
Swap the `<Path>` render for `Skia.RuntimeEffect.Make(sksl)` driving a `<Fill>`/shader node:
fbm/value-noise–warped radial ring, soft falloff glow, cyan→purple ramp, grain. Uniforms:
`time`, `audioLevel`, `resolution`, per-state colour/intensity/motion. **Reuse** `useAudioLevel`,
`auraVisualForState`, and the reanimated clock — only the render swaps; keep the unit tests green.
Full detail + risks in design.md (2026-06-17 update).

## Deferred — connection reliability (revisit separately)
- Root cause of the "Disconnected" regression was a **stale IP** in `apps/mobile/.env.local`
  (`EXPO_PUBLIC_TOKEN_ENDPOINT`), fixed `192.168.1.202` → `192.168.1.66`. Token endpoint is
  `POST /getToken` on `server/src/token-server.ts:3001`; verified it returns a token at the new IP.
- After the fix the device connects and reaches **Listening**, but the user reports it's **"not
  working perfectly yet"** — left as a separate follow-up, not yet diagnosed. See memory note
  `livekit-connection-debugging.md`. `EXPO_PUBLIC_*` vars are inlined at bundle time — restart
  Metro with `-c` after `.env.local` edits.

## How to run (this device)
- **Server:** `cd server && npm run dev` (agent worker + token server on `:3001`; needs `server/.env`).
- **Mobile:** `cd apps/mobile && npm run android` (native build; Gradle is cached now so it's fast).
  JS-only iteration: Metro + reload (`npm start -c` after any `.env.local` change).
- Mobile `AGENTS.md` mandates reading the versioned **Expo SDK 54** docs before writing Expo code.

## Gotchas
- **Skia is native** — after touching native deps/plugins, `npx expo prebuild --clean` + a full
  `npm run android`; a JS reload won't pick up native changes. (This was the "missing Skia exports"
  cause: `android/` predated Skia, so it wasn't autolinked.)
- **SM-A260F is 32-bit** (armeabi-v7a). The `[CXX5202] only 32-bit native libraries` warning is a
  Play-Store advisory, not a build error.
- **SDK-54 contingency (not yet hit):** if `ReferenceError: SkiaViewApi is not defined` appears at
  launch, add `apps/mobile/metro.config.js` disabling `experimentalImportSupport`, restart with `-c`.
- `.env.local` and `server/.env` are gitignored secrets — never print/commit.
- Recurring `.git/index.lock` from Visual Studio's git polling — remove only if stale (>60s).

## Suggested skills
- **`opsx:apply`** with `add-aura-visualizer` — continue implementing; work section 7, tick boxes.
- **`building-native-ui`** / **`frontend-design`** — Expo/Skia UI work toward the design target.
- **`pencil` MCP tools** — compare against `design/gym-buddy-ui.pen` / `design/voice-aura.png`.
- **`run`** / **`verify`** — launch on device and visually confirm shader iterations.
- **`tdd`** — keep `auraMath` logic test-first as it evolves for the shader.
- **`opsx:archive`** with `add-aura-visualizer` — once the shader milestone is done & verified.
