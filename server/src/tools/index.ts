import type Database from 'better-sqlite3';
import { llm } from '@livekit/agents';
import { z } from 'zod';
import { getCurrentWorkout } from './getCurrentWorkout.js';
import { logExerciseCompleted } from './logExerciseCompleted.js';
import { getExerciseHistoryTool } from './getExerciseHistory.js';
import { getExerciseInfo, type ExerciseInfoFetcher } from './getExerciseInfo.js';
import { sendTelegramMedia, type TelegramSender } from './sendTelegramMedia.js';
import { scheduleMotivationalMessage } from './scheduleMotivationalMessage.js';

export function createAgentTools(
  db: Database.Database,
  exerciseInfoFetcher: ExerciseInfoFetcher,
  telegramSender: TelegramSender,
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

    logExerciseCompleted: llm.tool({
      description: 'Log that the user completed or skipped an exercise. Call after they confirm.',
      parameters: z.object({
        sessionId: z.string().optional().describe('Current session ID'),
        userId: z.string().optional().describe('User ID (used to auto-create session if needed)'),
        exerciseId: z.string().describe('The workout exercise ID'),
        actualSets: z.number().optional().describe('Number of sets actually completed'),
        actualReps: z.string().optional().describe('Reps per set, e.g. "8,8,7,6"'),
        actualWeight: z.number().optional().describe('Weight used in kg'),
        skipped: z.boolean().describe('Whether the exercise was skipped'),
        notes: z.string().optional().describe('Any notes about the exercise'),
      }),
      execute: async (params) => {
        return logExerciseCompleted(db, params);
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
      execute: async ({ exerciseName }) => {
        return getExerciseInfo(exerciseName, exerciseInfoFetcher);
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
      execute: async (params) => {
        return sendTelegramMedia(db, params, telegramSender);
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
  };
}
