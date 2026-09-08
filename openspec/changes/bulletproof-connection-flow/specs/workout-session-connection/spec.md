## ADDED Requirements

### Requirement: Mobile start flow has an explicit connection lifecycle
The mobile app SHALL model Start Workout as an explicit lifecycle with at least `idle`, `starting`, `ready`, `failed`, and `disconnecting` states. The app SHALL NOT use a single local boolean as the authority for both in-flight connection and active workout state.

#### Scenario: Start begins from idle
- **WHEN** the user taps Start Workout while the lifecycle is `idle`
- **THEN** the app SHALL transition to `starting`
- **AND** the app SHALL disable duplicate Start actions for the active attempt
- **AND** the app SHALL remain on the start screen until the ready criteria are satisfied

#### Scenario: Duplicate start is ignored
- **WHEN** the user taps Start Workout again while the lifecycle is `starting`
- **THEN** the app SHALL NOT start a second native audio session
- **AND** SHALL NOT request a second overlapping LiveKit connection for the same active attempt

### Requirement: Mobile navigates only after LiveKit and agent readiness
The mobile app SHALL navigate to the active Session screen only after the native audio session is started, the LiveKit room is connected, the expected Buddy agent is connected, and a reliable `session_ready` data message for the active attempt has been received.

#### Scenario: LiveKit room connects but readiness is not received
- **WHEN** `session.start()` resolves room and agent connectivity but no matching `session_ready` message has been received
- **THEN** the app SHALL remain in `starting`
- **AND** SHALL NOT navigate to the active Session screen

#### Scenario: Readiness message received
- **WHEN** the app receives a matching `session_ready` message for the active start attempt
- **THEN** the app SHALL transition to `ready`
- **AND** SHALL navigate to the active Session screen
- **AND** SHALL initialize Session UI state from the readiness payload

#### Scenario: Stale readiness message received
- **WHEN** the app receives a `session_ready` message for a previous attempt or non-current room
- **THEN** the app SHALL ignore the message
- **AND** SHALL NOT navigate or overwrite current Session state

### Requirement: Failed starts rollback client resources
If any start step fails before readiness, the mobile app SHALL rollback all client resources associated with that attempt, including native audio, LiveKit room state, local data-message state, and in-flight lifecycle state.

#### Scenario: Token request fails
- **WHEN** the token endpoint rejects the request or cannot be reached during Start Workout
- **THEN** the app SHALL transition to `failed`
- **AND** SHALL stop the native audio session if it had started
- **AND** SHALL keep the user on the start screen with a retry action

#### Scenario: Microphone or audio setup fails
- **WHEN** native audio configuration or microphone publication fails during Start Workout
- **THEN** the app SHALL transition to `failed`
- **AND** SHALL disconnect any partially connected LiveKit room
- **AND** SHALL expose a retryable failure state to the user

#### Scenario: Agent connection times out
- **WHEN** the LiveKit room connects but the expected Buddy agent does not connect before the configured timeout
- **THEN** the app SHALL transition to `failed`
- **AND** SHALL disconnect the room
- **AND** SHALL stop the native audio session
- **AND** SHALL allow the user to retry without restarting the app

### Requirement: Disconnect lifecycle is serialized
The mobile app SHALL serialize connect and disconnect operations so Start, End Workout, retry, and navigation cannot run overlapping lifecycle transitions.

#### Scenario: End pressed during disconnect
- **WHEN** the user presses End Workout while a disconnect is already in progress
- **THEN** the app SHALL NOT issue a second overlapping disconnect
- **AND** SHALL keep the lifecycle in `disconnecting` until teardown completes

#### Scenario: Retry after failure
- **WHEN** the user retries from `failed`
- **THEN** the app SHALL start a new attempt with a distinct attempt identifier or room correlation value
- **AND** SHALL ignore messages from the failed attempt

### Requirement: Server publishes Session readiness
After the Buddy agent has connected to the room, resolved the current Workout, and created the domain Session, the server SHALL publish a reliable `session_ready` data message for the active room/attempt.

#### Scenario: Workout Session is ready
- **WHEN** the agent has a connected participant, has resolved the current Workout, and has created the domain Session
- **THEN** the server SHALL publish `session_ready`
- **AND** the payload SHALL include the domain Session ID, whether the day is a rest day, the resolved Workout name when present, and enough initial exercise progress data for the mobile UI to render without waiting for a later progress message

#### Scenario: Readiness cannot be established
- **WHEN** the agent cannot resolve the user, cannot create the domain Session, or fails before readiness
- **THEN** the server SHALL NOT publish `session_ready`
- **AND** SHALL publish a failure message when it can still reach the room
- **AND** SHALL NOT mark any Session as completed

### Requirement: Failed or cancelled starts do not create completed workouts
The system SHALL NOT record a completed workout, advance rotation, or count attendance for a start attempt that fails or is cancelled before `session_ready`.

#### Scenario: User cancels before readiness
- **WHEN** the user cancels Start Workout before receiving `session_ready`
- **THEN** the mobile app SHALL disconnect and stop native audio
- **AND** the server SHALL NOT mark a workout as completed
- **AND** rotation state SHALL NOT advance

#### Scenario: Participant disconnects before readiness
- **WHEN** the LiveKit participant disconnects before the server has published `session_ready`
- **THEN** the server SHALL treat the attempt as cancelled or failed
- **AND** SHALL NOT create a completed Session
- **AND** SHALL NOT advance rotation state

### Requirement: Token/start authority is server-owned
For production flows, the server SHALL be the authority for room name, participant identity, user identity, and Buddy agent dispatch. The mobile client SHALL request to start a workout but SHALL NOT provide arbitrary agent dispatch or domain user identity.

#### Scenario: Server mints start credentials
- **WHEN** the mobile app requests credentials to start a Workout
- **THEN** the server SHALL choose the LiveKit room name and participant identity
- **AND** SHALL dispatch the configured Buddy agent
- **AND** SHALL bind the attempt to the server-resolved domain user

#### Scenario: Client-supplied dispatch is rejected in production
- **WHEN** a production client attempts to choose an arbitrary room agent dispatch
- **THEN** the server SHALL ignore or reject that value
- **AND** SHALL use the server-authorized Buddy configuration instead
