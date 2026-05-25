## ADDED Requirements

### Requirement: Agent pushes exercise media to mobile via data channel
The agent SHALL publish a data channel message of type `exercise_media` containing the exercise GIF URL and exercise name when introducing a new exercise during a workout session. The mobile client caches this data locally but does NOT display it automatically.

#### Scenario: Agent sends GIF when starting a new exercise
- **WHEN** the agent begins guiding the user through a new exercise
- **THEN** the agent publishes a reliable data channel message with `{ type: 'exercise_media', payload: { gifUrl: '<exercisedb_gif_url>', exerciseName: '<name>' } }` to the room

#### Scenario: Agent sends media before verbal introduction
- **WHEN** the agent is about to introduce a new exercise
- **THEN** the data channel message SHALL be sent before the TTS response begins, allowing the mobile client to preload the image in background

#### Scenario: Exercise has no GIF URL available
- **WHEN** the exercise has no `exercise_db_id` or the GIF URL cannot be resolved
- **THEN** the agent SHALL NOT send an `exercise_media` message and SHALL proceed with voice-only guidance

### Requirement: Mobile app displays exercise GIF on demand
The mobile session screen SHALL display the exercise GIF only when the user explicitly requests it — either by tapping "Show Exercise" in the FAB menu or by asking the agent verbally.

#### Scenario: User taps "Show Exercise" FAB action
- **WHEN** the user taps the "Show Exercise" option in the FAB menu
- **THEN** the session screen displays the most recent exercise GIF as an overlay with the exercise name as a label

#### Scenario: User asks agent to show exercise
- **WHEN** the user verbally asks to see the exercise (e.g., "show me the exercise", "what does it look like")
- **THEN** the agent sends a data channel message that triggers the GIF overlay to appear on the mobile screen

#### Scenario: User dismisses exercise GIF
- **WHEN** the exercise GIF overlay is visible and the user taps outside it or taps the FAB again
- **THEN** the GIF overlay SHALL be dismissed

#### Scenario: New exercise replaces cached GIF
- **WHEN** a new `exercise_media` message arrives
- **THEN** the cached GIF data is updated; if the overlay is currently visible it updates in-place, otherwise it updates silently in background

#### Scenario: No GIF data available when user requests
- **WHEN** the user taps "Show Exercise" but no exercise media has been received (exercise has no GIF)
- **THEN** the FAB action SHALL be disabled or show a brief "No demo available" message

#### Scenario: Session ends while GIF is displayed
- **WHEN** the user ends the workout session
- **THEN** the GIF overlay SHALL be dismissed and cached data cleared

### Requirement: Data channel message format for exercise media
The data channel message SHALL use JSON encoding with reliable delivery mode and conform to the `DataMessage` union type.

#### Scenario: Message structure validation
- **WHEN** the agent sends an exercise media message
- **THEN** the payload MUST contain `gifUrl` (string, valid URL) and `exerciseName` (string, non-empty)

#### Scenario: Mobile receives malformed message
- **WHEN** the mobile app receives a data channel message that fails to parse as valid JSON or lacks required fields
- **THEN** the message SHALL be silently ignored without affecting the session
