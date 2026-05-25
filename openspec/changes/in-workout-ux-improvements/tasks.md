## 1. Database Schema Changes

- [x] 1.1 Create `set_logs` table migration (id, exercise_log_id FK, set_number, reps, weight, completed_at)
- [x] 1.2 Write migration to convert existing `exercise_logs` rows with actual_sets/actual_reps/actual_weight into `set_logs` rows
- [x] 1.3 Remove deprecated columns (actual_sets, actual_reps, actual_weight) from exercise_logs after migration
- [x] 1.4 Add set_logs table to schema.sql and verify DB initialization
- [x] 1.5 Test: migration correctly converts comma-separated reps into individual set_logs rows

## 2. Data Channel Infrastructure

- [x] 2.1 Define `DataMessage` TypeScript union type (exercise_media, exercise_progress, rest_timer) in shared types file
- [x] 2.2 Implement `publishDataMessage` helper on server that serializes and sends via `LocalParticipant.publishData()` (reliable mode)
- [x] 2.3 Implement data channel listener hook on mobile (`useDataChannel` or `useParticipant` data event)
- [x] 2.4 Parse incoming JSON messages and dispatch by type to state handlers
- [x] 2.5 Test: server publishes message, mobile receives and parses correctly (unit tests for serialization/parsing)

## 3. Per-Set Workout Flow — Agent Tools

- [x] 3.1 Implement `logSetCompleted` tool (creates exercise_log if first set, inserts set_log row, returns progress)
- [x] 3.2 Implement `completeExercise` tool (marks exercise_log complete/skipped, returns remaining count and workoutComplete flag)
- [x] 3.3 Remove old `logExerciseCompleted` tool
- [x] 3.4 Update tool registration in agent.ts to use new tools
- [x] 3.5 Test: logSetCompleted creates parent exercise_log on first set, subsequent sets append
- [x] 3.6 Test: completeExercise marks exercise done, returns correct remaining count
- [x] 3.7 Test: skip flow marks unlogged sets as skipped

## 4. Per-Set Workout Flow — Agent Prompt & Logic

- [x] 4.1 Update system prompt for per-set check-in flow (ask after each set, not per-exercise)
- [x] 4.2 Add rest timer logic to agent: after set logged (not final), setTimeout for rest_seconds duration
- [x] 4.3 Agent sends `rest_timer` data channel message (start) when rest begins
- [x] 4.4 Agent sends `rest_timer` data channel message (end) and announces verbally when rest ends
- [x] 4.5 Agent sends `exercise_progress` data channel message after each set and exercise transition
- [x] 4.6 Test: agent calls logSetCompleted per set, completeExercise after final set
- [x] 4.7 Test: rest timer fires after non-final set, does not fire after final set
- [x] 4.8 Test: user can speak during rest without resetting timer

## 5. Exercise Media Display

- [x] 5.1 Agent sends `exercise_media` data channel message (gifUrl, exerciseName) when introducing a new exercise
- [x] 5.2 Send media message before TTS starts for preloading
- [x] 5.3 Handle missing exercise_db_id gracefully (skip media message)
- [x] 5.4 Mobile: create ExerciseGif overlay component (dismissible modal with GIF and exercise name)
- [x] 5.5 Mobile: cache latest exercise_media in state, show overlay only when triggered (FAB or agent push)
- [x] 5.6 Test: agent publishes exercise_media with correct URL and name
- [x] 5.7 Test: no message sent when exercise has no GIF

## 6. Exercise Data Card — Mobile UI

- [x] 6.1 Create ExerciseDataCard component (exercise name, set X of Y, target reps/weight, completed set indicators)
- [x] 6.2 Cache exercise_progress state locally, render card only when pinned
- [x] 6.3 Show loading state if pinned before first exercise_progress message
- [x] 6.4 Show "Workout Complete" state when all exercises done
- [x] 6.5 Test: component renders correctly with sample progress data
- [x] 6.6 Test: component updates in real time when pinned and new progress data arrives

## 7. Rest Timer — Mobile UI

- [x] 7.1 Create RestTimer component (large countdown display, visually prominent)
- [x] 7.2 Start local countdown on `rest_timer` start message, clear on `end` message or zero
- [x] 7.3 Wire RestTimer into session screen (always visible when active — no pin required)
- [x] 7.4 Test: timer counts down from durationSeconds to zero
- [x] 7.5 Test: timer clears when end message received

## 8. FAB Menu & Session Screen Integration

- [x] 8.1 Create FAB component (bottom-right) with menu: "Show Exercise" and "Pin Progress" actions
- [x] 8.2 "Show Exercise" opens GIF overlay (disabled with tooltip if no media available)
- [x] 8.3 "Pin Progress" toggles progress card visibility (persists until unpinned or session ends)
- [x] 8.4 Default session screen remains minimal: agent state indicator + end button + FAB
- [x] 8.5 Rest timer overlays when active (independent of FAB/pin state)
- [x] 8.6 End session clears all visual state and resets pin
- [ ] 8.7 Manual integration test: full workout flow on physical device (start → sets → rest → FAB interactions → complete)
