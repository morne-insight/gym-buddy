## Context

The gym-buddy MVP currently uses a voice-only session interface. The mobile session screen shows only agent state (listening/thinking/speaking) and an "End Workout" button. Exercise demonstrations require switching to Telegram, and the agent checks in once per exercise (all sets at once) rather than tracking individual sets.

The server agent (`server/src/agent.ts`) has no data channel usage — all interaction flows through voice. The mobile app (`apps/mobile/app/session.tsx`) uses `@livekit/components-react` hooks. Exercise logging stores aggregated data per exercise in `exercise_logs`.

## Goals / Non-Goals

**Goals:**
- Push exercise GIFs and progress data from agent to mobile app in real time
- Display contextual visual information during voice sessions without disrupting voice-first UX
- Track workouts at per-set granularity with rest timer management
- Maintain TDD approach — all new behavior covered by tests

**Non-Goals:**
- Custom video/animation player (use standard Image component with GIF URL)
- Replacing voice interaction with touch UI (voice remains primary)
- Historical analytics UI (data card is live-session only)
- Configurable rest timers (use DB value from `workout_exercises.rest_seconds`)
- Backward-compatible dual logging (old aggregated path removed, migration converts existing data)

## Decisions

### 1. LiveKit Data Channels for agent→mobile communication

**Choice:** Use LiveKit `LocalParticipant.publishData()` with reliable mode to send JSON messages from agent to mobile app.

**Alternatives considered:**
- Room metadata: Limited to 7.5KB, updated via server API — adds latency and doesn't support rapid updates
- Custom WebSocket: Adds a second connection to maintain, duplicates what LiveKit already provides
- RPC (LiveKit): Designed for request/response, not push notifications

**Rationale:** Data channels are low-latency, already part of the LiveKit connection, support arbitrary payloads, and don't require additional infrastructure. Reliable mode ensures messages arrive even during brief network hiccups.

**Message protocol:**
```typescript
type DataMessage =
  | { type: 'exercise_media'; payload: { gifUrl: string; exerciseName: string } }
  | { type: 'exercise_progress'; payload: ExerciseProgressState }
  | { type: 'rest_timer'; payload: { action: 'start' | 'end'; durationSeconds: number; remainingSeconds?: number } }
```

### 2. Per-set logging with new `set_logs` table

**Choice:** Add a `set_logs` table that records individual sets. Keep `exercise_logs` as the parent record but remove `actual_sets`/`actual_reps`/`actual_weight` columns.

**Alternatives considered:**
- JSON array in `exercise_logs.actual_reps`: Loses queryability, makes per-set history analysis hard
- Extend existing columns with delimiters: Already using comma-separated `actual_reps` — fragile, doesn't support per-set weight variation

**Rationale:** Proper relational modeling. Per-set records enable future features (progressive overload tracking, set-over-set comparison). Migration is straightforward since MVP data is minimal.

**Schema:**
```sql
CREATE TABLE set_logs (
  id TEXT PRIMARY KEY,
  exercise_log_id TEXT NOT NULL REFERENCES exercise_logs(id),
  set_number INTEGER NOT NULL,
  reps INTEGER NOT NULL,
  weight REAL,
  completed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 3. Rest timer managed by agent, displayed on mobile

**Choice:** The agent tracks rest state internally (setTimeout/interval) and pushes timer updates to mobile via data channel. The mobile renders a countdown but is not the source of truth.

**Alternatives considered:**
- Mobile-managed timer with agent notification: Splits logic across client and server, complicates testing
- Voice-only countdown: Annoying to hear "60 seconds... 59 seconds..." — visual is better

**Rationale:** Agent-managed timer keeps workout flow logic centralized (testable on server). Mobile is a dumb display. Agent announces verbally only at start ("90 seconds rest") and end ("Let's go").

### 4. Tool refactoring: `logSetCompleted` replaces `logExerciseCompleted`

**Choice:** Replace `logExerciseCompleted` tool with `logSetCompleted` that logs one set at a time. Add `completeExercise` as a separate tool called after final set or skip.

**Rationale:** Matches the per-set conversation flow. Agent calls `logSetCompleted` after each set confirmation, then `completeExercise` to advance. This also triggers the data channel progress update.

### 5. On-demand visual aids with minimal default UI

**Choice:** The session screen stays clean by default — just the agent state indicator and end button. Visual elements appear on demand:
- **Exercise GIF**: Shown when the user asks verbally ("show me the exercise") or taps a FAB in the bottom-right corner. Dismissed by tapping again or when the next exercise starts.
- **Progress card**: Hidden by default. User can "pin" it via the FAB menu, which keeps it visible on screen until unpinned. Agent also pushes progress data regardless of pin state (so it's always up-to-date when revealed).
- **Rest timer**: Always shown when active (this is time-critical information the user needs without asking).

**Alternatives considered:**
- Always-on cards: Clutters the voice-first interface, fights for attention with the audio interaction
- Voice-only with no visual option: Misses the opportunity for quick glances at form reference or progress

**Rationale:** Voice is primary — the screen should support it, not compete with it. The FAB provides a low-friction escape hatch without requiring a voice command (useful in loud gyms). Pinning the progress card accommodates users who prefer visual tracking without forcing it on those who don't.

**FAB interaction model:**
- Single FAB button (bottom-right) → opens a small menu with two options: "Show Exercise" and "Pin Progress"
- "Show Exercise" displays the last-known exercise GIF as an overlay/modal (dismissible)
- "Pin Progress" toggles the progress card visibility (persists until unpinned or session ends)
- Agent can also trigger GIF display via voice request (sends data channel message, mobile shows it as if FAB was tapped)

## Risks / Trade-offs

- **[Data channel reliability on mobile]** → LiveKit data channels use SCTP reliable mode; if connection drops, messages queue until reconnect. Mobile app should handle stale state gracefully (show "reconnecting" if no update in 10s).
- **[Timer drift between agent and display]** → Agent sends periodic sync messages (every 10s during rest). Mobile interpolates between syncs. Acceptable for workout context (1-2s drift is fine).
- **[Breaking schema change]** → MVP has minimal data. Migration script converts existing `exercise_logs` rows to `set_logs` entries (one set per log for legacy data). No rollback needed given MVP stage.
- **[Increased agent complexity]** → Per-set flow adds state tracking to the agent. Mitigated by clear state machine in system prompt and comprehensive test coverage.
- **[GIF loading latency on mobile]** → ExerciseDB GIFs are ~2-5MB. Use React Native's Image component with progressive loading. Agent sends media URL before verbally introducing the exercise so image preloads.
