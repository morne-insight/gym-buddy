import http from 'node:http';
import type { ZodType } from 'zod';
import {
  updateProfileRequest,
  signedUploadRequest,
  setGoalImageRequest,
  adoptTemplateRequest,
  addWorkoutRequest,
  renameWorkoutRequest,
  removeWorkoutRequest,
  reorderWorkoutsRequest,
  addExerciseRequest,
  updateExerciseRequest,
  removeExerciseRequest,
  reorderExercisesRequest,
  setScheduleRequest,
  switchProgramTypeRequest,
} from '@gym-buddy/contracts';
import {
  createDatabase,
  provisionUser,
  getUser,
  getActiveProgram,
  listPersonas,
  personaExists,
  updateUserProfile,
  setGoalImageUrl,
  listTemplates,
  adoptTemplate,
  getActiveProgramDetail,
  addWorkout,
  renameWorkout,
  removeWorkout,
  reorderWorkouts,
  addExercise,
  updateExercise,
  removeExercise,
  reorderExercises,
  setSchedule,
  switchProgramType,
  NotFoundError,
  DomainValidationError,
  type DB,
  type User,
} from '../db/index.js';
import {
  verifyAccessToken,
  extractBearerToken,
  getAuthConfigFromEnv,
  getRemoteKeySet,
  UnauthorizedError,
  type AuthConfig,
} from './auth.js';
import { createGoalImageUploadUrl, objectPathBelongsToUser } from './storage.js';

const PORT = Number(process.env.API_PORT ?? 3002);
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:5173';

interface RequestContext {
  db: DB;
  userId: string;
  body: unknown;
}

type Handler = (ctx: RequestContext) => Promise<{ status?: number; body: unknown }>;

interface RouteDef {
  schema?: ZodType;
  handler: Handler;
}

function toProfileResponse(user: User) {
  return {
    id: user.id,
    name: user.name,
    persona_id: user.persona_id,
    goal_description: user.goal_description,
    goal_image_url: user.goal_image_url,
    training_style: user.training_style,
  };
}

/** Returns the caller's active program detail, or null when none exists. */
async function activeProgramOrNull(db: DB, userId: string) {
  return (await getActiveProgramDetail(db, userId)) ?? null;
}

const routes: Record<string, RouteDef> = {
  'GET /api/me': {
    handler: async ({ db, userId }) => {
      const user = await getUser(db, userId);
      const program = await getActiveProgram(db, userId);
      const onboarded = Boolean(user && user.name.trim() !== '' && program);
      return { body: { id: userId, onboarded } };
    },
  },

  'GET /api/personas': {
    handler: async ({ db }) => {
      const personas = await listPersonas(db);
      return {
        body: personas.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          example_greeting: p.example_greeting,
        })),
      };
    },
  },

  'GET /api/profile': {
    handler: async ({ db, userId }) => {
      const user = await getUser(db, userId);
      if (!user) throw new NotFoundError('User not found');
      return { body: toProfileResponse(user) };
    },
  },

  'PUT /api/profile': {
    schema: updateProfileRequest,
    handler: async ({ db, userId, body }) => {
      const input = body as import('@gym-buddy/contracts').UpdateProfileRequest;
      if (!(await personaExists(db, input.persona_id))) {
        throw new DomainValidationError('Unknown persona_id');
      }
      const user = await updateUserProfile(db, userId, {
        name: input.name,
        persona_id: input.persona_id,
        goal_description: input.goal_description ?? null,
        training_style: input.training_style,
      });
      return { body: toProfileResponse(user) };
    },
  },

  'POST /api/profile/goal-image/upload-url': {
    schema: signedUploadRequest,
    handler: async ({ userId, body }) => {
      const input = body as import('@gym-buddy/contracts').SignedUploadRequest;
      const signed = await createGoalImageUploadUrl(userId, input.file_ext);
      return { body: signed };
    },
  },

  'POST /api/profile/goal-image': {
    schema: setGoalImageRequest,
    handler: async ({ db, userId, body }) => {
      const input = body as import('@gym-buddy/contracts').SetGoalImageRequest;
      if (!objectPathBelongsToUser(input.object_path, userId)) {
        throw new DomainValidationError('object_path does not belong to the caller');
      }
      const user = await setGoalImageUrl(db, userId, input.object_path);
      return { body: toProfileResponse(user) };
    },
  },

  'GET /api/templates': {
    handler: async ({ db }) => ({ body: await listTemplates(db) }),
  },

  'GET /api/program': {
    handler: async ({ db, userId }) => ({ body: await activeProgramOrNull(db, userId) }),
  },

  'POST /api/program/adopt': {
    schema: adoptTemplateRequest,
    handler: async ({ db, userId, body }) => {
      const input = body as import('@gym-buddy/contracts').AdoptTemplateRequest;
      const program = await adoptTemplate(db, userId, input.template_id);
      return { status: 201, body: program };
    },
  },

  'POST /api/program/workouts': {
    schema: addWorkoutRequest,
    handler: async ({ db, userId, body }) => {
      const input = body as import('@gym-buddy/contracts').AddWorkoutRequest;
      await addWorkout(db, userId, input.name);
      return { status: 201, body: await activeProgramOrNull(db, userId) };
    },
  },

  'POST /api/program/workouts/rename': {
    schema: renameWorkoutRequest,
    handler: async ({ db, userId, body }) => {
      const input = body as import('@gym-buddy/contracts').RenameWorkoutRequest;
      await renameWorkout(db, userId, input.workout_id, input.name);
      return { body: await activeProgramOrNull(db, userId) };
    },
  },

  'POST /api/program/workouts/remove': {
    schema: removeWorkoutRequest,
    handler: async ({ db, userId, body }) => {
      const input = body as import('@gym-buddy/contracts').RemoveWorkoutRequest;
      await removeWorkout(db, userId, input.workout_id);
      return { body: await activeProgramOrNull(db, userId) };
    },
  },

  'POST /api/program/workouts/reorder': {
    schema: reorderWorkoutsRequest,
    handler: async ({ db, userId, body }) => {
      const input = body as import('@gym-buddy/contracts').ReorderWorkoutsRequest;
      await reorderWorkouts(db, userId, input.workout_ids);
      return { body: await activeProgramOrNull(db, userId) };
    },
  },

  'POST /api/program/exercises': {
    schema: addExerciseRequest,
    handler: async ({ db, userId, body }) => {
      const input = body as import('@gym-buddy/contracts').AddExerciseRequest;
      await addExercise(db, userId, input);
      return { status: 201, body: await activeProgramOrNull(db, userId) };
    },
  },

  'POST /api/program/exercises/update': {
    schema: updateExerciseRequest,
    handler: async ({ db, userId, body }) => {
      const input = body as import('@gym-buddy/contracts').UpdateExerciseRequest;
      await updateExercise(db, userId, input);
      return { body: await activeProgramOrNull(db, userId) };
    },
  },

  'POST /api/program/exercises/remove': {
    schema: removeExerciseRequest,
    handler: async ({ db, userId, body }) => {
      const input = body as import('@gym-buddy/contracts').RemoveExerciseRequest;
      await removeExercise(db, userId, input.exercise_id);
      return { body: await activeProgramOrNull(db, userId) };
    },
  },

  'POST /api/program/exercises/reorder': {
    schema: reorderExercisesRequest,
    handler: async ({ db, userId, body }) => {
      const input = body as import('@gym-buddy/contracts').ReorderExercisesRequest;
      await reorderExercises(db, userId, input.workout_id, input.exercise_ids);
      return { body: await activeProgramOrNull(db, userId) };
    },
  },

  'POST /api/program/schedule': {
    schema: setScheduleRequest,
    handler: async ({ db, userId, body }) => {
      const input = body as import('@gym-buddy/contracts').SetScheduleRequest;
      await setSchedule(db, userId, input);
      return { body: await activeProgramOrNull(db, userId) };
    },
  },

  'POST /api/program/type': {
    schema: switchProgramTypeRequest,
    handler: async ({ db, userId, body }) => {
      const input = body as import('@gym-buddy/contracts').SwitchProgramTypeRequest;
      await switchProgramType(
        db,
        userId,
        input.type,
        input.type === 'static' ? input.days : undefined,
      );
      return { body: await activeProgramOrNull(db, userId) };
    },
  },
};

