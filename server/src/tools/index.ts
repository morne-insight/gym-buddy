import type Database from 'better-sqlite3';
import { llm } from '@livekit/agents';
import { z } from 'zod';
import { getCurrentWorkout } from './getCurrentWorkout.js';
import { logSetCompleted } from './logSetCompleted.js';
import { completeExercise } from './completeExercise.js';
import { getExerciseHistoryTool } from './getExerciseHistory.js';
import { getExerciseInfo, type ExerciseInfoFetcher } from './getExerciseInfo.js';
import { sendTelegramMedia, type TelegramSender } from './sendTelegramMedia.js';
import { scheduleMotivationalMessage } from './scheduleMotivationalMessage.js';
import { updateSentiment } from './updateSentiment.js';
import { type DataPublisher, publishDataMessage } from '../publish-data.js';
import { type DataMessage } from '../data-messages.js';
import { getExercisesForWorkout, type WorkoutExercise } from '../db/index.js';

export interface AgentToolsOptions {
  db: Database.Database;
  exerciseInfoFetcher: ExerciseInfoFetcher;
  telegramSender: TelegramSender;
  dataPublisher?: DataPublisher;
  onRestTimerStart?: (exerciseId: string, durationSeconds: number) => void;
}

export function createAgentTools(
  db: Database.Database,
  exerciseInfoFetcher: ExerciseInfoFetcher,
  telegramSender: TelegramSender,
  dataPublisher?: DataPublisher,
  onRestTimerStart?: (exerciseId: string, durationSeconds: number) => void,
) {
  return {
    getCurrentWorkout: llm.tool({
      description: 'Get the workout scheduled for today. Call this when the user starts a session.',
      parameters: z.object({
        userId: z.string().describe('The user ID'),
      }),
      execute: async ({ userId }) => {
        return getCurrentWorkout(db, userId);
      },
    }),

    logSetCompleted: llm.tool({
      description: 'Log a single completed set. Call after the user confirms reps and weight for one set.',
      parameters: z.object({
        sessionId: z.string().optional().describe('Current session ID'),
        userId: z.string().optional().describe('User ID (used to auto-create session if needed)'),
        exerciseId: z.string().describe('The workout exercise ID'),
        setNumber: z.number().describe('Which set this is (1-based)'),
        reps: z.number().describe('Number of reps completed'),
        weight: z.number().optional().describe('Weight used in kg'),
      }),
      execute: async (params) => {
        const result = logSetCompleted(db, params);

        if (result.logged && dataPublisher) {
          // Clear any active rest timer first (user started next set early)
          await publishDataMessage(dataPublisher, {
            type: 'rest_timer',
            payload: { action: 'end', durationSeconds: 0 },
          });

          const exercise = db
            .prepare('SELECT * FROM workout_exercises WHERE id = ?')
            .get(params.exerciseId) as WorkoutExercise | undefined;

          if (exercise) {
            const exercises = getExercisesForWorkout(db, exercise.workout_id);
            const exerciseIndex = exercises.findIndex((e) => e.id === params.exerciseId);

            await publishDataMessage(dataPublisher, {
              type: 'exercise_progress',
              payload: {
                exerciseName: exercise.exercise_name,
                targetSets: exercise.sets,
                targetReps: exercise.reps,
                targetWeight: params.weight ?? null,
                completedSets: params.setNumber,
                currentSetNumber: params.setNumber + 1,
                exerciseIndex,
                totalExercises: exercises.length,
              },
            });

            if (!result.exerciseComplete) {
              await publishDataMessage(dataPublisher, {
                type: 'rest_timer',
                payload: { action: 'start', durationSeconds: exercise.rest_seconds },
              });
              onRestTimerStart?.(params.exerciseId, exercise.rest_seconds);
              return {
                ...result,
                restStarted: true,
                restSeconds: exercise.rest_seconds,
                instruction: `Rest timer started (${exercise.rest_seconds}s). Announce the rest duration only, then STOP. You will be prompted when rest ends.`,
              };
            }
          }
        }

        return result;
      },
    }),

    completeExercise: llm.tool({
      description: 'Mark an exercise as complete (after all sets logged) or skipped. Call to advance to next exercise.',
      parameters: z.object({
        sessionId: z.string().optional().describe('Current session ID'),
        userId: z.string().optional().describe('User ID'),
        exerciseId: z.string().describe('The workout exercise ID'),
        skipped: z.boolean().optional().describe('Whether the exercise was skipped entirely'),
      }),
      execute: async (params) => {
        const result = completeExercise(db, params);

        if (result.completed || result.skipped) {
          if (dataPublisher && !result.workoutComplete) {
            const exercise = db
              .prepare('SELECT * FROM workout_exercises WHERE id = ?')
              .get(params.exerciseId) as WorkoutExercise | undefined;

            if (exercise) {
              const exercises = getExercisesForWorkout(db, exercise.workout_id);
              const currentIndex = exercises.findIndex((e) => e.id === params.exerciseId);
              const nextExercise = exercises[currentIndex + 1];

              if (nextExercise) {
                await publishDataMessage(dataPublisher, {
                  type: 'exercise_progress',
                  payload: {
                    exerciseName: nextExercise.exercise_name,
                    targetSets: nextExercise.sets,
                    targetReps: nextExercise.reps,
                    targetWeight: null,
                    completedSets: 0,
                    currentSetNumber: 1,
                    exerciseIndex: currentIndex + 1,
                    totalExercises: exercises.length,
                  },
                });

                if (nextExercise.exercise_db_id) {
                  await publishDataMessage(dataPublisher, {
                    type: 'exercise_media',
                    payload: {
                      gifUrl: nextExercise.exercise_db_id,
                      exerciseName: nextExercise.exercise_name,
                    },
                  });
                }
              }
            }
          }
        }

        return result;
      },
    }),

    getExerciseHistory: llm.tool({
      description:
        'Get history for a specific exercise. Use to reference past performance or call out skipping patterns.',
      parameters: z.object({
        userId: z.string().describe('The user ID'),
        exerciseName: z.string().describe('Name of the exercise'),
      }),
      execute: async ({ userId, exerciseName }) => {
        return getExerciseHistoryTool(db, userId, exerciseName);
      },
    }),

    getExerciseInfo: llm.tool({
      description:
        'Look up exercise form and instructions. Use when the user asks how to do an exercise or seems unsure about form.',
      parameters: z.object({
        exerciseName: z.string().describe('Name of the exercise to look up'),
      }),
      execute: async ({ exerciseName }, { ctx }) => {
        const filler = ctx.session.say('Let me look that up.', { addToChatCtx: false });
        const result = await getExerciseInfo(exerciseName, exerciseInfoFetcher);
        if (!filler.done()) filler.interrupt();
        return result;
      },
    }),

    sendTelegramMedia: llm.tool({
      description:
        'Send an image or GIF to the user on Telegram. Use to share exercise form references during a voice session.',
      parameters: z.object({
        userId: z.string().describe('The user ID'),
        imageUrl: z.string().describe('URL of the image or GIF to send'),
        caption: z.string().optional().describe('Caption for the media'),
      }),
      execute: async (params, { ctx }) => {
        const filler = ctx.session.say('Sending that to your phone now.', { addToChatCtx: false });
        const result = await sendTelegramMedia(db, params, telegramSender);
        if (!filler.done()) filler.interrupt();
        return result;
      },
    }),

    scheduleMotivationalMessage: llm.tool({
      description:
        'Schedule a motivational message for later. Use when the user is struggling emotionally or expressing doubt.',
      parameters: z.object({
        userId: z.string().describe('The user ID'),
        deliverInHours: z
          .number()
          .describe('Hours from now to deliver the message (1-24)'),
        context: z
          .string()
          .describe('What the user was struggling with, so the message can reference it'),
      }),
      execute: async (params) => {
        return scheduleMotivationalMessage(db, params);
      },
    }),

    updateSentiment: llm.tool({
      description:
        'Record the user\'s detected emotional state during the session. Call when you notice a shift in mood — frustration, excitement, fatigue, motivation, doubt.',
      parameters: z.object({
        sessionId: z.string().optional().describe('Current session ID'),
        userId: z.string().optional().describe('User ID (to find active session)'),
        sentiment: z
          .string()
          .describe('Detected sentiment, e.g. "frustrated", "motivated", "tired", "energized", "doubtful"'),
      }),
      execute: async (params) => {
        return updateSentiment(db, params);
      },
    }),
  };
}
