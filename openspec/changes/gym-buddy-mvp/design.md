# Design: Gym Buddy MVP

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         GYM BUDDY MVP                               │
│                                                                     │
│  ┌──────────────┐     LiveKit WebSocket      ┌──────────────────┐  │
│  │  Mobile App  │◄──────────────────────────►│  Agent Server    │  │
│  │  (Expo)      │     voice (audio tracks)   │  (Node.js)       │  │
│  │              │                            │                  │  │
│  │  - LiveKit   │                            │  ┌────────────┐  │  │
│  │    SDK       │                            │  │ LiveKit    │  │  │
│  │  - Start/    │                            │  │ Agent      │  │  │
│  │    Stop UI   │                            │  │ Session    │  │  │
│  │  - Auth      │                            │  │            │  │  │
│  └──────────────┘                            │  │ STT→LLM→TTS│ │  │
│                                              │  └─────┬──────┘  │  │
│                                              │        │ tools   │  │
│  ┌──────────────┐     Telegram Bot API       │  ┌─────▼──────┐  │  │
│  │  Telegram    │◄──────────────────────────►│  │  SQLite    │  │  │
│  │              │     messages, images,       │  │            │  │  │
│  │  - Check-ins │     inline buttons         │  │ - Users    │  │  │
│  │  - Chat      │                            │  │ - Workouts │  │  │
│  │  - Products  │                            │  │ - Logs     │  │  │
│  │  - Goals     │                            │  │ - Personas │  │  │
│  └──────────────┘                            │  └────────────┘  │  │
│                                              │                  │  │
│                                              │  ┌────────────┐  │  │
│                                              │  │ Cron       │  │  │
│                                              │  │ Scheduler  │  │  │
│                                              │  └────────────┘  │  │
│                                              │                  │  │
│                                              │  ┌────────────┐  │  │
│                                              │  │ ExerciseDB │  │  │
│                                              │  │ API Client │  │  │
│                                              │  └────────────┘  │  │
│                                              └──────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Component | Technology | Package |
|-----------|-----------|---------|
| Mobile app | React Native + Expo | `expo`, `@livekit/react-native` |
| Agent server | Node.js + TypeScript | `@livekit/agents` |
| Voice VAD | Silero VAD (local, via LiveKit) | `@livekit/agents-plugin-silero` |
| Turn detection | LiveKit Turn Detector (local) | `@livekit/agents-plugin-livekit` |
| Voice STT | Cartesia Ink-Whisper (via LiveKit) | `@livekit/agents` inference plugin |
| Voice LLM | OpenAI GPT-4o | `@livekit/agents` inference plugin |
| Voice TTS | Cartesia Sonic 3 (via LiveKit) | `@livekit/agents` inference plugin |
| Database | SQLite | `better-sqlite3` |
| Telegram bot | node-telegram-bot-api | `node-telegram-bot-api` |
| Exercise data | ExerciseDB (AscendAPI or OSS) | HTTP client |
| Scheduling | node-cron | `node-cron` |
| Tool schemas | Zod | `zod` |
| Testing | Jest | `jest`, `ts-jest` |

## Database Schema

```sql
-- User profile (MVP: single user, but structured for multi-user)
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  telegram_chat_id TEXT,
  persona_id TEXT NOT NULL DEFAULT 'drill-sergeant',
  goal_description TEXT,
  goal_image_url TEXT,
  training_style TEXT NOT NULL DEFAULT 'weightlifting',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Persona definitions
CREATE TABLE personas (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  tts_voice TEXT NOT NULL,
  example_greeting TEXT,
  example_skip_reaction TEXT,
  example_no_show_reaction TEXT
);

-- Weekly schedule (which days the user trains)
CREATE TABLE schedule (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  day_of_week INTEGER NOT NULL, -- 0=Sunday, 1=Monday, etc.
  workout_name TEXT NOT NULL,   -- e.g. "Push Day", "Legs", "Pull Day"
  scheduled_time TEXT,          -- e.g. "06:00" (optional)
  active INTEGER NOT NULL DEFAULT 1
);

-- Exercises within a workout
CREATE TABLE workout_exercises (
  id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL REFERENCES schedule(id),
  exercise_name TEXT NOT NULL,
  exercise_db_id TEXT,          -- ExerciseDB reference for lookups
  sets INTEGER NOT NULL,
  reps TEXT NOT NULL,           -- "8-12" or "to failure"
  rest_seconds INTEGER DEFAULT 90,
  sort_order INTEGER NOT NULL
);

-- Session log (one per gym visit)
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  schedule_id TEXT REFERENCES schedule(id),
  started_at DATETIME NOT NULL,
  completed_at DATETIME,
  status TEXT NOT NULL DEFAULT 'in_progress', -- in_progress, completed, abandoned
  notes TEXT,
  sentiment TEXT                -- detected mood: positive, neutral, struggling
);

-- Exercise completion log
CREATE TABLE exercise_logs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  workout_exercise_id TEXT NOT NULL REFERENCES workout_exercises(id),
  completed INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  actual_sets INTEGER,
  actual_reps TEXT,
  actual_weight REAL,
  notes TEXT,
  completed_at DATETIME
);

-- Scheduled messages (LLM-generated, pending delivery)
CREATE TABLE scheduled_messages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  deliver_at DATETIME NOT NULL,
  message_type TEXT NOT NULL,   -- pre_workout, missed_workout, motivation, goal_reminder
  content TEXT,                 -- LLM-generated content (null until generated)
  image_url TEXT,               -- optional goal image or exercise GIF
  delivered INTEGER NOT NULL DEFAULT 0,
  created_by TEXT               -- 'cron' or 'voice_session' (sentiment-triggered)
);
```

