import { z } from 'zod';

/**
 * @gym-buddy/contracts — the single source of truth for the web↔server API.
 *
 * Each endpoint's request and response shape is a Zod schema here. The server
 * validates every incoming request body with these schemas before touching the
 * database; the web client validates the same shapes in its forms; both sides
 * import the inferred TypeScript types. One definition, no drift.
 *
 * Kept as a single file on purpose: the built `dist` is consumed both as Node
 * ESM (server) and by a bundler (web), and a single module sidesteps relative
 * import-extension resolution differences between those consumers.
 */

// --- Shared primitives -------------------------------------------------------

/** A Program is either fixed-weekday (`static`) or a rolling cycle (`rotation`). */
export const programType = z.enum(['static', 'rotation']);
export type ProgramType = z.infer<typeof programType>;

/**
 * Training styles offered at onboarding. A fixed list with a single option for
 * now; new styles are added here and the dropdown follows automatically.
 */
export const TRAINING_STYLES = ['weightlifting'] as const;
export const trainingStyle = z.enum(TRAINING_STYLES);
export type TrainingStyle = z.infer<typeof trainingStyle>;

/** ISO day-of-week: 1 = Monday … 7 = Sunday (matches Postgres `isodow`). */
export const dayOfWeek = z.number().int().min(1).max(7);

/** "HH:MM" 24-hour clock, e.g. "06:00" or "18:30". */
export const scheduledTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:MM (24-hour)');

/** A rep prescription is free text, e.g. "8-10", "12", "to failure". */
export const reps = z.string().min(1).max(40);
export const sets = z.number().int().min(1).max(20);
export const restSeconds = z.number().int().min(0).max(900);

/** Uniform error envelope returned by the API on any non-2xx response. */
export const errorResponse = z.object({
  error: z.string(),
  details: z.unknown().optional(),
});
export type ErrorResponse = z.infer<typeof errorResponse>;

// --- Auth / session ----------------------------------------------------------

/**
 * The authenticated caller as resolved by the server from the verified Supabase
 * access token. The server provisions the domain `users` row on first call, so
 * `/me` always returns a profile for a valid token.
 */
export const meResponse = z.object({
  /** The domain `users.id` (equal to the Supabase auth `sub`). */
  id: z.string(),
  /** Whether the user has finished onboarding (name + persona + program set). */
  onboarded: z.boolean(),
});
export type MeResponse = z.infer<typeof meResponse>;

// --- Personas (Buddy picker) -------------------------------------------------

export const personaSummary = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  example_greeting: z.string().nullable(),
});
export type PersonaSummary = z.infer<typeof personaSummary>;

export const personaListResponse = z.array(personaSummary);
export type PersonaListResponse = z.infer<typeof personaListResponse>;

// --- Profile -----------------------------------------------------------------

export const profileResponse = z.object({
  id: z.string(),
  name: z.string(),
  persona_id: z.string(),
  goal_description: z.string().nullable(),
  goal_image_url: z.string().nullable(),
  training_style: z.string(),
});
export type ProfileResponse = z.infer<typeof profileResponse>;

/**
 * Onboarding / profile-edit submission. `name`, `persona_id`, and
 * `training_style` are required; `goal_description` is optional free text.
 * The goal image is set separately (see the signed-upload flow).
 */
export const updateProfileRequest = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  persona_id: z.string().min(1, 'Pick a Buddy'),
  goal_description: z.string().trim().max(2000).nullish(),
  training_style: trainingStyle,
});
export type UpdateProfileRequest = z.infer<typeof updateProfileRequest>;

// --- Goal image (signed upload) ----------------------------------------------

export const signedUploadRequest = z.object({
  /** File extension without the dot, e.g. "jpg" | "png" | "webp". */
  file_ext: z.enum(['jpg', 'jpeg', 'png', 'webp']),
});
export type SignedUploadRequest = z.infer<typeof signedUploadRequest>;

export const signedUploadResponse = z.object({
  /** Short-lived signed URL the client PUTs the file to. */
  upload_url: z.string(),
  /** Token component some Supabase Storage SDKs require alongside the URL. */
  token: z.string(),
  /** The object path within the `goal-images` bucket to hand back to the server. */
  object_path: z.string(),
});
export type SignedUploadResponse = z.infer<typeof signedUploadResponse>;

export const setGoalImageRequest = z.object({
  object_path: z.string().min(1),
});
export type SetGoalImageRequest = z.infer<typeof setGoalImageRequest>;

// --- Template catalog --------------------------------------------------------

export const templateExercise = z.object({
  id: z.string(),
  exercise_name: z.string(),
  sets: z.number().int(),
  reps: z.string(),
  rest_seconds: z.number().int(),
  sort_order: z.number().int(),
});
export type TemplateExercise = z.infer<typeof templateExercise>;

export const templateWorkout = z.object({
  id: z.string(),
  name: z.string(),
  sort_order: z.number().int(),
  /** Day this Workout falls on for static templates; null for rotation. */
  day_of_week: dayOfWeek.nullable(),
  scheduled_time: z.string().nullable(),
  exercises: z.array(templateExercise),
});
export type TemplateWorkout = z.infer<typeof templateWorkout>;

