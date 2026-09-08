	
	# Handoff — Gym Buddy (next focus: mobile UI refactor)

**Date:** 2026-06-16
**Repo:** `C:\Work\Mobile\gym-buddy` (npm workspaces monorepo: `server/`, `apps/mobile/`)
**Branch:** `main` (pushed to `origin`, up to date)

## Current state — everything works end-to-end (verified on device)

Full stack confirmed working this session on a physical Android device: token server → LiveKit room → `gym-buddy` agent → Supabase, plus Telegram notifications. The agent connects, holds **multi-turn conversations**, is **audible**, and the UI status reflects real state. The next session is a **mobile UI refactor** — the backend/connection/audio work is done and stable; don't redo it.

### Backend/connection context (do not duplicate)
- The SQLite→Supabase migration is **complete & committed**; its permanent record is `openspec/changes/migrate-to-supabase/`.
- How to run, the mobile UI map, and connection gotchas are captured in root `README.md` and below — there are no separate prior handoff docs.

### What shipped this session (all on `main`, `589dd91 → d969181`)
Reference commits/diffs rather than re-reading prose:
- `589dd91` — Supabase migration (server SQLite → hosted Postgres).
- `671d699` — Mobile UI fixes: agent status label, `AudioSession` start/stop for playback, `ExerciseGifOverlay` loading/error/placeholder states.
- `ed0c1e8` — Cold-start "Connection Failed" fix: `agentConnectTimeoutMilliseconds: 30000` on `useSession`.
- `17411e9` — Reverted a VAD `prewarm` (it caused init-timeout churn that dropped live sessions; see memory note below).
- `d969181` — Telegram/cron resilience: transient `ECONNRESET` no longer crashes the server.

## Mobile UI map (`apps/mobile/`) — the refactor surface
- **Routes (`app/`):** `_layout.tsx` (root layout / providers / `Stack`), `index.tsx` (home/connect), `session.tsx` (active workout session).
- **Components (`components/`):** `ExerciseDataCard.tsx`, `ExerciseGifOverlay.tsx`, `RestTimer.tsx`, `SessionFab.tsx`.
- **Hooks (`hooks/`):** `useConnection.tsx` (LiveKit session, token endpoint, AudioSession, connect timeout), `useDataMessages.tsx` (consumes agent data-channel events).
- **Styling:** plain React Native `StyleSheet`, dark theme (`#0a0a0a`). **No NativeWind/Tailwind is set up** — a refactor decision point is whether to introduce a styling system (see `expo:expo-tailwind-setup` if so).
- **Design reference:** `design/gym-buddy-ui.pen` (untracked) — a **Pencil** file; open ONLY with the `pencil` MCP tools (never Read/Grep `.pen`). This is the visual target to refactor toward. A companion mockup `design/voice-aura.png` sits alongside it.
- **Data contract (don't break):** server publishes `exercise_progress`, `rest_timer`, `exercise_media` via `server/src/data-messages.ts` / `publish-data.ts`; the payload TypeScript interfaces live in `hooks/useDataMessages.tsx`. UI changes that need new data require both sides to change.

### Behaviors to PRESERVE through the refactor (regressions to avoid)
- `session.tsx` derives its status label from the agent's **semantic flags** (`canListen`, `state`, `failed`/`disconnected`) — do **not** revert to a naive `state` string switch with a `default: 'Connecting...'` (that was the original bug).
- `useConnection.tsx` must keep: `AudioSession.configureAudio` + `startAudioSession()` on connect / `stopAudioSession()` on disconnect (audio is inaudible without it), and `agentConnectTimeoutMilliseconds: 30000` (prevents premature "Connection Failed" on cold start).
- `ExerciseGifOverlay.tsx` must keep its loading spinner / `onError` / null-URL placeholder (never a blank modal).

## How to run (details in root `README.md`)
- **Mobile (UI iteration):** `cd apps/mobile && npm start -c` then reload — enough for JS-only changes (use `-c` after any `.env.local` change). Native rebuild (`npm run android`) only when touching native deps/plugins/`app.json`.
- **Server:** `cd server && npm run dev` (worker + token server on `:3001`). **Note:** the server was running under the *previous session's* background process and will have stopped — start your own. Needs `server/.env` (already configured locally; `DATABASE_URL`, tokens are secrets — never print/commit).
- `apps/mobile/AGENTS.md` mandates reading the versioned **Expo SDK 54** docs (`https://docs.expo.dev/versions/v54.0.0/`) before writing Expo code.

## Gotchas
- **exercisedb CDN images are currently unavailable** (their Let's Encrypt cert expired 2026-06-12 + this office network's DPI breaks TLS to `cdn.exercisedb.dev`). The overlay correctly shows "Image unavailable" — this is **not** a UI bug; don't chase it. Verify image work on a clean network.
- **Office-network TLS interference**: `cdn.exercisedb.dev` and `api.telegram.org` get reset/blocked here; LiveKit, Google, Cloudflare work fine. Telegram delivery is flaky on this network but functional.
- **Recurring `.git/index.lock`**: Visual Studio's git polling leaves stale empty locks. If git errors with "Unable to create index.lock", remove it only if its mtime is >60s old (stale).
- Monorepo deps **hoist to root `node_modules`** (e.g. `typescript`, `@livekit/components-react`); `@livekit/agents` is under `server/node_modules`. Run package scripts from each package dir.
- For connection/agent debugging, see the memory note `livekit-connection-debugging.md` (stale-worker `lk dispatch` probe, cold-start timeout, prewarm pitfall).

## Untracked / intentionally uncommitted (leave unless asked)
`docs/handoff-*.md`, `README.md`, `apps/mobile/.env.example`, `design/` (incl. `gym-buddy-ui.pen`, `voice-aura.png`). The user previously asked to keep handoff docs out of commits.

## Suggested skills
- **`building-native-ui`** (a.k.a. `expo:building-native-ui`) — primary skill for the Expo Router UI/styling/navigation/animation refactor.
- **`frontend-design`** — for raising visual/layout quality toward the Pencil design.
- **`pencil` MCP tools** — to view/compare against `design/gym-buddy-ui.pen` (the design target).
- **`expo:expo-tailwind-setup`** — only if the refactor decides to adopt NativeWind/Tailwind (currently plain RN StyleSheet).
- **`run`** / **`verify`** — launch the app and visually confirm UI changes on device/emulator.
- **`expo:upgrading-expo`** — only if a dependency/SDK issue surfaces.