## Agent Tool Definitions

The LiveKit agent registers these tools via Zod schemas. The LLM calls them during voice sessions.

### getCurrentWorkout

Returns today's scheduled workout with all exercises.

```typescript
const getCurrentWorkout = llm.tool({
  description: 'Get the workout scheduled for today. Call this when the user starts a session.',
  parameters: z.object({
    userId: z.string().describe('The user ID')
  }),
  execute: async ({ userId }) => {
    // Query schedule by day_of_week + join workout_exercises
    // Return: { workoutName, exercises: [{ name, sets, reps, rest }] }
  }
});
```

### logExerciseCompleted

Records completion of a single exercise.

```typescript
const logExerciseCompleted = llm.tool({
  description: 'Log that the user completed an exercise. Call after they confirm an exercise is done.',
  parameters: z.object({
    sessionId: z.string(),
    exerciseId: z.string(),
    actualSets: z.number().optional(),
    actualReps: z.string().optional(),
    actualWeight: z.number().optional(),
    skipped: z.boolean().default(false)
  }),
  execute: async (params) => {
    // Insert into exercise_logs
    // Return confirmation with remaining exercises count
  }
});
```

### getExerciseHistory

Returns a user's history for a specific exercise (for accountability and progress tracking).

```typescript
const getExerciseHistory = llm.tool({
  description: 'Get history for a specific exercise. Use to reference past performance or call out skipping patterns.',
  parameters: z.object({
    userId: z.string(),
    exerciseName: z.string()
  }),
  execute: async ({ userId, exerciseName }) => {
    // Query exercise_logs joined with sessions
    // Return: last N sessions with weights, reps, skip count
  }
});
```

### getExerciseInfo

Looks up exercise details from ExerciseDB when the user doesn't know how to perform an exercise.

```typescript
const getExerciseInfo = llm.tool({
  description: 'Look up exercise form and instructions from ExerciseDB. Use when the user asks how to do an exercise or seems unsure about form.',
  parameters: z.object({
    exerciseName: z.string().describe('Name of the exercise to look up')
  }),
  execute: async ({ exerciseName }) => {
    // Call ExerciseDB API
    // Return: { description, targetMuscles, instructions, gifUrl }
  }
});
```

### sendTelegramMedia

Sends an image or GIF to the user's Telegram (e.g., exercise form reference during voice session).

```typescript
const sendTelegramMedia = llm.tool({
  description: 'Send an image or GIF to the user on Telegram. Use to share exercise form references or goal images during a voice session.',
  parameters: z.object({
    userId: z.string(),
    imageUrl: z.string(),
    caption: z.string().optional()
  }),
  execute: async ({ userId, imageUrl, caption }) => {
    // Look up user's telegram_chat_id
    // Send via Telegram Bot API
  }
});
```

### scheduleMotivationalMessage

Allows the LLM to schedule a follow-up message when it detects the user is struggling.

```typescript
const scheduleMotivationalMessage = llm.tool({
  description: 'Schedule a motivational message for later. Use when you detect the user is struggling emotionally or expressing doubt during a workout.',
  parameters: z.object({
    userId: z.string(),
    deliverInHours: z.number().describe('Hours from now to deliver the message'),
    context: z.string().describe('What the user was struggling with, so the message can reference it')
  }),
  execute: async ({ userId, deliverInHours, context }) => {
    // Insert into scheduled_messages with deliver_at calculated
    // The cron job will generate and send the actual message later
  }
});
```

## Prompt Architecture

### Base Layer (shared across all personas)