function send(res: http.ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      if (chunks.length === 0) return resolve(undefined);
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString()));
      } catch {
        reject(new DomainValidationError('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * The authenticated REST API consumed by the web client. Lives alongside the
 * LiveKit token server. Every data route is JWKS-verified, identity-provisioned,
 * Zod-validated, and CORS-locked to the web origin.
 */
export function startApiServer(): void {
  const db = createDatabase();
  const authConfig: AuthConfig | null = getAuthConfigFromEnv();
  if (!authConfig) {
    console.warn(
      '[api] SUPABASE_URL / SUPABASE_PROJECT_REF not set — authenticated routes will reject all requests with 401.',
    );
  }

  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', WEB_ORIGIN);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const path = (req.url ?? '').split('?')[0];
    const route = routes[`${req.method} ${path}`];
    if (!route) return send(res, 404, { error: 'Not found' });

    // --- Auth: verify the token BEFORE any DB access (spec). ---
    try {
      if (!authConfig) throw new UnauthorizedError('Auth not configured');
      const token = extractBearerToken(req.headers['authorization']);
      if (!token) throw new UnauthorizedError('Missing bearer token');
      const userId = await verifyAccessToken(token, getRemoteKeySet(authConfig.jwksUrl), {
        issuer: authConfig.issuer,
        audience: authConfig.audience,
      });

      // Provision the domain user on first authenticated request (idempotent).
      await provisionUser(db, userId);

      // --- Validate the body against the endpoint contract. ---
      let body: unknown;
      if (req.method === 'POST' || req.method === 'PUT') {
        const raw = await readJsonBody(req);
        if (route.schema) {
          const parsed = route.schema.safeParse(raw);
          if (!parsed.success) {
            return send(res, 400, { error: 'Invalid request body', details: parsed.error.issues });
          }
          body = parsed.data;
        } else {
          body = raw;
        }
      }

      const result = await route.handler({ db, userId, body });
      return send(res, result.status ?? 200, result.body);
    } catch (err) {
      if (err instanceof UnauthorizedError) return send(res, 401, { error: err.message });
      if (err instanceof NotFoundError) return send(res, 404, { error: err.message });
      if (err instanceof DomainValidationError) return send(res, 400, { error: err.message });
      console.error('[api] Unhandled error:', err);
      return send(res, 500, { error: 'Internal server error' });
    }
  });

  server.listen(PORT, () => {
    console.log(`API server listening on http://0.0.0.0:${PORT} (web origin: ${WEB_ORIGIN})`);
  });
}
