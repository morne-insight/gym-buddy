import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { AccessToken } from 'livekit-server-sdk';
import { RoomAgentDispatch, RoomConfiguration } from '@livekit/protocol';
import type { StartWorkoutCredentialsResponse } from '@gym-buddy/contracts';

const PORT = 3001;
const DEV_USER_ID = 'user-founder';

function parseBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

export interface StartWorkoutCredentialInput {
  userId: string;
  participantName?: string;
}

export async function buildStartWorkoutCredentials(
  input: StartWorkoutCredentialInput,
): Promise<StartWorkoutCredentialsResponse> {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const serverUrl = process.env.LIVEKIT_URL;

  if (!apiKey || !apiSecret || !serverUrl) {
    throw new Error('Server configuration error');
  }

  const agentName = process.env.LIVEKIT_AGENT_NAME ?? 'gym-buddy';
  const attemptNonce = randomUUID();
  const roomName = `workout-${input.userId}-${attemptNonce}`;
  const attemptId = roomName;
  const participantIdentity = `user-${input.userId}-${attemptNonce}`;
  const metadata = JSON.stringify({
    userId: input.userId,
    attemptId,
    roomName,
  });

  const at = new AccessToken(apiKey, apiSecret, {
    identity: participantIdentity,
    name: input.participantName ?? 'User',
    metadata,
    attributes: {
      userId: input.userId,
      attemptId,
      roomName,
    },
    ttl: '10m',
  });

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
  });

  at.roomConfig = new RoomConfiguration({
    agents: [new RoomAgentDispatch({ agentName, metadata })],
  });

  console.log('[start-workout] minted credentials', {
    userId: input.userId,
    attemptId,
    roomName,
    participantIdentity,
    agentName,
  });

  return {
    server_url: serverUrl,
    participant_token: await at.toJwt(),
    room_name: roomName,
    participant_identity: participantIdentity,
    attempt_id: attemptId,
    agent_name: agentName,
  };
}

export function startTokenServer() {
  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method !== 'POST' || req.url !== '/getToken') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }

    try {
      const body = await parseBody(req);
      console.log('Token request body:', JSON.stringify(body, null, 2));

      const credentials = await buildStartWorkoutCredentials({
        userId: DEV_USER_ID,
        participantName: (body.participant_name as string) || 'User',
      });

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(credentials));
    } catch (err) {
      console.error('Token generation error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to generate token' }));
    }
  });

  server.listen(PORT, () => {
    console.log(`Token server listening on http://0.0.0.0:${PORT}/getToken`);
  });
}