```
You are the user's gym buddy. You are NOT a personal trainer or a fitness app.
You are a friend who trains with them and holds them accountable.

VOICE RULES:
- Keep sentences short and punchy. This is spoken, not written.
- No bullet lists. No enumerations. Conversational only.
- One exercise at a time. Don't dump the full workout up front.
- Example: "First up, bench press. 4 sets of 8. Rack's waiting."

WORKOUT FLOW:
1. When user starts a session, call getCurrentWorkout to get today's schedule.
2. Guide them through one exercise at a time.
3. After each exercise, call logExerciseCompleted.
4. Reference their history when relevant using getExerciseHistory.
5. If they don't know an exercise, call getExerciseInfo and describe the form.
   Send the GIF to their Telegram using sendTelegramMedia.

ACCOUNTABILITY RULES:
- If they want to skip an exercise, push back. Reference their skip history.
- If they skipped it before, call it out: "You skipped this last time too."
- Allow the skip after pushback, but log it. Remember it.
- Track sentiment. If the user sounds defeated, discouraged, or frustrated,
  call scheduleMotivationalMessage to send them something encouraging later.

HISTORY AWARENESS:
- Reference past sessions naturally: "Last week you hit 80kg, don't load 70."
- Call out patterns: "You've skipped Romanian deadlifts 3 of the last 4 sessions."
- Celebrate streaks: "That's 8 sessions in a row. Respect."
```

### Persona Layer (swapped per user)

Example: "The Drill Sergeant"

```
YOUR IDENTITY:
You are [persona name]. You're the friend who got them into lifting.
You know more than they do, and you've earned the right to push them.
You're not their employee — you're the mate who shows up and expects them to as well.

YOUR TONE:
- Direct. No fluff. Say it like it is.
- Disappointed when they slack, not angry. The disappointment hits harder.
- Proud when they push through, but don't gush. A nod of respect.
- Use their name. You know them.

WHEN THEY SKIP:
"That's fine. Stay mediocre. I'll be here at 5am either way."

WHEN THEY SHOW UP:
"Look who actually showed up. Alright, let's get after it."

WHEN THEY HIT A PR:
"There it is. That's the work paying off. Don't let it go to your head."

WHEN THEY'RE STRUGGLING:
"Everyone has off days. But you're here. That's what matters. One set at a time."
```

Each persona also maps to a TTS voice configuration for full character immersion.

## Voice State Machine

```
                    ┌──────────────────┐
                    │                  │
                    │      IDLE        │◄─────────────────────────┐
                    │  (VAD filtering) │                          │
                    └────────┬─────────┘                          │
                             │ VAD detects speech                │
                             ▼                                   │
                    ┌──────────────────┐                          │
                    │                  │                          │
                    │   LISTENING      │                          │
                    │   (STT active)   │                          │
                    └────────┬─────────┘                          │
                             │ Turn Detector confirms             │
                             │ user is done speaking              │
                             ▼                                   │
                    ┌──────────────────┐                          │
                    │                  │       plays filler       │
                    │   THINKING       │──────"Let me check..."  │
                    │   (LLM processing)                         │
                    └────────┬─────────┘                          │
                             │                                   │
                    ┌────────┴─────────┐                          │
                    │                  │                          │
              ┌─────▼─────┐    ┌──────▼──────┐                   │
              │           │    │             │                    │
              │ SPEAKING  │    │    TOOL     │                    │
              │ (TTS out) │    │ EXECUTION   │                    │
              │           │    │             │                    │
              └─────┬─────┘    └──────┬──────┘                   │
                    │                 │ result → back to LLM      │
                    │                 ▼                           │
                    │          ┌──────────────┐                   │
                    │          │  SPEAKING    │                   │
                    │          │  (TTS out)   │                   │
                    │          └──────┬───────┘                   │
                    │                 │                           │
                    └─────────────────┴───────────────────────────┘
                                      done speaking → IDLE

              On error at any state → ERROR → attempt recovery → IDLE
```

LiveKit's `AgentSession` handles most of this pipeline automatically (VAD → Turn Detection → STT → LLM → TTS). Silero VAD filters background gym noise, the Turn Detector prevents interrupting the user mid-sentence or during breathing pauses between sets, and filler audio during the THINKING state masks LLM latency by playing pre-recorded clips.

## Telegram Bot Flow

### Linking account

During web onboarding (future) or MVP setup, generate a deep link:

```
https://t.me/GymBuddyBot?start={userId}
```

When user clicks it, the bot receives `/start {userId}` and stores the mapping:

```typescript
bot.onText(/\/start (.+)/, (msg, match) => {
  const userId = match[1];
  const telegramChatId = msg.chat.id;
  // UPDATE users SET telegram_chat_id = telegramChatId WHERE id = userId
});
```

