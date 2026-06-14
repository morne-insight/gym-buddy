# rotation-scheduling Specification

## Purpose
Defines the data model and behavior for organizing workouts into programs with either static (day-of-week) or rotation (sequential) scheduling, including how exercises are owned by Workouts and how rotation state advances.

## Requirements

### Requirement: Workouts table owns the exercise list
The system SHALL store workouts in a `workouts` table with fields: `id` (TEXT PK), `program_id` (FK to programs), `name` (TEXT). The `workout_exercises` table SHALL reference `workout_id` (FK to workouts) instead of `schedule_id`. Schedule entries SHALL reference a Workout via `workout_id`.

#### Scenario: Exercises belong to a Workout, not a Schedule
- **WHEN** a Workout "Push Day" is created with exercises (Bench Press, OHP, Lateral Raises)
- **THEN** all exercise rows SHALL have `workout_id` referencing the Push Day Workout
- **AND** a schedule entry for Monday SHALL reference the same `workout_id`

#### Scenario: Multiple schedule entries can reference the same Workout
- **WHEN** a static schedule entry for Monday and a rotation schedule entry at sort_order 0 both reference Workout "Push Day"
- **THEN** both entries SHALL share the same `workout_id` and the same exercise list

### Requirement: Program model groups schedules by type
The system SHALL store programs in a `programs` table with fields: `id` (TEXT PK), `user_id` (FK to users), `name` (TEXT), `type` (TEXT, either `static` or `rotation`), `active` (INTEGER, default 1), `created_at` (DATETIME). Each user SHALL have at most one active program at a time.

#### Scenario: Create a rotation program
- **WHEN** a rotation program "PPL Rotation" is inserted for a user
- **THEN** the program row EXISTS with `type = 'rotation'` and `active = 1`

#### Scenario: Only one active program per user
- **WHEN** a user has an active program and a new program is activated
- **THEN** the previously active program SHALL have `active = 0`

### Requirement: Schedule entries belong to a program and reference a Workout
The `schedule` table SHALL have a `program_id` column (FK to `programs.id`) and a `workout_id` column (FK to `workouts.id`). For `rotation` programs, `day_of_week` SHALL be NULL and position within the rotation SHALL be determined by `sort_order`. For `static` programs, `day_of_week` SHALL remain NOT NULL and function as before.

#### Scenario: Rotation schedule entries have no day_of_week
- **WHEN** schedule entries are created for a rotation program with 3 Workouts (Push, Pull, Legs)
- **THEN** each entry SHALL have `day_of_week = NULL`, a valid `workout_id`, and `sort_order` values of 0, 1, 2 respectively

#### Scenario: Static schedule entries retain day_of_week
- **WHEN** schedule entries are created for a static program
- **THEN** each entry SHALL have a non-null `day_of_week` value (0-6) and a valid `workout_id`

### Requirement: Rotation state tracks current position
The system SHALL maintain a `rotation_state` table with fields: `id` (TEXT PK), `user_id` (FK to users), `program_id` (FK to programs), `current_index` (INTEGER, default 0), `last_completed_at` (DATETIME, nullable). There SHALL be at most one rotation_state row per user per program.

#### Scenario: Initial rotation state
- **WHEN** a rotation program is created for a user
- **THEN** a `rotation_state` row SHALL be created with `current_index = 0` and `last_completed_at = NULL`

#### Scenario: Rotation state after first Session
- **WHEN** a user completes a Session for a rotation program at index 0 of a 3-Workout rotation
- **THEN** `current_index` SHALL be updated to 1 and `last_completed_at` SHALL be set to the Session completion time

### Requirement: Rotation advances on Session completion only
The rotation pointer SHALL advance only when a Session is marked as `completed`. Sessions with status `abandoned` or `in_progress` SHALL NOT advance the pointer.

#### Scenario: Completed Session advances rotation
- **WHEN** a user completes a Session for the Workout at rotation index 1 of a 3-Workout rotation
- **THEN** `rotation_state.current_index` SHALL be updated to 2

#### Scenario: Rotation wraps around
- **WHEN** a user completes a Session for the Workout at rotation index 2 of a 3-Workout rotation (the last position)
- **THEN** `rotation_state.current_index` SHALL wrap to 0

#### Scenario: Abandoned Session does not advance rotation
- **WHEN** a user starts a Session for a rotation Workout but the Session status becomes `abandoned`
- **THEN** `rotation_state.current_index` SHALL remain unchanged

### Requirement: Rotation next-workout peek for cron
The system SHALL provide a function to peek at the next Workout in a rotation without advancing the pointer. This is used by the evening check-in to preview what comes next.

#### Scenario: Peek at next rotation Workout
- **WHEN** the current rotation index is 1 in a 3-Workout rotation (Push, Pull, Legs)
- **THEN** peeking SHALL return the Workout at index 2 (Legs) without modifying `rotation_state`

#### Scenario: Peek wraps around at end of rotation
- **WHEN** the current rotation index is 2 in a 3-Workout rotation
- **THEN** peeking SHALL return the Workout at index 0 (Push)
