## Why

Starting a Workout currently treats "user tapped Start" as equivalent to "a live Buddy Session exists", which makes transient LiveKit failures, microphone permission failures, cold agent starts, and early disconnects look like real workouts. This change makes the start flow deterministic and recoverable so the mobile app never strands the user in a fake session and the server never records or completes workouts that did not actually happen.

## What Changes

- Add an explicit mobile connection lifecycle for starting a Workout: idle, starting, connected/ready, failed, and disconnecting.
- Gate navigation to the active Session screen on a confirmed LiveKit room connection, connected agent, and server-published readiness message.
- Make start failures rollback native audio, LiveKit room state, local UI state, and any server-side start attempt.
- Move server-side domain Session creation to the point where a real participant is present and the agent is ready to run the workout.
- Add a reliable server-to-mobile `session_ready` data message that contains the created Session ID and resolved workout summary.
- Distinguish user cancellation, connection failure, and workout completion in Session status handling; failed starts and early disconnects SHALL NOT mark a workout as completed or advance rotation.
- Bind the token/agent dispatch path to a server-owned user/session intent so the client does not supply arbitrary room, participant, or agent dispatch details in production.

## Capabilities

### New Capabilities
- `workout-session-connection`: Defines the reliable mobile-to-LiveKit-to-agent startup lifecycle, readiness handshake, failure rollback, retry behavior, and token/identity constraints for starting a Workout Session.

### Modified Capabilities
- `schedule-type-resolution`: Clarifies that Session creation records the resolved schedule only after the LiveKit participant and agent are ready, and that incomplete connection attempts do not count as started or completed Sessions.

## Impact

- **Mobile app (`apps/mobile/`)**: `useConnection`, start screen navigation, session screen failure/retry handling, data-message consumption, and native audio teardown.
- **Server (`server/`)**: token server / future start-session API boundary, LiveKit agent entry order, data-message contract, Session status transitions, and rotation advancement safety.
- **Contracts/data messages**: new `session_ready` and likely `session_failed`/error payloads shared by server and mobile.
- **Database/domain behavior**: no new scheduling model, but Session lifecycle semantics become stricter so failed starts and abandoned Sessions cannot be recorded as completed workouts.
- **Tests**: mobile hook/component tests for lifecycle transitions; server tests for delayed Session creation, failure/abandonment behavior, and rotation non-advancement.
