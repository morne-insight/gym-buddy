## ADDED Requirements

### Requirement: Workout completion is explicit and advances rotation
A domain Session SHALL be marked `completed` only when the workout flow reaches workout completion (every exercise in the resolved Workout has been completed or skipped) or the user explicitly ends an already-completed workout. Marking a Session `completed` is the single trigger that advances rotation state for rotation programs. Agent shutdown, participant disconnect, and ending before completion SHALL NOT mark a Session `completed`.

This requirement closes the gap created by removing shutdown auto-completion: with the implicit completion path gone, an explicit completion trigger MUST exist or no Session is ever recorded as completed and rotation never advances.

#### Scenario: Completed workout advances rotation
- **WHEN** every exercise in the resolved Workout for a rotation program at index 1 has been completed or skipped and the workout flow reaches completion
- **THEN** the system SHALL mark the Session `completed`
- **AND** rotation state SHALL advance to index 2

#### Scenario: Completion is not triggered by disconnect
- **WHEN** the agent shuts down or the participant disconnects while the Session is still `in_progress`
- **THEN** the system SHALL NOT mark the Session `completed`
- **AND** rotation state SHALL NOT advance

#### Scenario: Completed Session survives a later disconnect
- **WHEN** a Session has already been marked `completed` and the participant subsequently disconnects
- **THEN** the disconnect SHALL NOT downgrade the Session to `abandoned` or `cancelled`
- **AND** rotation state SHALL remain advanced

## MODIFIED Requirements

### Requirement: Session creation records program context
When a Workout Session is started, the system SHALL record the `schedule_id` of the resolved Workout regardless of program type. This domain Session SHALL be created only after the LiveKit participant is present and the Buddy agent is ready to publish Session readiness. Failed or cancelled connection attempts before readiness SHALL NOT create completed Sessions and SHALL NOT advance rotation state.

#### Scenario: Rotation Session links to correct schedule entry
- **WHEN** a Session starts for a rotation program at index 2 and the LiveKit participant and Buddy agent are ready
- **THEN** the Session's `schedule_id` SHALL reference the schedule entry with `sort_order = 2` in the rotation program
- **AND** the server SHALL publish readiness for that Session before the mobile app enters the active Session UI

#### Scenario: Static Session with Smart Resolution links to resolved entry
- **WHEN** a Session starts on Monday, Smart Resolution selects Pull Day because Push Day was already done, and the LiveKit participant and Buddy agent are ready
- **THEN** the Session's `schedule_id` SHALL reference the Pull Day schedule entry, not the Monday/Push Day entry
- **AND** the server SHALL publish readiness for that Session before the mobile app enters the active Session UI

#### Scenario: Failed connection attempt does not create completed Session
- **WHEN** a user starts connecting for a rotation program but disconnects or the agent fails before Session readiness is published
- **THEN** the system SHALL NOT create a completed Session for that attempt
- **AND** rotation state SHALL NOT advance

#### Scenario: Ready Session abandoned before completion
- **WHEN** Session readiness has been published but the user disconnects before the workout is completed
- **THEN** the Session SHALL be marked abandoned or left non-completed according to the Session lifecycle
- **AND** rotation state SHALL NOT advance
