# Tasks: Gym Buddy MVP

## Phase 1: Project Scaffolding

### 1.1 Initialize monorepo structure
- [x] Create root `package.json` with workspaces (`apps/mobile`, `server`)
- [x] Set up TypeScript config (root `tsconfig.json` + per-package)
- [x] Set up ESLint + Prettier
- [x] Initialize git repo

### 1.2 Set up Expo mobile app
- [x] `npx create-expo-app apps/mobile`
- [x] Configure Expo Router for navigation
- [x] Install `@livekit/react-native` and required native dependencies
- [x] Create placeholder screens: home (`index.tsx`), session (`session.tsx`)
- [x] Verify app runs on device/simulator

### 1.3 Set up Node.js agent server
- [x] Initialize `server/` with TypeScript + ts-node
- [x] Install `@livekit/agents` and inference plugins
- [x] Install `better-sqlite3`, `zod`, `node-cron`, `node-telegram-bot-api`
- [x] Create agent entrypoint (`agent.ts`) with minimal LiveKit agent that connects and echoes
- [x] Set up environment variable handling (LiveKit keys, OpenAI key, Telegram token)
- [x] Verify agent starts and registers with LiveKit Cloud

### 1.4 Set up testing infrastructure
- [x] Configure Jest with `ts-jest` for the server package
- [x] Set up test database (in-memory SQLite for tests)
- [x] Create test helpers for mocking LLM responses and Telegram sends

---

## Phase 2: Database + Seed Data

### 2.1 Create database schema
- [x] Write `server/db/schema.sql` with all tables (users, personas, schedule, workout_exercises, sessions, exercise_logs, scheduled_messages)
- [x] Create `server/db/index.ts` with connection setup and migration runner
- [x] Write query helpers for each table (insert, select, update patterns)
- [x] Test: schema creates cleanly, query helpers return expected shapes

### 2.2 Seed MVP workout data
- [x] Write `server/db/seed.sql` with:
  - One user (founder)
  - One persona (Drill Sergeant)
  - 3-day weekly schedule (e.g., Push/Pull/Legs across Mon/Wed/Fri)
  - 4-6 exercises per workout day with sets/reps/rest
  - ExerciseDB IDs for each exercise where available
- [x] Create seed script that runs schema + seed in sequence
- [x] Test: seed runs cleanly, getCurrentWorkout query returns correct data for each day (manual verification needed)

---

## Phase 3: Agent Tools (TDD)

### 3.1 getCurrentWorkout tool
- [x] Implement: query schedule + workout_exercises for current day of week
- [x] Return structured data: workout name, ordered exercise list with sets/reps/rest
- [x] Handle: no workout scheduled today (rest day)
- [x] Test: correct workout for each day, rest day returns appropriate message
- [x] Register as LiveKit agent tool with Zod schema

### 3.2 logExerciseCompleted tool
- [x] Implement: create/update exercise_logs entry
- [x] Track actual sets, reps, weight, and skip status
- [x] Return: confirmation + remaining exercise count
- [x] Handle: logging a skip (skipped = true, with note)
- [x] Handle: session auto-creation if none exists
- [x] Test: log completion, log skip, verify counts, duplicate prevention

### 3.3 getExerciseHistory tool
- [x] Implement: query exercise_logs + sessions for a given exercise name
- [x] Return: last 10 sessions with weights, reps, skip/complete status, dates
- [x] Calculate: skip frequency, weight progression trend
- [x] Test: history with mixed skips/completions, empty history for new exercise

### 3.4 getExerciseInfo tool
- [x] Implement: HTTP call to ExerciseDB API by exercise name
- [x] Return: description, target muscles, instructions, GIF URL
- [x] Handle: exercise not found, API timeout, rate limiting
- [x] Cache results in-memory to avoid repeated API calls for same exercise
- [x] Test: successful lookup, not found, API error handling (mocked)

### 3.5 sendTelegramMedia tool
- [x] Implement: look up user's telegram_chat_id, send image/GIF via bot API
- [x] Handle: user has no Telegram linked, send failure
- [x] Test: successful send, missing chat ID, API error (mocked)

### 3.6 scheduleMotivationalMessage tool
- [x] Implement: insert into scheduled_messages with calculated deliver_at
- [x] Store context string for later LLM-generated content
- [x] Handle: validation (deliverInHours must be reasonable, 1-24)
- [x] Test: message scheduled with correct delivery time, context stored

---

## Phase 4: System Prompt + Persona

### 4.1 Write base system prompt
- [ ] Create `server/prompts/base.ts` with the shared prompt layer
- [ ] Cover: voice brevity rules, workout flow, accountability rules, history awareness, sentiment detection, tool usage instructions
- [ ] Export as a function that accepts user context (name, history summary)

### 4.2 Create Drill Sergeant persona
- [ ] Create `server/prompts/personas/drill-sergeant.ts`
- [ ] Define: tone, skip reactions, show-up reactions, PR reactions, struggle reactions
- [ ] Map to TTS voice preset
- [ ] Export as prompt string + voice config

### 4.3 Prompt composition
- [ ] Create `server/prompts/index.ts` that combines base + persona into final system prompt
- [ ] Accept user ID, load persona preference and user context from DB
- [ ] Test: composed prompt includes both layers, persona-specific content is present