export const templateSummary = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  type: programType,
  workouts: z.array(templateWorkout),
});
export type TemplateSummary = z.infer<typeof templateSummary>;

export const templateListResponse = z.array(templateSummary);
export type TemplateListResponse = z.infer<typeof templateListResponse>;

export const adoptTemplateRequest = z.object({
  template_id: z.string().min(1),
});
export type AdoptTemplateRequest = z.infer<typeof adoptTemplateRequest>;

// --- Active Program (editor) -------------------------------------------------

export const programExercise = z.object({
  id: z.string(),
  workout_id: z.string(),
  exercise_name: z.string(),
  sets: z.number().int(),
  reps: z.string(),
  rest_seconds: z.number().int(),
  sort_order: z.number().int(),
});
export type ProgramExercise = z.infer<typeof programExercise>;

export const programWorkout = z.object({
  id: z.string(),
  name: z.string(),
  /** Position in the rotation / display order. */
  sort_order: z.number().int(),
  /** Static: 1-7; rotation: null. */
  day_of_week: dayOfWeek.nullable(),
  scheduled_time: z.string().nullable(),
  exercises: z.array(programExercise),
});
export type ProgramWorkout = z.infer<typeof programWorkout>;

export const programDetail = z.object({
  id: z.string(),
  name: z.string(),
  type: programType,
  /** Present only for rotation programs. */
  rotation_current_index: z.number().int().nullable(),
  workouts: z.array(programWorkout),
});
export type ProgramDetail = z.infer<typeof programDetail>;

// --- Program-configuration intents -------------------------------------------
// The web sends intent; it never writes raw day_of_week / sort_order /
// rotation_state. The server derives and enforces every stored column.

export const addWorkoutRequest = z.object({
  name: z.string().trim().min(1).max(80),
});
export type AddWorkoutRequest = z.infer<typeof addWorkoutRequest>;

export const renameWorkoutRequest = z.object({
  workout_id: z.string().min(1),
  name: z.string().trim().min(1).max(80),
});
export type RenameWorkoutRequest = z.infer<typeof renameWorkoutRequest>;

export const removeWorkoutRequest = z.object({
  workout_id: z.string().min(1),
});
export type RemoveWorkoutRequest = z.infer<typeof removeWorkoutRequest>;

/** The full set of the active Program's workout ids in their new order. */
export const reorderWorkoutsRequest = z.object({
  workout_ids: z.array(z.string().min(1)).min(1),
});
export type ReorderWorkoutsRequest = z.infer<typeof reorderWorkoutsRequest>;

export const addExerciseRequest = z.object({
  workout_id: z.string().min(1),
  exercise_name: z.string().trim().min(1).max(120),
  sets,
  reps,
  rest_seconds: restSeconds.optional(),
});
export type AddExerciseRequest = z.infer<typeof addExerciseRequest>;

export const updateExerciseRequest = z.object({
  exercise_id: z.string().min(1),
  exercise_name: z.string().trim().min(1).max(120).optional(),
  sets: sets.optional(),
  reps: reps.optional(),
  rest_seconds: restSeconds.optional(),
});
export type UpdateExerciseRequest = z.infer<typeof updateExerciseRequest>;

export const removeExerciseRequest = z.object({
  exercise_id: z.string().min(1),
});
export type RemoveExerciseRequest = z.infer<typeof removeExerciseRequest>;

/** Reorder the exercises within one Workout (full ordered id list). */
export const reorderExercisesRequest = z.object({
  workout_id: z.string().min(1),
  exercise_ids: z.array(z.string().min(1)).min(1),
});
export type ReorderExercisesRequest = z.infer<typeof reorderExercisesRequest>;

/**
 * Set the schedule as intent. For a `static` program each entry carries a
 * `day_of_week` (+ optional time); for `rotation` the array order defines the
 * cycle and only `scheduled_time` is meaningful. The server derives the stored
 * `day_of_week` / `sort_order` columns from this.
 */
export const setScheduleRequest = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('static'),
    entries: z
      .array(
        z.object({
          workout_id: z.string().min(1),
          day_of_week: dayOfWeek,
          scheduled_time: scheduledTime.nullish(),
        }),
      )
      .min(1),
  }),
  z.object({
    type: z.literal('rotation'),
    /** Ordered workout ids defining the rotation cycle. */
    entries: z
      .array(
        z.object({
          workout_id: z.string().min(1),
          scheduled_time: scheduledTime.nullish(),
        }),
      )
      .min(1),
  }),
]);
export type SetScheduleRequest = z.infer<typeof setScheduleRequest>;

/**
 * Switch the active Program's scheduling type. Switching to `rotation` needs no
 * extra data (the server nulls days, assigns contiguous order, seeds
 * rotation_state@0). Switching to `static` requires a `day_of_week` per Workout.
 */
export const switchProgramTypeRequest = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('rotation'),
  }),
  z.object({
    type: z.literal('static'),
    days: z
      .array(
        z.object({
          workout_id: z.string().min(1),
          day_of_week: dayOfWeek,
          scheduled_time: scheduledTime.nullish(),
        }),
      )
      .min(1),
  }),
]);
export type SwitchProgramTypeRequest = z.infer<typeof switchProgramTypeRequest>;
