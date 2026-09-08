## 1. Contract and Data Model

- [x] 1.1 Add authenticated start-workout credential request/response schemas to `packages/contracts` for the mobile/server start boundary.
- [x] 1.2 Add `session_ready` and startup failure LiveKit data-message types to `server/src/data-messages.ts` and the mobile data-message decoder.
- [x] 1.3 Include attempt or room correlation fields in both start credential responses and startup-related LiveKit data messages.
- [x] 1.4 Add data-layer helpers for abandoning or cancelling Sessions without calling `completeSession()`.
- [x] 1.5 Add tests proving abandoned/cancelled Sessions do not advance rotation state.

## 2. Server Startup Lifecycle

- [x] 2.1 Reorder the LiveKit agent entry so it waits for a participant before creating the domain Session.
- [x] 2.2 Resolve the current Workout and create the domain Session only after participant readiness.
- [x] 2.3 Publish reliable `session_ready` after Session creation with Session ID and initial workout/rest-day payload.
- [x] 2.4 Publish a startup failure message when the agent can still reach the room but cannot establish readiness.
- [ ] 2.5 Replace shutdown auto-completion with explicit completed/abandoned/cancelled handling. Abandoned/cancelled handling shipped; the completed half is missing — no production code calls `completeSession` (the old shutdown call was removed and `completeExercise.workoutComplete` is unhandled), so completion and rotation advancement are currently broken.
- [ ] 2.6 Add server tests for successful readiness, pre-readiness disconnect, agent startup failure, and ready-but-abandoned disconnect.
- [ ] 2.7 Wire an explicit Session-completion trigger when the workout flow reaches completion (all exercises completed/skipped), and ensure a `completed` Session is not downgraded by the shutdown abandon/cancel path. Add a server test proving a completed workout advances rotation. (Satisfies the new "Workout completion is explicit and advances rotation" requirement.)

## 3. Token and Identity Boundary

- [x] 3.1 Add a start-workout credentials endpoint in `server/src/api/server.ts` that reuses the existing JWKS auth, identity provisioning, CORS, and Zod validation patterns.
- [x] 3.2 Generate room name, participant identity, attempt correlation ID, and Buddy agent dispatch server-side.
- [x] 3.3 Bind authenticated requests to the verified Supabase `sub`/domain `users.id`; keep `user-founder` only as an explicit development fallback for unauthenticated local mobile testing.
- [x] 3.4 Stop trusting arbitrary production client `room_config`, participant identity, user identity, and agent dispatch values.
- [x] 3.5 Keep the legacy `/getToken` path only as a compatibility shim or route it through the same server-owned credential builder.
- [x] 3.6 Add API/token tests for authenticated credentials, missing/invalid auth rejection, server-owned room/participant/dispatch, and development fallback behavior.

## 4. Mobile Connection Lifecycle

- [x] 4.1 Replace `isConnectionActive` with an explicit connection reducer/state machine.
- [x] 4.2 Serialize start, retry, end, and disconnect operations so overlapping lifecycle transitions are ignored or queued safely.
- [x] 4.3 Roll back native audio, LiveKit room state, and local message state on token, microphone, room, or agent failures.
- [x] 4.4 Track attempt correlation and ignore stale startup/progress messages from old attempts.
- [x] 4.5 Expose retryable failed state and cancel behavior from the start screen.
- [x] 4.6 Navigate to the Session screen only after a matching `session_ready` message transitions the lifecycle to ready.
- [ ] 4.7 Add a client-side agent-readiness timeout: if the LiveKit room connects but no matching `session_ready`/`session_failed` arrives within the configured timeout, transition to `failed`, disconnect the room, and stop native audio. The rewrite to raw `room.connect()` dropped the previous `useSession` `agentConnectTimeoutMilliseconds`, so the "Agent connection times out" scenario is currently unhandled (the app hangs in `starting` with only a Cancel action).

## 5. Session UI and Teardown

- [x] 5.1 Initialize Session screen state from the `session_ready` payload.
- [x] 5.2 Preserve existing semantic agent status labels and LiveKit audio-session setup.
- [x] 5.3 Await disconnect teardown before routing back from End Workout.
- [x] 5.4 Ensure End Workout before completion does not imply completed workout state.

## 6. Verification

- [ ] 6.1 Add mobile tests for start success, duplicate start, token failure, microphone failure, agent timeout, stale readiness ignored, retry, and end teardown.
- [ ] 6.2 Run server unit tests covering Session lifecycle and rotation non-advancement.
- [ ] 6.3 Run API/contract tests for the start-workout credentials endpoint.
- [ ] 6.4 Run mobile tests for the connection reducer and data-message handling.
- [ ] 6.5 Manually verify on a development build: successful cold start, failed credentials endpoint, microphone denied, retry after failure, and early disconnect.
- [x] 6.6 Update README or handoff notes with the new Start Workout troubleshooting flow and authenticated/start-endpoint expectations.
