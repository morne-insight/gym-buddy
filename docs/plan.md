# Design: AI Personal Trainer Accountability Engine (React Native + LiveKit)

> ## ⚠️ Status update (2026-06-15) — architecture has evolved since this doc
>
> This is the **original MVP design** and is kept as a historical record. Several
> foundational decisions below have since changed. For how the project works **today**,
> read [`README.md`](../README.md), [`CONTEXT.md`](../CONTEXT.md) (domain glossary),
> [`docs/adr/0001-web-onboarding-mobile-session.md`](adr/0001-web-onboarding-mobile-session.md),
> and [`server/AGENTS.md`](../server/AGENTS.md).
>
> What changed:
>
> - **Persistence: device-side SQLite → server-side Supabase (Postgres).** The
>   "Local SQLite Database" / "Device-Side Tool Calls … without a backend server sync"
>   constraints below no longer hold. The **LiveKit Agents server is the sole database
>   client**; the mobile app talks to the server (LiveKit + a token endpoint), never to
>   the database directly. The data-access layer (`server/src/db/`) is async Postgres via
>   the `postgres` (porsager) client. Rationale and task history:
>   `openspec/changes/migrate-to-supabase/`.
> - **No SQLite on the mobile client.** The mobile app holds no domain database; the
>   architecture diagram below (SQLite in both boxes) is superseded.
> - **Client surfaces split (ADR-0001):** a **Web Client** owns onboarding/payment/plan
>   management; the **Mobile App** is session-execution-only.
> - **Terminology:** the AI persona is the **Buddy** (a knowledgeable friend), not a
>   "Personal Trainer" — accountability comes from the relationship, not professional
>   authority. See `CONTEXT.md`.
>
> The state-machine, latency-masking, voice-loop, and TDD guidance below remain accurate.

## Problem Statement
People training alone lose motivation and accountability when they don't have a human PT waiting for them. The core problem is finding a way to successfully enforce gym attendance and routine adherence through social friction, guilt, and loss aversion—not just providing another database of exercises.

## Demand Evidence
The founder is an expat who experienced this precise emotional/accountability gap after losing an English-speaking PT. The proxy user is exactly the founder, whose workout routine is faltering specifically because nobody is disappointed when they skip "leg day."

## Status Quo
Users without trainers are currently skipping workouts entirely, ignoring difficult muscle groups, or settling for lower intensity simply because they do not face the friction of answering to another human being for their laziness.

## Target User & Narrowest Wedge
**Target User:** Solo lifters/expats who know what to do but lack the discipline to do it alone.

**The Wedge:** A React Native mobile app with a manually inputted workout schedule that connects to an LLM for real-time, in-workout voice friction, and preemptive push notifications/texts enforcing attendance. Custom program generation and advanced 3D animations are explicitly deferred.

## Constraints
1. **Local SQLite Database:** The program and schedule must be inputted directly into a local database (SQLite) to avoid building an entire admin panel or integrating a third-party backend for MVP.
2. **Audio/Background Execution:** The voice session must remain stable while the phone sits on the gym floor during workouts.
3. **Device-Side Tool Calls:** The LLM must be able to trigger read/write operations against local SQLite without a backend server sync.

## Premises
1. **The core mechanic is social friction, not information.** The AI must establish an emotional baseline of strictness to enforce guilt and disappointment if routines are broken.
2. **We skip the automated workout generator.** The app reads the existing routine manually input into the database and sticks to it flawlessly.
3. **The focus is the Voice/Chat layer.** We defer 3D Rive animations until the raw auditory experience proves it can keep the user accountable.

## Architecture & Code Quality Guidelines
1. **LiveKit Agents Framework:** Use LiveKit's agent pattern for voice orchestration, STT/TTS, and conversation management. This ensures stable long-running voice sessions during workouts.
2. **Explicit State Machine:** The voice loop will be managed using a formal state machine (`IDLE`, `LISTENING`, `THINKING`, `TOOL_EXECUTION`, `SPEAKING`, `ERROR`). Ad-hoc boolean flipping (`isLoading`, `isRecording`) is strictly banned to prevent async race conditions during network drops.
3. **Strict Test Coverage:** Voice and LLM tools are heavily mocked with Jest up front so that edges (like a function call failing, or network timeout during generation) can be proven without having to manually test them on a device.
4. **Perceived Latency Mitigation:** To handle the 3-4s gap while OpenAI generates an audio response, the app must play local, pre-recorded audio fillers ("Let me record that...", "Hmm...") while in the `THINKING` state to mask the network latency.

## Approach
### React Native Expo + LiveKit Agents (Selected)
A React Native app built with Expo using LiveKit Agents for the voice interaction loop (STT → LLM → TTS) running in a Node.js server. The agent defines functions that bridge to the mobile device's local SQLite database for reading workout schedules and logging exercise completions.

**Architecture:**
```
┌─────────────────┐
│ React Native    │
│ (Expo)          │
│ - LiveKit SDK   │
│ - SQLite        │
└────────┬────────┘
         │ LiveKit WebSocket
         ▼
┌─────────────────┐
│ Node.js Agent   │
│ - LiveKit Agent │
│ - OpenAI Tools  │
│ - SQLite Bridge │
└─────────────────┘
```

**Key Design Points:**
- **LiveKit Agents** handles STT (Whisper), LLM routing, and TTS (OpenAI)
- **Agent functions** registered on the server call into the mobile device via LiveKit's function calling mechanism
- **Local SQLite** stores workout schedules and exercise logs - no backend required for MVP
- **Expo** enables rapid mobile development with access to native features

## Recommended Approach
**Approach B**. It properly captures the "voice in your ear" mechanic the user desires for the in-gym experience, while building on a cross-platform foundation (React Native with Expo) that seamlessly scales up to 3D animations (via Rive) and an external exercise database (via Ascend API) in phase two. Crucially, we will use **LiveKit Agent Function Calling** so the remote AI can securely trigger read/write commands against your local SQLite database without needing a backend server sync.

## Success Criteria
The founder completes 3 full weeks of the programmed gym routine without dropping a single session or skipping a scheduled exercise.

## Distribution Plan
For MVP testing: Expo Go or local test builds via TestFlight/Android APK directly to the founder's phone. No app store process required until the accountability loop is proven.

## The Assignment
**1. Set up the initial React Native Expo skeleton with Jest testing.**
**2. Create the Node.js LiveKit Agent server with OpenAI integration.**
**3. TDD the agent functions that bridge to SQLite (read workout schedule, log completion) with 100% test coverage.**
**4. Manually seed the SQLite DB with exactly *one week* of your present 3-day workout schedule.**
**5. Wire up the LiveKit mobile SDK to connect to the agent and test the conversational flow answering to the schedule.**
**6. Implement simple start/stop controls on the mobile UI; focus on the conversational flow, not polished UI.**
