## Why

After manual end-to-end testing of the gym-buddy MVP, three friction points emerged during workouts: users must switch to Telegram to see exercise GIFs, there's no at-a-glance visual context on the mobile screen, and the per-exercise check-in model doesn't match how people actually train (set by set with rest periods). These improvements are needed now to make the voice-first workout experience viable for daily use.

## What Changes

- **Inline exercise media**: The voice agent pushes exercise GIF URLs to the mobile app via LiveKit data channels so users see demonstration animations without leaving the app.
- **Exercise data card**: The mobile session screen displays the current exercise name, target sets/reps/weight, and completed-set progress — updated in real time as the agent tracks the workout.
- **Per-set workout flow**: The agent checks in after each individual set (not per-exercise), starts a rest timer based on `workout_exercises.rest_seconds`, announces when rest ends, and advances to the next exercise after the final set. **BREAKING**: Exercise logging schema changes from aggregated per-exercise to per-set granularity (`set_logs` table replaces `actual_sets`/`actual_reps`/`actual_weight` fields).

## Capabilities

### New Capabilities
- `exercise-media-display`: Push exercise GIF URLs from agent to mobile app via LiveKit data channels; render inline in session UI
- `exercise-data-card`: Real-time exercise progress card shown during voice session (current exercise, sets/reps target, completed sets)
- `per-set-workout-flow`: Per-set check-in loop with rest timer, set-level logging, and automatic exercise advancement

### Modified Capabilities

## Impact

- **Database schema**: New `set_logs` table; `exercise_logs` fields (`actual_sets`, `actual_reps`, `actual_weight`) deprecated in favor of per-set records
- **Agent tools**: `logExerciseCompleted` replaced/refactored to `logSetCompleted`; new `startRestTimer` tool or agent-managed timer logic
- **System prompt**: Core workout loop instructions change significantly (per-set flow)
- **Mobile app**: New UI components on session screen (GIF display, data card); LiveKit data channel listener
- **Server→Client data flow**: New LiveKit data channel messages for exercise media and progress state
- **Tests**: Exercise logging tests need updating; new tests for per-set flow, rest timer, data channel messaging
