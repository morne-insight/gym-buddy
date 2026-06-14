# schedule-type-resolution Specification

## Purpose
Defines how the system resolves the current Workout for a user based on their active program type (static vs rotation), records program context on Sessions, drives the evening check-in messaging, and migrates existing data without behavior changes.

## Requirements

### Requirement: Smart Workout Resolution dispatches by program type
The `getCurrentWorkout` function SHALL accept a `userId` and optional `dayOfWeek`, determine the user's active program type, check recent Session history, and dispatch to the appropriate resolution strategy. The return type (`CurrentWorkoutResult`) SHALL remain unchanged.

#### Scenario: Static program resolves by day of week
- **WHEN** `getCurrentWorkout` is called for a user with an active `static` program on a Monday (day 1) that has a "Push Day" scheduled and Push Day has not been performed this week
- **THEN** the result SHALL contain `restDay: false`, `workoutName: "Push Day"`, and the corresponding exercises

#### Scenario: Static program returns rest day for unscheduled day with no unperformed Workouts
- **WHEN** `getCurrentWorkout` is called for a user with an active `static` program on a day with no schedule entry, and all Workouts in the program have been performed this week
- **THEN** the result SHALL contain `restDay: true`, `workoutName: null`, and empty exercises

#### Scenario: Static program offers next unperformed Workout on off-day
- **WHEN** `getCurrentWorkout` is called for a user with an active `static` program on a Saturday (no schedule entry), and Pull Day has not been performed this week
- **THEN** the result SHALL contain `restDay: false`, `workoutName: "Pull Day"` (the next unperformed Workout), and the corresponding exercises

#### Scenario: Static program skips already-performed Workout
- **WHEN** `getCurrentWorkout` is called for a user with an active `static` program on a Monday (Push Day scheduled), but the user already performed Push Day on Saturday
- **THEN** the result SHALL contain the next unperformed Workout in the program (e.g. Pull Day), not Push Day again
- **AND** the underlying schedule SHALL NOT be modified — Push Day remains assigned to Monday

#### Scenario: Rotation program resolves by current index
- **WHEN** `getCurrentWorkout` is called for a user with an active `rotation` program whose `rotation_state.current_index` is 1
- **THEN** the result SHALL return the Workout at sort_order 1 in the rotation, with `restDay: false` and the corresponding exercises

#### Scenario: Rotation program always has a Workout
- **WHEN** `getCurrentWorkout` is called for a user with an active `rotation` program
- **THEN** the result SHALL always return `restDay: false` with a valid Workout (rotations do not have rest days in the schedule; the rotation pointer already points to the next unperformed Workout)

#### Scenario: No active program
- **WHEN** `getCurrentWorkout` is called for a user with no active program
- **THEN** the result SHALL contain `restDay: true`, `workoutName: null`, and empty exercises

### Requirement: Session creation records program context
When a Session is created, it SHALL record the `schedule_id` of the resolved Workout regardless of program type. This ensures Session history links back to the specific schedule entry and its associated Workout.

#### Scenario: Rotation Session links to correct schedule entry
- **WHEN** a Session starts for a rotation program at index 2
- **THEN** the Session's `schedule_id` SHALL reference the schedule entry with `sort_order = 2` in the rotation program

#### Scenario: Static Session with Smart Resolution links to resolved entry
- **WHEN** a Session starts on Monday but Smart Resolution selects Pull Day (because Push Day was already done)
- **THEN** the Session's `schedule_id` SHALL reference the Pull Day schedule entry, not the Monday/Push Day entry

### Requirement: Evening check-in supports both program types with Buddy persona
The evening check-in cron SHALL determine the "next workout" differently based on program type and SHALL generate all messages in the Buddy's persona voice (Single Voice Rule — see CONTEXT.md).

#### Scenario: Evening check-in for static program missed workout
- **WHEN** evening check-in runs for a user with a `static` program who missed today's Workout and has a Workout tomorrow
- **THEN** the message SHALL reference both today's missed Workout name and tomorrow's Workout name, written in the Buddy's persona

#### Scenario: Evening check-in for rotation program missed workout
- **WHEN** evening check-in runs for a user with a `rotation` program who missed today's Workout
- **THEN** the message SHALL reference today's missed Workout name and the next rotation Workout name (peeked, not advanced), written in the Buddy's persona

#### Scenario: Evening check-in for rotation program completed workout
- **WHEN** evening check-in runs for a user with a `rotation` program who completed today's Workout
- **THEN** the message SHALL preview the next rotation Workout (the one at the already-advanced index), written in the Buddy's persona

### Requirement: Backward-compatible migration for existing data
Existing `schedule` rows and `workout_exercises` rows SHALL be migrated by: creating a default `static` program per user, creating `workouts` rows for each distinct workout_name group, re-parenting `workout_exercises` to reference `workouts`, and backfilling `program_id` and `workout_id` on schedule entries. Existing behavior SHALL be preserved with zero changes for users on static programs.

#### Scenario: Existing seed data works after migration
- **WHEN** the database is migrated and contains existing schedule entries for a user with Mon/Wed/Fri workouts
- **THEN** a `static` program SHALL exist for that user, `workouts` rows SHALL exist for each Workout, all exercise rows SHALL reference the correct Workout, all schedule entries SHALL reference both the program and Workout, and `getCurrentWorkout` SHALL return the same results as before migration
