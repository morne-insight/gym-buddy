## Context

The mobile app is intentionally a single-purpose Session client: the user taps Start Workout, the app connects to LiveKit, and the Buddy guides the workout. The current flow uses local `isConnectionActive` state as the trigger to navigate into the Session screen, while the server-side agent creates a domain `sessions` row before it has confirmed a participant is present. Shutdown then completes the latest active Session, which can turn connection failures and early exits into completed workouts.

The project constraints are:
- The server remains the sole database client.
- The mobile app stays session-execution-only; onboarding and plan editing remain out of scope.
- LiveKit remains the real-time voice transport.
- Smart Workout Resolution and rotation advancement semantics must remain correct.
- The gym environment is hostile to perfect networking, so retry and rollback are first-class behavior, not edge cases.

## Goals / Non-Goals

**Goals:**
- Make Start Workout an explicit, observable lifecycle instead of a boolean.
- Prevent navigation into the workout UI until the LiveKit room, agent, and server domain Session are ready.
- Ensure every failed or cancelled start rolls back client and server state cleanly.
- Prevent failed starts, early disconnects, and user cancellation from marking workouts as completed or advancing rotation.
- Prepare the token/start boundary for authenticated users without forcing the full web-to-mobile auth bridge into this change.
- Keep the mobile UI simple: clear starting, connected, failed, retry, and ending states.

**Non-Goals:**
- Implementing web onboarding, payment, QR login, or full mobile authentication.
- Replacing LiveKit Agents or changing STT/LLM/TTS providers.
- Changing workout resolution rules, Program structure, or per-set logging behavior.
- Building a full offline workout mode.
- Adding open-ended chat outside a Session.

## Decisions

### D1 - Model connection as a state machine owned by `useConnection`
Replace `isConnectionActive` as the primary source of truth with a reducer/state machine:
`idle -> starting -> ready -> failed -> disconnecting -> idle`, with an additional connected-but-not-ready internal phase if useful. The state carries an optional error code/message and an in-flight operation ID.

Why over scattered booleans: the start flow spans native audio, token fetch, LiveKit room state, agent timeout, server data messages, and navigation. A single lifecycle prevents contradictory states like "active but failed" or overlapping start/end calls.

### D2 - Navigate only after a server readiness handshake
The Start button calls `connect()`, but the app stays on the start screen while the lifecycle is `starting`. The connection is considered ready only after:
1. native audio session starts,
2. `session.start()` succeeds,
3. LiveKit reports the room connected,
4. the expected agent is connected, and
5. the app receives a reliable `session_ready` data message from the agent/server.

Why over navigating after `session.start()`: `session.start()` waits for LiveKit and agent connectivity, but it does not prove the domain Session was created, initial workout data was published, or the UI has enough context to render a real workout. The explicit data message is the contract between server and mobile.

### D3 - Create the domain Session after participant readiness, not before
The agent entry should connect to the room and wait for the participant before creating the `sessions` row. After workout resolution and Session creation, it publishes `session_ready` with the Session ID, resolved workout/rest-day summary, and initial exercise progress if applicable.

Why over pre-creating the Session at job start: LiveKit can dispatch an agent before the user is truly stable in the room. Delaying creation prevents abandoned startup attempts from becoming workout history.

### D4 - Completion is explicit; disconnect is not completion
Server shutdown/disconnect handling must not call `completeSession()` as a blanket cleanup. Completion should happen only when the workout flow reaches workout completion or the user explicitly ends a completed workout. Failed starts and early exits become `abandoned` or `cancelled` depending on whether `session_ready` was ever delivered.

Why over completing on shutdown: rotation advancement is tied to `completeSession()`. Treating disconnection as completion corrupts both accountability history and rotation state.

### D5 - Rollback client resources on every failed start
If any step in `connect()` fails, the mobile app must:
- abort/ignore stale in-flight work,
- call `session.end()` or room disconnect if needed,
- stop the native audio session,
- clear any data-message state,
- transition to `failed` with a retryable error.

Why over relying on SDK cleanup: failures can happen before or after native audio starts. Explicit cleanup keeps audio routing, microphone state, and UI state aligned.

### D6 - Server owns room, participant, and agent dispatch in production
The token endpoint/start API should generate room name, participant identity, and agent dispatch server-side. The client may request "start workout" but must not be the authority for `room_config`, arbitrary agent name, or domain user identity. During the current founder/dev stage, the implementation can keep a compatibility path, but the new flow should be structured so the future authenticated API can replace it without changing mobile lifecycle semantics.

Why over trusting client-provided token options: the server is already the domain authority. Letting a client choose arbitrary room and dispatch fields makes it harder to bind a workout Session to the correct user and to reason about retry/idempotency.

### D7 - Use operation IDs to ignore stale messages
Each start attempt should have a client-visible operation/attempt ID or room name. The mobile app must ignore `session_ready`, `session_failed`, and progress messages that do not match the active attempt.

Why over accepting the first ready message: retries and slow LiveKit cleanup can produce late messages from an older room. Attempt correlation prevents stale state from navigating the user into the wrong Session.

## Risks / Trade-offs

- **Risk: Waiting for `session_ready` adds another startup gate** -> Mitigation: publish it immediately after Session creation and initial data; keep the payload small and reliable.
- **Risk: Cold agent starts can still take 20-30 seconds** -> Mitigation: retain the generous agent timeout, show a clear starting state, and keep retry/cancel available.
- **Risk: Existing tests assume shutdown completes Sessions** -> Mitigation: update tests to distinguish completed workout flow from abandoned connection flow.
- **Risk: Current hard-coded founder user remains during transition** -> Mitigation: keep it only as a development fallback; design token metadata/API boundaries around eventual authenticated user IDs.
- **Risk: Late data messages from previous attempts can confuse UI** -> Mitigation: require attempt/session correlation before mutating connection-critical state.
- **Risk: Additional Session statuses may require schema/test updates** -> Mitigation: `status` is already TEXT; add data-layer helpers and tests before changing agent behavior.

## Migration Plan

1. Add the new data-message payloads and mobile connection lifecycle without changing the server creation order.
2. Update the mobile start screen to stay mounted during `starting`, display failures, and retry without app restart.
3. Move agent Session creation after participant readiness and publish `session_ready`.
4. Replace shutdown auto-completion with explicit completion/abandonment helpers.
5. Add server tests proving failed starts and abandoned Sessions do not advance rotation.
6. Add mobile tests for start success, token failure, microphone failure, agent timeout, stale message ignored, retry, and disconnect.
7. Keep the existing local token endpoint compatible during development; later route the same lifecycle through the authenticated server API.

Rollback is straightforward if staged: revert to navigating after `session.start()` and the previous agent creation order, but do not retain any partial state-machine changes without the readiness message because that would create unclear lifecycle semantics.

## Open Questions

- Should an End Workout tap before workout completion create `abandoned` or `cancelled`? Proposed: before `session_ready` = `cancelled`; after `session_ready` but before workout completion = `abandoned`.
- Should `session_ready` be published by the agent only, or by a separate server API before agent voice startup? Proposed: agent publishes it because it owns LiveKit data-channel delivery and knows the voice session is ready.
- What is the final authenticated mobile identity source before QR/deep-link login ships? Proposed: keep `user-founder` fallback for local development, but make the token/start boundary accept server-verified identity as soon as the auth bridge exists.
