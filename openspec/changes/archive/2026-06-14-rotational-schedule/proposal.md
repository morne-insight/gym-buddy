## Why

The current schedule model is fixed to days of the week (e.g., Push on Monday, Pull on Wednesday). This works for users with consistent weekly routines, but many popular training programs — PPL, Upper/Lower, A/B splits — are designed as rotations: you do the next workout in the sequence regardless of what day it is. If a user misses Wednesday, they shouldn't skip Pull entirely; they should pick up where they left off. We need a rotational schedule mode so the app supports both patterns.

Additionally, the current model couples *what* you do (exercises) with *when* you do it (schedule slot). Exercises hang directly off `schedule` rows. This prevents sharing a Workout across multiple schedule types and must be separated as part of this change (see CONTEXT.md: Workout vs Schedule).

## What Changes

- **Separate Workout from Schedule**: Introduce a `workouts` table that owns the exercise list. `workout_exercises` moves from referencing `schedule` to referencing `workouts`. Schedule entries reference a Workout instead of owning exercises directly.
- Introduce a **schedule type** concept: `static` (current behavior — Workouts pinned to days of week) and `rotation` (Workouts cycle through an ordered sequence regardless of calendar day)
- Add a **program** model that groups related schedule entries into a named program with a type
- For rotation programs, track a **rotation pointer** per user so the system knows which Workout comes next based on the last completed Session
- Implement **Smart Workout Resolution** in `getCurrentWorkout`: instead of blindly following the schedule, check recent Session history and offer the next *unperformed* Workout. If the user trained ahead of schedule (e.g. did Push on Saturday), Monday's Session becomes Pull instead. Applies to both schedule types.
- Update the **evening check-in cron** to understand rotation schedules and use the Buddy's persona voice (Single Voice Rule — see CONTEXT.md)
- **BREAKING**: The `schedule.day_of_week` column becomes optional (NULL for rotation entries where position is tracked by `sort_order` within the program instead)
- **BREAKING**: `workout_exercises.schedule_id` replaced by `workout_exercises.workout_id`

## Capabilities

### New Capabilities
- `rotation-scheduling`: Core rotation logic — program model, rotation pointer tracking, next-workout resolution, and rotation advancement after Session completion
- `schedule-type-resolution`: Smart Workout Resolution that checks recent Session history and dispatches to static or rotation lookup based on program type, offering the next unperformed Workout rather than blindly following the schedule

### Modified Capabilities
_(none — no existing specs to modify)_

## Impact

- **Database schema**: New `workouts` table; `workout_exercises` re-parented from `schedule` to `workouts`; new `programs` table; `schedule` table gets `program_id` FK, `workout_id` FK, and nullable `day_of_week`; new `rotation_state` table
- **Server tools**: `getCurrentWorkout` rewritten to support Smart Workout Resolution for both schedule types; `completeExercise`/session completion must advance the rotation pointer
- **Cron**: `eveningCheckIn` needs rotation-aware "next workout" logic and persona-driven messages (Single Voice Rule)
- **Seed data**: Existing seed restructured — exercises move to `workouts` table; existing schedules wrapped in a `static` program; add a rotation PPL seed as example
- **No mobile UI changes required** — the mobile app already just receives today's workout from the agent; the resolution logic is entirely server-side
