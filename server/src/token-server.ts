import http from 'node:http';
import { AccessToken } from 'livekit-server-sdk';
import { RoomAgentDispatch, RoomConfiguration } from '@livekit/protocol';

const PORT = 3001;

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

      const apiKey = process.env.LIVEKIT_API_KEY;
      const apiSecret = process.env.LIVEKIT_API_SECRET;
      const serverUrl = process.env.LIVEKIT_URL;

      if (!apiKey || !apiSecret || !serverUrl) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Server configuration error' }));
        return;
      }

      const roomName = (body.room_name as string) || `session-${Date.now()}`;
      const participantIdentity = (body.participant_identity as string) || `user-${Date.now()}`;
      const participantName = (body.participant_name as string) || 'User';

      const at = new AccessToken(apiKey, apiSecret, {
        identity: participantIdentity,
        name: participantName,
        metadata: (body.participant_metadata as string) || '',
        attributes: (body.participant_attributes as Record<string, string>) || {},
        ttl: '10m',
      });

      at.addGrant({
        roomJoin: true,
        room: roomName,
        canPublish: true,
        canSubscribe: true,
      });

      const rawConfig = body.room_config as Record<string, unknown> | undefined;
      const rawAgents = (rawConfig?.agents as Array<Record<string, string>>) ?? [];
      const agents = rawAgents.map(
        (a) => new RoomAgentDispatch({ agentName: a.agent_name ?? a.agentName }),
      );

      at.roomConfig = new RoomConfiguration({
        agents: agents.length > 0 ? agents : [new RoomAgentDispatch({ agentName: 'gym-buddy' })],
      });

      const participantToken = await at.toJwt();

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ server_url: serverUrl, participant_token: participantToken }));
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