### Message handling

User messages to the bot are forwarded to the LLM with the same persona context and conversation history. The bot acts as a text-based version of the voice buddy.

### Outbound message types

| Type | Trigger | Content |
|------|---------|---------|
| Pre-workout | Cron, night before | "Gear packed? Alarm set?" (in-persona) |
| Morning reminder | Cron, morning of | "Today's the day. Chest and tris." |
| Missed workout | Cron, end of scheduled day | "You didn't show. What happened?" |
| Goal reminder | Cron, random afternoon | Goal image + short caption |
| Sentiment follow-up | Voice session trigger | Motivational message referencing struggle |
| Exercise form | Voice session tool call | GIF/image from ExerciseDB |

## Cron Scheduler Design

```
┌─────────────────────────────────────────────────────────────┐
│                    CRON JOBS                                  │
│                                                             │
│  Every minute: check scheduled_messages table               │
│    → WHERE deliver_at <= now AND delivered = 0              │
│    → For each: generate content via LLM (if null),          │
│      send via Telegram, mark delivered                      │
│                                                             │
│  Every evening (e.g. 21:00): pre-workout check              │
│    → For each user with workout scheduled tomorrow          │
│    → LLM decides whether to send (based on streak,          │
│      frequency rules) and generates in-persona message      │
│    → Insert into scheduled_messages                         │
│                                                             │
│  Every morning (e.g. 06:00): morning reminder               │
│    → Same pattern as evening, for same-day workout          │
│                                                             │
│  Every evening (e.g. 22:00): missed workout detection       │
│    → For each user with workout scheduled today             │
│    → If no session logged → generate missed workout msg     │
│                                                             │
│  Random weekly: goal reminder                               │
│    → Pick 1-2 random afternoons per week                    │
│    → Send goal image with motivational caption              │
└─────────────────────────────────────────────────────────────┘
```

The LLM decides whether to send based on:
- Attendance streak (longer streak = fewer reminders needed)
- Recent frequency of messages (avoid nagging)
- Historical skip patterns for this day of week
- User's detected sentiment from recent sessions

## Latency Mitigation

The 2-4 second gap while the LLM generates a response is masked with pre-recorded filler audio clips:

- "Let me check that..."
- "One sec..."
- "Hmm..."
- "Alright..."

These play during the THINKING state before TTS output begins. They're persona-neutral short clips that buy time without breaking immersion.

## Project Structure

```
gym-buddy/
├── apps/
│   └── mobile/                  # Expo React Native app
│       ├── app/                 # Expo Router pages
│       │   ├── _layout.tsx
│       │   ├── index.tsx        # Home / session start
│       │   └── session.tsx      # Active voice session screen
│       ├── components/
│       │   └── SessionControls.tsx
│       ├── lib/
│       │   └── livekit.ts       # LiveKit connection helpers
│       ├── app.json
│       └── package.json
├── server/
│   ├── agent.ts                 # LiveKit agent entrypoint
│   ├── tools/
│   │   ├── getCurrentWorkout.ts
│   │   ├── logExerciseCompleted.ts
│   │   ├── getExerciseHistory.ts
│   │   ├── getExerciseInfo.ts
│   │   ├── sendTelegramMedia.ts
│   │   └── scheduleMotivationalMessage.ts
│   ├── prompts/
│   │   ├── base.ts              # Base system prompt
│   │   └── personas/
│   │       ├── drill-sergeant.ts
│   │       └── wise-coach.ts
│   ├── telegram/
│   │   ├── bot.ts               # Telegram bot setup
│   │   └── handlers.ts          # Message handlers
│   ├── cron/
│   │   ├── scheduler.ts         # Cron job definitions
│   │   ├── preWorkout.ts
│   │   ├── missedWorkout.ts
│   │   └── goalReminder.ts
│   ├── db/
│   │   ├── schema.sql           # Table definitions
│   │   ├── seed.sql             # MVP workout data
│   │   └── index.ts             # Database connection + queries
│   └── package.json
├── docs/
│   └── plan.md
├── openspec/
│   └── changes/
│       └── gym-buddy-mvp/
│           ├── proposal.md
│           ├── design.md
│           └── tasks.md
└── package.json                 # Monorepo root
```

## External Service Dependencies

| Service | Purpose | MVP Cost |
|---------|---------|----------|
| LiveKit Cloud | Voice room infrastructure | Free tier available |
| OpenAI API | LLM (GPT-4o) | Pay per use |
| Cartesia | STT (Ink-Whisper) + TTS (Sonic 3) | Free tier available |
| Telegram Bot API | Messaging channel | Free |
| ExerciseDB (AscendAPI) | Exercise data + media | Free tier available |
