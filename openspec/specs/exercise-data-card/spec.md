# exercise-data-card Specification

## Purpose
Defines how the agent pushes live exercise progress state to the mobile client over the data channel, the structure of the progress payload, and how the mobile app renders a pinnable progress card during a workout session.

## Requirements

### Requirement: Agent pushes exercise progress state to mobile
The agent SHALL publish a data channel message of type `exercise_progress` containing the current exercise state whenever the workout progress changes (new exercise started, set completed, exercise completed). The mobile client caches this state regardless of whether the progress card is visible.

#### Scenario: Workout session starts
- **WHEN** the agent begins a workout session and loads the exercise list
- **THEN** the agent publishes an `exercise_progress` message with the first exercise's details and zero completed sets

#### Scenario: Set completed
- **WHEN** the user confirms completion of a set via voice
- **THEN** the agent publishes an updated `exercise_progress` message with the incremented completed set count

#### Scenario: Exercise completed, next exercise begins
- **WHEN** all sets for the current exercise are done and the agent moves to the next exercise
- **THEN** the agent publishes an `exercise_progress` message with the new exercise's details and zero completed sets

### Requirement: Exercise progress payload structure
The `exercise_progress` payload SHALL contain all information needed to render the data card.

#### Scenario: Payload contains required fields
- **WHEN** the agent sends an `exercise_progress` message
- **THEN** the payload MUST include: `exerciseName` (string), `targetSets` (number), `targetReps` (string), `targetWeight` (number | null), `completedSets` (number), `currentSetNumber` (number), `exerciseIndex` (number, 0-based), `totalExercises` (number)

#### Scenario: Weight is not prescribed
- **WHEN** the exercise has no prescribed weight (bodyweight exercise)
- **THEN** `targetWeight` SHALL be null

### Requirement: Mobile app displays progress card on pin
The mobile session screen SHALL display the exercise data card only when the user pins it via the FAB menu. The card remains visible until unpinned or the session ends.

#### Scenario: User pins progress card
- **WHEN** the user taps "Pin Progress" in the FAB menu
- **THEN** the session screen displays the exercise data card showing current progress (exercise name, "Set X of Y", target reps/weight, completed set indicators)

#### Scenario: Progress card updates while pinned
- **WHEN** the progress card is pinned and a new `exercise_progress` message arrives
- **THEN** the card updates in real time with the latest progress data

#### Scenario: User unpins progress card
- **WHEN** the user taps "Pin Progress" again (toggle off) in the FAB menu
- **THEN** the progress card is hidden from the session screen

#### Scenario: No progress data when pinned
- **WHEN** the user pins the progress card before any `exercise_progress` message has been received
- **THEN** the card SHALL show a loading/waiting state until the first message arrives

#### Scenario: All exercises completed
- **WHEN** the progress card is pinned and the final exercise progress message indicates all exercises are done
- **THEN** the card SHALL display a completion state (e.g., "Workout Complete")

#### Scenario: Session ends while card is pinned
- **WHEN** the user ends the workout session while the progress card is pinned
- **THEN** the card is dismissed and pin state is reset
