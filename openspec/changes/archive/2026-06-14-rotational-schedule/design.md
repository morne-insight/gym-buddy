## Context

The current scheduling system maps workouts to fixed days of the week via the `schedule` table (`day_of_week INTEGER NOT NULL`). Exercises are owned directly by schedule entries via `workout_exercises.schedule_id`. This conflates *what* you do with *when* you do it and fails for rotation-based programs (PPL, Upper/Lower, A/B) where the next workout depends on what was last completed, not the calendar.

Key constraints:
- The voice agent resolves today's workout at session start via `getCurrentWorkout()` — this is the single integration point
- The mobile app receives the workout over a LiveKit data channel and doesn't care how it was resolved
- The evening check-in cron needs to know "what's next" for accountability messages — and must speak in the Buddy's voice (Single Voice Rule)
- SQLite is the only data store (no external services)
- Domain model (see CONTEXT.md): Workout is a template, Schedule is timing, Session is an execution; the Buddy adapts the week based on what's been done (Smart Workout Resolution)

## Goals / Non-Goals

**Goals:**
- Separate Workout (exercise template) from Schedule (timing) so the same Workout can be shared across schedule types
- Support both static (day-of-week) and rotation (sequential cycle) schedule types
- Implement Smart Workout Resolution: check recent Session history and offer the next unperformed Workout, regardless of schedule type
- Preserve all existing static schedule behavior as-is (after data migration)
- Make workout resolution transparent to the agent and mobile app — they ask "what's today's workout?" and get an answer regardless of schedule type
- Automatically advance the rotation pointer when a Session completes (not when abandoned)
- Enable the evening cron to preview the next rotation workout for accountability messages

**Non-Goals:**
- Schedule editor UI (still seed/DB-managed for MVP)
- Hybrid schedules (e.g., rotation on weekdays, rest on weekends) — can be layered later
- Rest day configuration within rotations (rotation assumes every non-rest day is a training day; user just doesn't open the app on rest days)
- Multiple active programs per user
- Subscription Plan enforcement within resolution (soft cap nudges are a separate concern)

## Decisions

### 1. Separate Workout from Schedule with a `workouts` table

**Decision**: Create a `workouts` table (`id`, `name`, `program_id`) that owns the exercise list. `workout_exercises` references `workout_id` instead of `schedule_id`. Schedule entries reference a Workout via `workout_id`.

**Why over alternatives**:
- *Alternative: Keep exercises on schedule entries* — rejected because it couples what-to-do with when-to-do-it. Two different schedule types (static and rotation) referencing the same PPL exercises would require duplicating the exercise rows.
- *Alternative: Shared exercise templates independent of programs* — rejected as over-engineering for MVP. Workouts scoped to a program is sufficient.

**Domain alignment**: See CONTEXT.md — "Exercises belong to the Workout, not to a schedule slot."

### 2. Introduce a `programs` table as the parent of schedules

**Decision**: Create a `programs` table that groups schedule entries into a named program with a `type` field (`static` or `rotation`). Each `schedule` row gets a `program_id` FK.

**Why over alternatives**:
- *Alternative: Add `type` directly to `schedule` table* — rejected because a program is a logical grouping (e.g., "PPL Rotation") and the type applies to the group, not individual entries. Putting type on each row would be denormalized and error-prone.
- *Alternative: Separate `rotation_programs` table* — rejected because static and rotation programs share structure (name, user, active state). A single table with a type discriminator is simpler.

### 3. Track rotation state in a dedicated `rotation_state` table

**Decision**: Create `rotation_state` with columns `user_id`, `program_id`, `current_index` (0-based position in the rotation), and `last_completed_at`. Updated when a Session completes.

**Why over alternatives**:
- *Alternative: Store pointer on `programs` table* — rejected because rotation state is mutable session-by-session while program definition is relatively static. Separating concerns keeps the program table clean.
- *Alternative: Compute from session history* — rejected because querying "last completed schedule_id" and mapping back to sort order on every session start adds unnecessary complexity and fragile joins. An explicit pointer is simpler and O(1).

### 4. Make `schedule.day_of_week` nullable

**Decision**: Alter `day_of_week` to `INTEGER` (nullable). For static programs it remains required (enforced in application code). For rotation programs it is NULL — position within the rotation is expressed by `sort_order` on the schedule entries.

**Why**: Schedule entries for both types share the same table. The only structural difference is whether position is calendar-driven or sequence-driven.

### 5. Smart Workout Resolution in `getCurrentWorkout`

**Decision**: `getCurrentWorkout` accepts `userId` and optional `dayOfWeek`. It:
1. Loads the user's active program
2. Queries recent Session history for the current week
3. Determines which Workouts have already been performed
4. For `static`: starts with today's day-of-week Workout, but if already performed this week, offers the next unperformed Workout in the program
5. For `rotation`: reads `rotation_state.current_index`, fetches the Workout at that position (rotation pointer already reflects what's been done)
6. Returns the same `CurrentWorkoutResult` shape — callers don't know or care about the schedule type

**Why**: See CONTEXT.md — Smart Workout Resolution. The schedule is the default, the Buddy is the interpreter. If the user did Push on Saturday, Monday becomes Pull. The underlying schedule doesn't change.

**Note**: For rotation programs, Smart Resolution is largely handled by the rotation pointer itself — the pointer only advances on completion, so it naturally points to the next unperformed Workout. For static programs, recent Session history must be checked explicitly.

### 6. Advance rotation on Session completion, not Session start

**Decision**: The rotation pointer advances when `completeSession` is called, not when the Session starts. Abandoned Sessions (see CONTEXT.md: Session Status) do not advance the pointer.

**Why**: If a user starts a Session but abandons it, the rotation should not advance — they should get the same Workout next time. Advancing on completion ensures the pointer reflects actual progress.

### 7. Evening check-in uses rotation-aware resolution and Buddy persona

**Decision**: The cron's "tomorrow's workout" logic becomes:
- `static`: same as today — `getScheduleForDay(tomorrow_dow)`
- `rotation`: peek at the workout at `(current_index + 1) % rotation_length` without advancing the pointer

All messages are generated in the Buddy's persona voice (Single Voice Rule — see CONTEXT.md). No system-voiced messages.

**Why**: Rotation users don't have fixed days. Messages say "Next up is Pull Day" rather than "Tomorrow is Pull Day" since the day isn't fixed. Persona-driven messages maintain the illusion that the Buddy is a real person texting them.

## Risks / Trade-offs

- **[Risk] Pointer drift if sessions are manually deleted or DB is edited** → Mitigation: rotation_state is the source of truth; if it gets out of sync, a simple reset (set `current_index = 0`) recovers. Not a concern for MVP single-user.

- **[Risk] User might want to skip ahead or repeat a rotation day** → Mitigation: Out of scope for MVP. The voice agent could eventually support "skip to next" or "repeat this one" commands that manually adjust the pointer.

- **[Risk] Migration of existing seed data** → Mitigation: Create `workouts` rows from existing `workout_exercises` groups, re-parent exercise rows, wrap existing schedule rows in a default `static` program. Zero behavior change for existing data.

- **[Trade-off] No rest-day awareness in rotation mode** → The rotation just cycles through workouts. If a user wants rest days between rotation workouts, they simply don't open the app. This keeps the model simple but means the evening cron might message on rest days. Acceptable for MVP.

- **[Trade-off] Smart Resolution for static schedules adds query complexity** → Checking recent Session history on every session start requires a week-scoped query. Acceptable for SQLite performance; index on `sessions(user_id, started_at)` keeps it fast.
