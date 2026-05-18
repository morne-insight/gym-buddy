# Proposal: Gym Buddy MVP

## Problem

People training alone lose motivation and accountability without someone holding them to their commitments. The hardest moments aren't mid-set — they're the night before when you're deciding whether to pack your bag, or the morning when the alarm goes off. No app solves this because they provide information, not social friction.

## Solution

An AI gym buddy that lives across three surfaces — voice coaching during workouts, Telegram messaging between workouts, and a web app for onboarding/settings. The buddy is a persona-driven character (not a generic PT) that builds a relationship with the user over time, using guilt, encouragement, and memory to enforce accountability.

The core mechanic is **social friction, not information**.

## Architecture

```
┌─────────────────────┐
│   WEB APP            │  Onboarding + subscription
│   - Sign up          │
│   - Choose persona   │
│   - Set goals        │
│   - Training style   │
│   - Training days    │
│   - Link Telegram    │
│   - (Later) Edit     │
│     workout routines │
└──────────┬──────────┘
           │ writes to
           ▼
┌─────────────────────┐
│   SERVER             │
│   - Node.js          │
│   - SQLite           │  ← all data lives here
│   - LiveKit Agent    │  ← voice sessions
│   - Telegram Bot     │  ← out-of-gym messaging
│   - Cron / Scheduler │  ← notification triggers
│   - OpenAI (LLM,    │
│     STT, TTS)        │
│   - ExerciseDB API   │  ← exercise descriptions, media
└──────────┬──────────┘
           │
    ┌──────┴──────┐
    ▼              ▼
┌────────┐   ┌──────────┐
│ Mobile │   │ Telegram │
│ App    │   │          │
│ (Expo) │   │ Check-ins│
│        │   │ Chat     │
│ Voice  │   │ Products │
│ only   │   │ Goals    │
└────────┘   └──────────┘
```

### Key architectural decisions

1. **SQLite on the server, not on-device.** The agent needs direct database access for tool calls. No bridging, no data channel hacks, no sync layer. The phone is a thin voice client.

2. **Telegram as the rich UI layer.** Product recommendations, goal images, check-in conversations — all happen in Telegram, which already supports images, link previews, inline buttons, and carousels. This eliminates the need for dynamic UI / server-driven UI in the mobile app.

3. **Web-based onboarding and subscription.** Persona selection, goal setting, training style, schedule — all configured on the web. Subscription handled outside app stores. The mobile app stays minimal.

4. **Three surfaces, one brain.** The same server, same database, same persona knowledge powers voice sessions, Telegram messages, and the web app. The buddy is one consistent character across all channels.

5. **ExerciseDB for exercise knowledge.** The LLM agent has access to ExerciseDB (via AscendAPI or the OSS version) to look up exercise descriptions, form cues, target muscles, and instructional media. When a user doesn't know how to perform an exercise, the buddy can describe proper form, cue key movements, and (via Telegram) send reference GIFs or images. This keeps the buddy credible as a knowledgeable training partner without hard-coding exercise knowledge into prompts.
   - **AscendAPI (paid):** 11,000+ exercises, HD videos, GIFs, multilingual, validated by certified professionals. Docs: https://docs.ascendapi.com/introduction
   - **ExerciseDB OSS (free):** Open-source alternative with core exercise data. Docs: https://oss.exercisedb.dev/docs

## Persona System

The buddy is not a personal trainer — it's a friend who happens to be a beast. Users choose a persona during onboarding that determines tone, language style, and voice.

### Prompt architecture

```
┌─────────────────────────────┐
│  PERSONA LAYER              │  ← swappable per user
│  tone, language, reactions, │
│  how they handle skips/wins │
│  /no-shows                  │
├─────────────────────────────┤
│  BASE LAYER                 │  ← shared across all personas
│  tools, workout flow,       │
│  voice brevity rules,       │
│  history access patterns    │
└─────────────────────────────┘
```

### Example personas

| Persona | Motivation Style | Skip Reaction |
|---------|-----------------|---------------|
| The Drill Sergeant | Shame + pride | "That's fine. Stay mediocre." |
| The Wise Coach | Trust + investment | "Don't waste the work we've put in." |
| The Class Clown | Humor + guilt | "Even I could do this one, come on." |

Each persona maps to a different TTS voice preset for full character immersion.

## Accountability Messaging (Telegram)

### Adaptive frequency

Messages taper as habits form. The LLM decides whether today warrants a message based on:
- Attendance streak length
- How often the user needed prompting vs showed up unprompted
- Historical skip patterns (e.g., always skips Wednesdays)

Early weeks: near-daily. Month 2+: only when it matters. Less frequent = more impactful.

### Message types

1. **Pre-workout accountability** — night-before "gear ready?" and morning-of reminders
2. **Missed workout follow-up** — the most important message in the app
3. **Goal image reminders** — random afternoon nudge with a picture of the user's goal
4. **Sentiment-driven follow-ups** — during voice sessions, the LLM detects struggle or frustration and schedules a motivational message for later that day/evening
5. **Exercise form guidance** — when a user doesn't know how to do an exercise, the buddy describes proper form via voice and sends reference GIFs/images via Telegram (sourced from ExerciseDB)
6. **Product recommendations** — when conversation turns to supplements/gear, the buddy researches and sends product cards via Telegram
6. **Two-way conversation** — user can reply, buddy responds in-persona with full history context

### Sentiment-driven scheduling

During a voice workout session, if the LLM detects the user is struggling emotionally (not just physically), it creates a scheduled follow-up message for later that day. The voice session becomes a sensor for emotional state, and the buddy reaches out hours later when the user is home and most vulnerable to quitting.

## MVP Scope (founder testing only)

- [ ] React Native Expo app — voice session UI (start/stop, connection status)
- [ ] Node.js LiveKit Agent server with OpenAI integration (STT/TTS/LLM)
- [ ] Server-side SQLite with workout schedule and exercise log tables
- [ ] Seed script with one week of a 3-day workout program
- [ ] Agent tool functions: getCurrentWorkout, logExerciseCompleted, getExerciseHistory, getExerciseInfo (ExerciseDB lookup)
- [ ] Base system prompt + one persona layer
- [ ] Basic Telegram bot for out-of-gym check-ins
- [ ] Cron triggers for pre-workout and missed-workout messages
- [ ] LLM-generated in-persona notification content

## Deferred (Friends Beta)

- Web onboarding app (persona selection, goals, training days)
- Phone UI to input/edit workout routines
- Post-workout stats screen
- Multiple persona options with distinct voices
- Subscription / payment integration
- WhatsApp channel (in addition to Telegram)
- Goal image storage and reminder system

## Deferred (Final Vision)

- Voice-guided routine creation ("Trainer builds your program")
- Product search and recommendations via Telegram
- Sentiment-driven motivational scheduling from voice sessions
- Adaptive message frequency based on habit formation
- Full onboarding flow with training style selection (weightlifting, calisthenics)

## Success Criteria

The founder completes 3 full weeks of the programmed gym routine without dropping a single session or skipping a scheduled exercise.

## Non-Goals

- Custom workout program generation (routines are manually seeded for MVP)
- 3D exercise animations
- Social features / multi-user interaction
- In-app dynamic UI / server-driven UI components
- App store distribution (Expo dev builds / TestFlight only)
