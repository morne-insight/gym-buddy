## 1. Database Schema Changes

- [ ] 1.1 Create `set_logs` table migration (id, exercise_log_id FK, set_number, reps, weight, completed_at)
- [ ] 1.2 Write migration to convert existing `exercise_logs` rows with actual_sets/actual_reps/actual_weight into `set_logs` rows
- [ ] 1.3 Remove deprecated columns (actual_sets, actual_reps, actual_weight) from exercise_logs after migration
- [ ] 1.4 Add set_logs table to schema.sql and verify DB initialization
- [ ] 1.5 Test: migration correctly converts comma-separated reps into individual set_logs rows

## 2. Data Channel Infrastructure

- [ ] 2.1 Define `DataMessage` TypeScript union type (exercise_media, exercise_progress, rest_timer) in shared types file
- [ ] 2.2 Implement `publishDataMessage` helper on server that serializes and sends via `LocalParticipant.publishData()` (reliable mode)
- [ ] 2.3 Implement data channel listener hook on mobile (`useDataChannel` or `useParticipant` data event)
- [ ] 2.4 Parse incoming JSON messages and dispatch by type to state handlers
- [ ] 2.5 Test: server publishes message, mobile receives and parses correctly (unit tests for serialization/parsing)

## 3. Per-Set Workout Flow — Agent Tools

- [ ] 3.1 Implement `logSetCompleted` tool (creates exercise_log if first set, inserts set_log row, returns progress)
- [ ] 3.2 Implement `completeExercise` tool (marks exercise_log complete/skipped, returns remaining count and workoutComplete flag)
- [ ] 3.3 Remove old `logExerciseCompleted` tool
- [ ] 3.4 Update tool registration in agent.ts to use new tools
- [ ] 3.5 Test: logSetCompleted creates parent exercise_log on first set, subsequent sets append
- [ ] 3.6 Test: completeExercise marks exercise done, returns correct remaining count
- [ ] 3.7 Test: skip flow marks unlogged sets as skipped

## 4. Per-Set Workout Flow — Agent Prompt & Logic

- [ ] 4.1 Update system prompt for per-set check-in flow (ask after each set, not per-exercise)
- [ ] 4.2 Add rest timer logic to agent: after set logged (not final), setTimeout for rest_seconds duration
- [ ] 4.3 Agent sends `rest_timer` data channel message (start) when rest begins
- [ ] 4.4 Agent sends `rest_timer` data channel message (end) and announces verbally when rest ends
- [ ] 4.5 Agent sends `exercise_progress` data channel message after each set and exercise transition
- [ ] 4.6 Test: agent calls logSetCompleted per set, completeExercise after final set
- [ ] 4.7 Test: rest timer fires after non-final set, does not fire after final set
- [ ] 4.8 Test: user can speak during rest without resetting timer

## 5. Exercise Media Display

- [ ] 5.1 Agent sends `exercise_media` data channel message (gifUrl, exerciseName) when introducing a new exercise
- [ ] 5.2 Send media message before TTS starts for preloading
- [ ] 5.3 Handle missing exercise_db_id gracefully (skip media message)
- [ ] 5.4 Mobile: create ExerciseGif overlay component (dismissible modal with GIF and exercise name)
- [ ] 5.5 Mobile: cache latest exercise_media in state, show overlay only when triggered (FAB or agent push)
- [ ] 5.6 Test: agent publishes exercise_media with correct URL and name
- [ ] 5.7 Test: no message sent when exercise has no GIF

## 6. Exercise Data Card — Mobile UI

- [ ] 6.1 Create ExerciseDataCard component (exercise name, set X of Y, target reps/weight, completed set indicators)
- [ ] 6.2 Cache exercise_progress state locally, render card only when pinned
- [ ] 6.3 Show loading state if pinned before first exercise_progress message
- [ ] 6.4 Show "Workout Complete" state when all exercises done
- [ ] 6.5 Test: component renders correctly with sample progress data
- [ ] 6.6 Test: component updates in real time when pinned and new progress data arrives

## 7. Rest Timer — Mobile UI

- [ ] 7.1 Create RestTimer component (large countdown display, visually prominent)
- [ ] 7.2 Start local countdown on `rest_timer` start message, clear on `end` message or zero
- [ ] 7.3 Wire RestTimer into session screen (always visible when active — no pin required)
- [ ] 7.4 Test: timer counts down from durationSeconds to zero
- [ ] 7.5 Test: timer clears when end message received

## 8. FAB Menu & Session Screen Integration

- [ ] 8.1 Create FAB component (bottom-right) with menu: "Show Exercise" and "Pin Progress" actions
- [ ] 8.2 "Show Exercise" opens GIF overlay (disabled with tooltip if no media available)
- [ ] 8.3 "Pin Progress" toggles progress card visibility (persists until unpinned or session ends)
- [ ] 8.4 Default session screen remains minimal: agent state indicator + end button + FAB
- [ ] 8.5 Rest timer overlays when active (independent of FAB/pin state)
- [ ] 8.6 End session clears all visual state and resets pin
- [ ] 8.7 Manual integration test: full workout flow on physical device (start → sets → rest → FAB interactions → complete)
