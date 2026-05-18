import { defineAgent, cli, WorkerOptions } from '@livekit/agents';
import { voice } from '@livekit/agents';
import * as inference from '@livekit/agents';
import * as silero from '@livekit/agents-plugin-silero';
import * as livekit from '@livekit/agents-plugin-livekit';
import 'dotenv/config';

export default defineAgent({
  prewarm: async (proc) => {
    proc.userData.vad = await silero.VAD.load();
  },
  entry: async (ctx) => {
    await ctx.connect();
    const participant = await ctx.waitForParticipant();

    const session = new voice.AgentSession({
      vad: ctx.proc.userData.vad,
      turnHandling: {
        turnDetection: new livekit.turnDetector.MultilingualModel(),
      },
      stt: new inference.STT({ model: 'cartesia/ink-whisper' }),
      llm: new inference.LLM({ model: 'openai/gpt-4o' }),
      tts: new inference.TTS({ model: 'cartesia/sonic-3' }),
    });

    await session.start({
      agent: {
        instructions:
          'You are a gym buddy. You are a strict but supportive training partner. Keep responses short and conversational — the user is mid-workout.',
      },
      room: ctx.room,
      participant,
    });
  },
});

cli.runApp(new WorkerOptions({ agent: import.meta.filename }));
