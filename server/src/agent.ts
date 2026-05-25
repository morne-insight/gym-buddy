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
import { createDatabase, createSession, completeSession, getActiveSession } from './db/index.js';
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

dotenv.config();

const mainDb = createDatabase();
let telegramSender: TelegramSender = async (chatId, imageUrl, caption) => {
  console.log(`[Telegram stub] Would send to ${chatId}: ${imageUrl} — ${caption}`);
};

if (typeof process.send !== 'function') {
  startTokenServer();

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
      const active = getActiveSession(db, USER_ID);
      if (active) {
        completeSession(db, active.id);
      }
      db.close();
    });

    await ctx.connect();

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
  },
});

cli.runApp(new ServerOptions({ agent: fileURLToPath(import.meta.url), agentName: 'gym-buddy' }));
