import {
  type JobContext,
  ServerOptions,
  cli,
  defineAgent,
  inference,
  voice,
} from '@livekit/agents';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

class GymBuddy extends voice.Agent {
  constructor() {
    super({
      instructions:
        'You are a gym buddy. You are a strict but supportive training partner. Keep responses short and conversational — the user is mid-workout.',
    });
  }
}

export default defineAgent({
  entry: async (ctx: JobContext) => {
    const session = new voice.AgentSession({
      stt: new inference.STT({ model: 'cartesia/ink-whisper' }),
      llm: new inference.LLM({ model: 'openai/gpt-4o' }),
      tts: new inference.TTS({ model: 'cartesia/sonic-3' }),
    });

    await ctx.connect();
    await ctx.waitForParticipant();

    await session.start({
      agent: new GymBuddy(),
      room: ctx.room,
    });

    session.generateReply({
      instructions: 'Greet the user and ask what workout they are doing today.',
    });
  },
});

cli.runApp(new ServerOptions({ agent: fileURLToPath(import.meta.url), agentName: 'gym-buddy' }));
