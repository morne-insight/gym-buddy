import {
  type JobContext,
  ServerOptions,
  cli,
  defineAgent,
  inference,
  voice,
} from '@livekit/agents';
import * as silero from '@livekit/agents-plugin-silero';
import * as livekit from '@livekit/agents-plugin-livekit';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

import { startTokenServer } from './token-server.js';
import { createDatabase, createSession, completeSession, getActiveSession } from './db/index.js';
import { createAgentTools } from './tools/index.js';
import { buildSystemPrompt } from './prompts/index.js';
import { getCurrentWorkout } from './tools/getCurrentWorkout.js';
import type { ExerciseInfoFetcher } from './tools/getExerciseInfo.js';
import type { TelegramSender } from './tools/sendTelegramMedia.js';

dotenv.config();

if (typeof process.send !== 'function') {
  startTokenServer();
}

const USER_ID = 'user-founder';

const exerciseInfoFetcher: ExerciseInfoFetcher = async () => null;

const telegramSender: TelegramSender = async (chatId, imageUrl, caption) => {
  console.log(`[Telegram] Would send to ${chatId}: ${imageUrl} — ${caption}`);
};

export default defineAgent({
  entry: async (ctx: JobContext) => {
    const db = createDatabase();
    const tools = createAgentTools(db, exerciseInfoFetcher, telegramSender);
    const { prompt } = buildSystemPrompt(db, USER_ID);

    const workout = getCurrentWorkout(db, USER_ID);

    const dbSession = createSession(db, USER_ID, null);

    const sessionContext = workout.restDay
      ? `Today is a rest day. The user's active session ID is ${dbSession.id}.`
      : `Today's workout: ${workout.workoutName}. Session ID: ${dbSession.id}. Exercises: ${workout.exercises.map((e) => `${e.name} (ID: ${e.id}, ${e.sets}x${e.reps})`).join(', ')}.`;

    const fullPrompt = `${prompt}\n\nSESSION CONTEXT:\n${sessionContext}`;

    const session = new voice.AgentSession({
      vad: await silero.VAD.load(),
      turnHandling: {
        turnDetection: new livekit.turnDetector.MultilingualModel(),
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
      const active = getActiveSession(db, USER_ID);
      if (active) {
        completeSession(db, active.id);
      }
      db.close();
    });

    await ctx.connect();
    await ctx.waitForParticipant();

    const agent = new voice.Agent({
      instructions: fullPrompt,
      tools,
    });

    await session.start({
      agent,
      room: ctx.room,
    });

    const greeting = workout.restDay
      ? 'Greet the user. Tell them today is a rest day. Ask how they are recovering.'
      : `Greet the user. Tell them today is ${workout.workoutName}. Ask if they are ready to get started.`;

    session.generateReply({ instructions: greeting });
  },
});

cli.runApp(new ServerOptions({ agent: fileURLToPath(import.meta.url), agentName: 'gym-buddy' }));