---

## Phase 5: Voice Session Integration

### 5.1 Wire up LiveKit AgentSession
- [ ] Configure `AgentSession` with VAD (Silero), Turn Detection (LiveKit MultilingualModel), STT (Cartesia Ink-Whisper), LLM (OpenAI GPT-4o), TTS (Cartesia Sonic 3)
- [ ] Download turn detector model weights, configure min/max endpointing delays (tune for gym context — user may pause to breathe between sets)
- [ ] Inject composed system prompt (base + persona)
- [ ] Register all tool functions (getCurrentWorkout, logExerciseCompleted, getExerciseHistory, getExerciseInfo, sendTelegramMedia, scheduleMotivationalMessage)
- [ ] Handle agent lifecycle events (participant joined, disconnected)
- [ ] Test: agent connects to room, responds to voice input

### 5.2 Implement filler audio for latency masking
- [ ] Record or source short filler clips ("Let me check...", "One sec...", "Hmm...")
- [ ] Play filler audio during THINKING state before TTS response arrives
- [ ] Hook into agent events to detect when LLM is processing
- [ ] Test: filler plays during tool execution delay

### 5.3 Session lifecycle management
- [ ] Auto-create a session record when workout voice session starts
- [ ] Update session status on completion or disconnection
- [ ] Store detected sentiment (populated by LLM via tool or metadata)
- [ ] Handle reconnection gracefully (phone drops wifi mid-workout)

---

## Phase 6: Mobile App — Voice Client

### 6.1 LiveKit connection
- [ ] Implement token generation (server endpoint or temporary hardcoded for MVP)
- [ ] Connect to LiveKit room from Expo app
- [ ] Handle audio permissions (microphone)
- [ ] Handle background audio (keep session alive when phone is locked/screen off)

### 6.2 Session UI
- [ ] Home screen: "Start Workout" button, shows today's scheduled workout name
- [ ] Session screen: connection status indicator, "End Workout" button
- [ ] Minimal — the voice IS the interface
- [ ] Handle: no workout today (rest day message)

### 6.3 Mobile testing
- [ ] Test on physical device (voice quality, background stability)
- [ ] Test: start session → agent greets → guide through exercise → log → end session
- [ ] Test: phone screen off during workout, session stays alive
- [ ] Test: wifi drop and reconnection

---

## Phase 7: Telegram Bot

### 7.1 Bot setup
- [ ] Create bot via BotFather, store token in env
- [ ] Initialize bot with polling (MVP) in `server/telegram/bot.ts`
- [ ] Implement `/start {userId}` deep link handler to link Telegram → user
- [ ] Test: bot responds to /start, stores chat ID

### 7.2 Inbound message handling
- [ ] Route user messages to LLM with persona context
- [ ] Maintain brief conversation history per user (last N messages)
- [ ] Respond in-persona via text
- [ ] Test: user sends message, gets in-persona response

### 7.3 Outbound messaging
- [ ] Implement `sendMessage` helper that looks up chat ID and sends via bot API
- [ ] Support: text messages, images with captions, GIFs
- [ ] Test: send text, send image, handle missing chat ID

---

## Phase 8: Cron Scheduler + Notifications

### 8.1 Scheduled message delivery
- [ ] Cron job (every minute): query scheduled_messages where deliver_at <= now and not delivered
- [ ] For messages with null content: generate via LLM with persona + context
- [ ] Deliver via Telegram, mark as delivered
- [ ] Test: message generated and delivered on time

### 8.2 Pre-workout check-in
- [ ] Evening cron (21:00): check who has a workout scheduled tomorrow
- [ ] LLM decides whether to send based on streak/frequency
- [ ] Generate in-persona "gear ready?" message
- [ ] Test: message generated for user with workout tomorrow, skipped for rest day

### 8.3 Missed workout detection
- [ ] Late evening cron (22:00): check who had a workout today
- [ ] If no session logged → generate missed workout message
- [ ] This is the most important notification — must be in-persona and reference history
- [ ] Test: missed workout detected, message generated, not triggered on completed days

### 8.4 Goal reminder (stretch for MVP)
- [ ] Random afternoon cron: pick 1-2 times per week
- [ ] Send goal image + short motivational caption
- [ ] Test: goal image sent with persona-appropriate caption

---

## Phase 9: End-to-End Testing

### 9.1 Full workout flow
- [ ] Seed data → start agent → connect mobile app → complete full workout via voice
- [ ] Verify: all exercises logged, session marked complete, correct tool calls made

### 9.2 Accountability flow
- [ ] Skip an exercise → verify pushback + skip logged with history reference
- [ ] Miss a workout day → verify missed workout notification sent via Telegram
- [ ] Pre-workout notification → verify timing and persona tone

### 9.3 Sentiment flow
- [ ] Express frustration during voice session → verify motivational message scheduled
- [ ] Verify message delivers hours later via Telegram with relevant context

### 9.4 Exercise info flow
- [ ] Ask "how do I do a Romanian deadlift?" during voice session
- [ ] Verify: voice describes form, Telegram receives GIF from ExerciseDB
