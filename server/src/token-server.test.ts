import { decodeJwt } from 'jose';
import { afterEach, describe, expect, it } from '@jest/globals';
import { buildStartWorkoutCredentials } from './token-server.js';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

function configureLiveKitEnv() {
  process.env.LIVEKIT_API_KEY = 'devkey';
  process.env.LIVEKIT_API_SECRET = 'devsecretdevsecretdevsecretdevsecret';
  process.env.LIVEKIT_URL = 'wss://livekit.example.test';
  process.env.LIVEKIT_AGENT_NAME = 'gym-buddy';
}

describe('buildStartWorkoutCredentials', () => {
  it('generates server-owned room, participant, attempt, and dispatch metadata', async () => {
    configureLiveKitEnv();

    const credentials = await buildStartWorkoutCredentials({ userId: 'auth-user-1' });

    expect(credentials.server_url).toBe('wss://livekit.example.test');
    expect(credentials.agent_name).toBe('gym-buddy');
    expect(credentials.attempt_id).toBe(credentials.room_name);
    expect(credentials.room_name).toMatch(/^workout-auth-user-1-[0-9a-f-]{36}$/);
    expect(credentials.participant_identity).toMatch(/^user-auth-user-1-[0-9a-f-]{36}$/);

    const jwt = decodeJwt(credentials.participant_token) as {
      metadata?: string;
      video?: { room?: string };
    };
    expect(jwt.video?.room).toBe(credentials.room_name);
    expect(JSON.parse(jwt.metadata ?? '{}')).toEqual({
      userId: 'auth-user-1',
      attemptId: credentials.attempt_id,
      roomName: credentials.room_name,
    });
  });

  it('rejects missing LiveKit configuration', async () => {
    delete process.env.LIVEKIT_API_KEY;
    delete process.env.LIVEKIT_API_SECRET;
    delete process.env.LIVEKIT_URL;

    await expect(buildStartWorkoutCredentials({ userId: 'auth-user-1' })).rejects.toThrow(
      'Server configuration error',
    );
  });
});
