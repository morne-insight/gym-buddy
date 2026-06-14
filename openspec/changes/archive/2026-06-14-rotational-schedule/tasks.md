## 1. Database Schema & Migration

- [x] 1.1 Create `workouts` table in `schema.sql` with fields: `id`, `program_id`, `name`
- [x] 1.2 Create `programs` table in `schema.sql` with fields: `id`, `user_id`, `name`, `type` (static/rotation), `active`, `created_at`
- [x] 1.3 Re-parent `workout_exercises`: replace `schedule_id` FK with `workout_id` FK referencing `workouts`
- [x] 1.4 Add `program_id` (FK to programs) and `workout_id` (FK to workouts) columns to `schedule` table; make `day_of_week` nullable
- [x] 1.5 Create `rotation_state` table in `schema.sql` with fields: `id`, `user_id`, `program_id`, `current_index`, `last_completed_at`
- [x] 1.6 Write migration logic: create `workouts` rows from existing exercise groups, re-parent `workout_exercises`, wrap existing schedule rows in a default `static` program per user, backfill `program_id` and `workout_id`
- [x] 1.7 Update `seed.sql`: restructure to create workouts, static program, and schedule entries referencing workouts; add a rotation PPL example

## 2. Database Access Layer

- [x] 2.1 Add `Workout` interface and CRUD functions in `db/index.ts`: `insertWorkout`, `getWorkoutById`, `getWorkoutExercises`
- [x] 2.2 Add `Program` interface and CRUD functions: `insertProgram`, `getActiveProgram`, `deactivateUserPrograms`
- [x] 2.3 Add `RotationState` interface and functions: `insertRotationState`, `getRotationState`, `advanceRotation`
- [x] 2.4 Update `insertSchedule` to accept `program_id`, `workout_id`, optional `day_of_week`
- [x] 2.5 Add `getSchedulesByProgram` function that returns schedule entries ordered by `sort_order` for a given program
- [x] 2.6 Add `getScheduleAtIndex` function to fetch rotation schedule entry at a specific sort_order position
- [x] 2.7 Add `peekNextRotationWorkout` function that returns the next Workout without advancing the pointer
- [x] 2.8 Add `getCompletedWorkoutsThisWeek` function that returns which Workouts a user has completed in the current week (for Smart Resolution)

## 3. Smart Workout Resolution

- [x] 3.1 Refactor `getCurrentWorkout` to load the user's active program and dispatch by type
- [x] 3.2 Implement static resolution path: check today's scheduled Workout, then check if already performed this week; if so, find next unperformed Workout in program
- [x] 3.3 Implement rotation resolution path: read `rotation_state.current_index`, fetch Workout at that index (pointer already reflects what's been done)
- [x] 3.4 Handle edge case: no active program returns rest day
- [x] 3.5 Handle edge case: all Workouts in program already performed this week returns rest day (static only)
- [x] 3.6 Handle off-day sessions: unscheduled day offers next unperformed Workout (static)

## 4. Rotation Advancement

- [x] 4.1 Update `completeSession` in `db/index.ts` to advance rotation state when the Session's schedule belongs to a rotation program
- [x] 4.2 Implement wrap-around logic: `(current_index + 1) % rotation_length`
- [x] 4.3 Set `last_completed_at` on rotation state when advancing
- [x] 4.4 Ensure abandoned Sessions (status = `abandoned`) do not advance the pointer

## 5. Evening Check-In Cron

- [x] 5.1 Refactor `runEveningCheckIn` to load the user's active program type and Buddy persona
- [x] 5.2 For static programs: preserve existing tomorrow day-of-week lookup
- [x] 5.3 For rotation programs: use `peekNextRotationWorkout` to determine the next Workout name
- [x] 5.4 Generate all messages in the Buddy's persona voice (Single Voice Rule) — either via LLM with persona prompt or pre-written persona variants
- [x] 5.5 Adjust message wording for rotation: "Next up is X" instead of "Tomorrow is X"

## 6. Tests

- [x] 6.1 Write tests for `workouts` table CRUD and exercise ownership
- [x] 6.2 Write tests for `programs` table CRUD and active-program constraint
- [x] 6.3 Write tests for `rotation_state` advancement and wrap-around
- [x] 6.4 Write tests for `getCurrentWorkout` with static program — same-day resolution (regression)
- [x] 6.5 Write tests for `getCurrentWorkout` with static program — Smart Resolution skips already-performed Workout
- [x] 6.6 Write tests for `getCurrentWorkout` with static program — off-day offers next unperformed Workout
- [x] 6.7 Write tests for `getCurrentWorkout` with static program — all Workouts done returns rest day
- [x] 6.8 Write tests for `getCurrentWorkout` with rotation program (resolves by index)
- [x] 6.9 Write tests for Session completion advancing rotation pointer
- [x] 6.10 Write tests for abandoned Session not advancing rotation pointer
- [x] 6.11 Write tests for evening check-in with rotation program (peek without advance)
- [x] 6.12 Write tests for evening check-in messages using Buddy persona
- [x] 6.13 Write tests for migration: existing seed data produces identical results after migration

## 7. Seed Data & Verification

- [x] 7.1 Run migrated seed and verify static PPL schedule resolves identically to pre-change behavior
- [x] 7.2 Add rotation PPL seed example and verify rotation cycling works end-to-end through a voice session
- [x] 7.3 Verify Smart Resolution: seed a completed Session for Push Day, then call `getCurrentWorkout` on Push Day's scheduled day and confirm it returns Pull Day instead
