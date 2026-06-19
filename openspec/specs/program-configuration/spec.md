# program-configuration Specification

## Purpose
Defines editing the active Program via intent endpoints — Workout and Exercise CRUD, schedule editing, and static↔rotation switching — with the server maintaining every scheduling invariant.

## Requirements

### Requirement: Edit the Workouts of the active Program
The system SHALL let an authenticated user add, remove, rename, and reorder the Workouts of their active Program. Removing a Workout SHALL also remove its schedule entries and exercises. These operations SHALL apply only to the caller's own Program.

#### Scenario: Add a Workout
- **WHEN** a user adds a Workout named "Arms" to their active Program
- **THEN** a `workouts` row SHALL be created under that Program
- **AND** it SHALL be available to schedule

#### Scenario: Remove a Workout
- **WHEN** a user removes a Workout
- **THEN** its `workout_exercises` and its `schedule` entries SHALL be removed as well

### Requirement: Edit the Exercises of a Workout
The system SHALL let a user add, remove, edit, and reorder the exercises of a Workout in their active Program, including `exercise_name`, `sets`, `reps`, `rest_seconds`, and `sort_order`.

#### Scenario: Add an exercise
- **WHEN** a user adds "Bicep Curl" with 3 sets, "10-12" reps to a Workout
- **THEN** a `workout_exercises` row SHALL be created under that Workout with those values

#### Scenario: Edit an exercise's prescription
- **WHEN** a user changes an exercise's sets from 3 to 4
- **THEN** the server SHALL persist `sets = 4` for that `workout_exercises` row

### Requirement: Edit the Schedule of the active Program
The system SHALL let a user edit when Workouts occur, expressed as intent. For a `static` Program the user SHALL set a `day_of_week` and `scheduled_time` per Workout; for a `rotation` Program the user SHALL set the order and `scheduled_time`. The client SHALL NOT submit raw `day_of_week`, `sort_order`, or `rotation_state` values for the server to store verbatim — the server SHALL derive and enforce the stored columns.

#### Scenario: Set a static schedule
- **WHEN** a user assigns "Push Day" to Monday at 18:00 in a static Program
- **THEN** the schedule entry for that Workout SHALL have the corresponding `day_of_week` and `scheduled_time`

#### Scenario: Reorder a rotation
- **WHEN** a user reorders the Workouts of a rotation Program
- **THEN** the server SHALL update the schedule entries' `sort_order` to contiguous values reflecting the new order

### Requirement: Switch the Program scheduling type with server-owned invariants
The system SHALL let a user switch their active Program between `static` and `rotation`. The server SHALL perform the transform and maintain all invariants. Switching to `rotation` SHALL null every schedule entry's `day_of_week`, assign contiguous `sort_order`, and create a `rotation_state` row at `current_index = 0`. Switching to `static` SHALL require a `day_of_week` for each schedule entry and SHALL delete the Program's `rotation_state` row.

#### Scenario: Switch static to rotation
- **WHEN** a user switches a static Program to rotation
- **THEN** all schedule entries SHALL have `day_of_week` NULL and contiguous `sort_order`
- **AND** a `rotation_state` row SHALL be created for the Program with `current_index = 0`

#### Scenario: Switch rotation to static requires days
- **WHEN** a user switches a rotation Program to static and supplies a `day_of_week` for each Workout
- **THEN** each schedule entry SHALL have its `day_of_week` set
- **AND** the Program's `rotation_state` row SHALL be deleted

### Requirement: Configuration preserves the single-active-Program invariant
All configuration operations SHALL act on the caller's single active Program and SHALL keep at most one active Program per user. The resulting data SHALL remain valid for Smart Workout Resolution and rotation advancement as defined by the `rotation-scheduling` and `schedule-type-resolution` specs.

#### Scenario: Edits keep the plan agent-resolvable
- **WHEN** a user finishes customising their active Program
- **THEN** `getCurrentWorkout` for that user SHALL resolve a Workout consistent with the configured schedule and type
