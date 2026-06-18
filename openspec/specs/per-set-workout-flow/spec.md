# per-set-workout-flow Specification

## Purpose
Defines the per-set workout flow in which the agent checks in after each individual set, manages rest timers between sets, records per-set data via dedicated tools and the `set_logs` table, and the mobile app surfaces a rest timer countdown.

## Requirements

### Requirement: Agent checks in after each individual set
The agent SHALL prompt the user after each set for confirmation of reps completed and weight used, rather than asking about all sets at once.

#### Scenario: User completes a set
- **WHEN** the user verbally confirms they finished a set (e.g., "done", "got 10 reps at 80kg")
- **THEN** the agent logs the set via `logSetCompleted` tool and acknowledges the set completion

#### Scenario: User reports partial reps
- **WHEN** the user reports fewer reps than the target (e.g., target 10, user says "only got 8")
- **THEN** the agent logs the actual reps and provides encouraging in-persona feedback

#### Scenario: User wants to skip remaining sets
- **WHEN** the user indicates they want to skip the rest of the exercise (e.g., "let's move on")
- **THEN** the agent completes the exercise with remaining sets marked as skipped and advances to the next exercise

### Requirement: Rest timer starts after each set (except the last)
The agent SHALL start a rest timer after each completed set, except after the final set of an exercise.

#### Scenario: Set completed, more sets remaining
- **WHEN** a set is logged and there are remaining sets for the current exercise
- **THEN** the agent announces the rest duration (from `workout_exercises.rest_seconds`), sends a `rest_timer` data channel message with action `start` and `durationSeconds`, and waits for the rest period to elapse

#### Scenario: Rest period ends
- **WHEN** the rest timer reaches zero
- **THEN** the agent sends a `rest_timer` message with action `end` and verbally announces "Rest is over" (in persona) to prompt the next set

#### Scenario: Final set of exercise completed
- **WHEN** the user completes the last set of an exercise
- **THEN** no rest timer starts; the agent immediately transitions to the next exercise or workout completion

#### Scenario: User speaks during rest
- **WHEN** the user speaks during the rest period (asks a question, requests info)
- **THEN** the agent responds normally without canceling or resetting the rest timer

### Requirement: logSetCompleted tool records individual sets
The system SHALL provide a `logSetCompleted` tool that records a single set's data in the `set_logs` table.

#### Scenario: Successful set log
- **WHEN** the agent calls `logSetCompleted` with exerciseLogId, setNumber, reps, and weight
- **THEN** a new row is inserted into `set_logs` with the provided data and current timestamp

#### Scenario: First set creates exercise_log parent record
- **WHEN** `logSetCompleted` is called for set 1 of an exercise and no `exercise_logs` record exists for this exercise in the current session
- **THEN** the system creates the `exercise_logs` record first, then inserts the set log

#### Scenario: Tool returns progress summary
- **WHEN** `logSetCompleted` completes successfully
- **THEN** the tool returns: `{ logged: true, setNumber, totalSets, exerciseComplete: boolean, remainingExercises: number }`

### Requirement: completeExercise tool finalizes an exercise
The system SHALL provide a `completeExercise` tool that marks an exercise as done and triggers progression to the next exercise.

#### Scenario: All sets completed normally
- **WHEN** `completeExercise` is called after all sets are logged
- **THEN** the `exercise_logs` record is updated with `completed = 1` and `completed_at` timestamp

#### Scenario: Exercise skipped
- **WHEN** `completeExercise` is called with `skipped: true`
- **THEN** the `exercise_logs` record is updated with `skipped = 1` and any unlogged sets are not recorded

#### Scenario: Last exercise in workout
- **WHEN** `completeExercise` is called and there are no remaining exercises
- **THEN** the tool returns `{ workoutComplete: true }` and the session can be ended

### Requirement: set_logs database table
The system SHALL store per-set data in a `set_logs` table linked to `exercise_logs`.

#### Scenario: Schema structure
- **WHEN** the database is initialized
- **THEN** the `set_logs` table exists with columns: `id` (TEXT PK), `exercise_log_id` (TEXT FK → exercise_logs), `set_number` (INTEGER), `reps` (INTEGER), `weight` (REAL nullable), `completed_at` (DATETIME)

#### Scenario: Migration from aggregated data
- **WHEN** existing `exercise_logs` rows have `actual_sets`/`actual_reps`/`actual_weight` data
- **THEN** the migration creates corresponding `set_logs` rows (one per set, distributing comma-separated reps) and removes the deprecated columns

### Requirement: Mobile displays rest timer countdown
The mobile session screen SHALL display a visual countdown timer when a rest period is active.

#### Scenario: Rest timer starts
- **WHEN** the mobile app receives a `rest_timer` message with action `start`
- **THEN** the session screen displays a countdown timer starting from `durationSeconds`

#### Scenario: Rest timer ends
- **WHEN** the mobile app receives a `rest_timer` message with action `end` OR the countdown reaches zero
- **THEN** the timer display is removed from the session screen

#### Scenario: Timer visual prominence
- **WHEN** the rest timer is active
- **THEN** the timer SHALL be visually prominent (large font, centered) as it is the primary information during rest
