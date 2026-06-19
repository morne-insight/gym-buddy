import {
  type JobContext,
  ServerOptions,
  cli,
  defineAgent,
  inference,
  voice,
} from '@livekit/agents';
import * as silero from '@livekit/agents-plugin-silero';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

import { startTokenServer } from './token-server.js';
import { startApiServer } from './api/server.js';
import {
  createDatabase,
  runMigrations,
  createSession,
  completeSession,
  getActiveSession,
  getWorkoutExerciseById,
  closePool,
} from './db/index.js';
import { createAgentTools } from './tools/index.js';
import { buildSystemPrompt } from './prompts/index.js';
import { getCurrentWorkout } from './tools/getCurrentWorkout.js';
import type { ExerciseInfoFetcher } from './tools/getExerciseInfo.js';
import { createTelegramBot } from './telegram/bot.js';
import { createTelegramSender } from './telegram/sender.js';
import { createMessageHandler } from './telegram/chat.js';
import { sendTextMessage } from './telegram/sender.js';
import { startCronJobs } from './cron/index.js';
import type { TelegramSender } from './tools/sendTelegramMedia.js';
import { publishDataMessage } from './publish-data.js';

dotenv.config();

const mainDb = createDatabase();
let telegramSender: TelegramSender = async (chatId, imageUrl, caption) => {
  console.log(`[Telegram stub] Would send to ${chatId}: ${imageUrl} — ${caption}`);
};

if (typeof process.send !== 'function') {
  // Main (non-job) process: ensure the schema exists, then start the bot/cron.
  // Safety net: a transient network error (e.g. a Telegram ECONNRESET in the
  // bot polling loop or a cron tick) must not take down the agent server. Log
  // and keep running. Scoped to the main process so LiveKit's per-job runners
  // keep their own error handling.
  process.on('unhandledRejection', (reason) => {
    console.error('[unhandledRejection]', reason);
  });
  process.on('uncaughtException', (err) => {
    console.error('[uncaughtException]', err);
  });

  await runMigrations(mainDb);
  startTokenServer();
  startApiServer();

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (botToken && botToken !== 'your-telegram-bot-token') {
    const chatCompletion = async (system: string, messages: Array<{ role: string; content: string }>) => {
      const { default: OpenAI } = await import('openai');
      const openai = new OpenAI();
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: system },
          ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        ],
      });
      return response.choices[0]?.message?.content ?? '';
    };

    const messageHandler = createMessageHandler(mainDb, chatCompletion);

    const bot = createTelegramBot({
      token: botToken,
      db: mainDb,
      onUserMessage: async (userId, text) => messageHandler(userId, text),
    });

    telegramSender = createTelegramSender(bot);
    console.log('Telegram bot started');

    startCronJobs({
      db: mainDb,
      sendText: (chatId, text) => sendTextMessage(bot, chatId, text),
      sendMedia: telegramSender,
    });
  }
}

const USER_ID = 'user-founder';

const exerciseInfoFetcher: ExerciseInfoFetcher = async () => null;

export default defineAgent({
  entry: async (ctx: JobContext) => {
    const db = createDatabase();

    await ctx.connect();

    const localParticipant = ctx.room.localParticipant;
    const dataPublisher = {
      publishData: async (data: Uint8Array, options: { reliable: boolean }) => {
        await localParticipant?.publishData(data, { reliable: options.reliable });
      },
    };

    let restTimer: ReturnType<typeof setTimeout> | null = null;

    const onRestTimerStart = (_exerciseId: string, durationSeconds: number) => {
      if (restTimer) clearTimeout(restTimer);
      restTimer = setTimeout(async () => {
        await publishDataMessage(dataPublisher, {
          type: 'rest_timer',
          payload: { action: 'end', durationSeconds },
        });
        session.generateReply({
          instructions: 'Rest is over. Announce it and prompt the user for their next set.',
        });
      }, durationSeconds * 1000);
    };

    const tools = createAgentTools(db, exerciseInfoFetcher, telegramSender, dataPublisher, onRestTimerStart);
    const { prompt } = await buildSystemPrompt(db, USER_ID);

    const workout = await getCurrentWorkout(db, USER_ID);

    const dbSession = await createSession(db, USER_ID, workout.scheduleId);

    const sessionContext = workout.restDay
      ? `Today is a rest day. The user's active session ID is ${dbSession.id}.`
      : `Today's workout: ${workout.workoutName}. Session ID: ${dbSession.id}. Exercises: ${workout.exercises.map((e) => `${e.name} (ID: ${e.id}, ${e.sets}x${e.reps})`).join(', ')}.`;

    const fullPrompt = `${prompt}\n\nSESSION CONTEXT:\n${sessionContext}`;

    const session = new voice.AgentSession({
      vad: await silero.VAD.load(),
      turnHandling: {
        turnDetection: 'vad',
        endpointing: {
          minDelay: 500,
          maxDelay: 1500,
        },
      },
      stt: new inference.STT({ model: 'cartesia/ink-whisper' }),
      llm: new inference.LLM({ model: 'openai/gpt-4o' }),
      tts: new inference.TTS({ model: 'cartesia/sonic-3' }),
    });

    ctx.addShutdownCallback(async () => {
      if (restTimer) clearTimeout(restTimer);
      const active = await getActiveSession(db, USER_ID);
      if (active) {
        await completeSession(db, active.id);
      }
      await closePool();
    });

    ctx.room.on('participantDisconnected', (participant: { identity: string }) => {
      console.log(`[Session] Participant ${participant.identity} disconnected — waiting for reconnect`);
    });

    ctx.room.on('participantConnected', (participant: { identity: string }) => {
      console.log(`[Session] Participant ${participant.identity} reconnected`);
      session.generateReply({
        instructions: 'The user just reconnected after a network drop. Briefly acknowledge the interruption and remind them where you left off.',
      });
    });

    await ctx.waitForParticipant();

    const agent = new voice.Agent({
      instructions: fullPrompt,
      tools,
    });

    const backgroundAudio = new voice.BackgroundAudioPlayer({
      thinkingSound: {
        source: voice.BuiltinAudioClip.KEYBOARD_TYPING,
        volume: 0.5,
      },
    });

    await session.start({
      agent,
      room: ctx.room,
    });

    await backgroundAudio.start({ room: ctx.room, agentSession: session });

    const greeting = workout.restDay
      ? 'Greet the user. Tell them today is a rest day. Ask how they are recovering.'
      : `Greet the user. Tell them today is ${workout.workoutName}. Ask if they are ready to get started.`;

    session.generateReply({ instructions: greeting });

    if (!workout.restDay && workout.exercises.length > 0) {
      const firstExercise = workout.exercises[0];
      await publishDataMessage(dataPublisher, {
        type: 'exercise_progress',
        payload: {
          exerciseName: firstExercise.name,
          targetSets: firstExercise.sets,
          targetReps: firstExercise.reps,
          targetWeight: null,
          completedSets: 0,
          currentSetNumber: 1,
          exerciseIndex: 0,
          totalExercises: workout.exercises.length,
        },
      });

      const firstWe = await getWorkoutExerciseById(db, firstExercise.id);
      if (firstWe?.exercise_db_id) {
        await publishDataMessage(dataPublisher, {
          type: 'exercise_media',
          payload: {
            gifUrl: firstWe.exercise_db_id,
            exerciseName: firstExercise.name,
          },
        });
      }
    }
  },
});

cli.runApp(new ServerOptions({ agent: fileURLToPath(import.meta.url), agentName: 'gym-buddy' }));
