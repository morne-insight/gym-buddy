import { Room } from 'livekit-client';
import type { StartWorkoutCredentialsResponse } from '@gym-buddy/contracts';
import { createContext, useCallback, useContext, useMemo, useReducer, useRef } from 'react';
import type { Dispatch, ReactNode } from 'react';
import { RoomContext } from '@livekit/components-react';
import { useDataChannel } from '@livekit/components-react';
import type { ReceivedDataMessage } from '@livekit/components-core';
import { AudioSession, AndroidAudioTypePresets } from '@livekit/react-native';
import { decodeDataMessage } from './useDataMessages';
import {
  connectionReducer,
  initialConnectionState,
  type ConnectionAction,
  type ConnectionState,
} from './connectionState';

// Override per-machine in apps/mobile/.env.local (EXPO_PUBLIC_TOKEN_ENDPOINT).
// Default assumes a USB device with `adb reverse tcp:3001 tcp:3001`, which
// tunnels the token fetch over USB — immune to Wi-Fi firewall blocks and DHCP
// IP changes (the same mechanism Metro's 8081 already uses). For a Wi-Fi device
// set the dev machine's LAN IP; for the Android emulator use http://10.0.2.2.
const TOKEN_ENDPOINT =
  process.env.EXPO_PUBLIC_TOKEN_ENDPOINT ?? 'http://localhost:3001/getToken';

const AGENT_NAME = 'gym-buddy';
const DEBUG_CONNECTION = process.env.EXPO_PUBLIC_DEBUG_CONNECTION === '1';

interface ConnectionContextType {
  connection: ConnectionState;
  isConnectionActive: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

const ConnectionContext = createContext<ConnectionContextType>({
  connection: initialConnectionState,
  isConnectionActive: false,
  connect: async () => {},
  disconnect: async () => {},
});

export function useConnection() {
  const ctx = useContext(ConnectionContext);
  if (!ctx) {
    throw new Error('useConnection must be used within a ConnectionProvider');
  }
  return ctx;
}

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [connection, dispatch] = useReducer(connectionReducer, initialConnectionState);
  const room = useMemo(() => new Room(), []);
  const connectionRef = useRef(connection);
  const connectRunRef = useRef(0);
  connectionRef.current = connection;

  const fetchCredentials = useCallback(
    async () => {
      const response = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        throw new Error(`Token request failed with ${response.status}`);
      }
      const credentials = (await response.json()) as StartWorkoutCredentialsResponse;
      if (DEBUG_CONNECTION) {
        console.log('[connection] credentials received', {
          attemptId: credentials.attempt_id,
          roomName: credentials.room_name,
          participantIdentity: credentials.participant_identity,
        });
      }
      dispatch({
        type: 'credentials_received',
        attemptId: credentials.attempt_id,
        roomName: credentials.room_name,
      });
      return credentials;
    },
    [],
  );

  const connect = useCallback(async () => {
    if (connectionRef.current.status === 'starting' || connectionRef.current.status === 'disconnecting') {
      return;
    }

    const runId = connectRunRef.current + 1;
    connectRunRef.current = runId;
    dispatch({ type: 'start_requested' });
    let audioStarted = false;
    try {
        const credentials = await fetchCredentials();
        if (connectRunRef.current !== runId) return;

        // The native audio session must be configured before the room connects
        // and started so remote (agent) audio actually routes to the speaker.
        // Without this, the agent joins but is inaudible on device.
        await AudioSession.configureAudio({
          android: { audioTypeOptions: AndroidAudioTypePresets.communication },
        });
        await AudioSession.startAudioSession();
        audioStarted = true;
        if (connectRunRef.current !== runId) return;

        await room.connect(credentials.server_url, credentials.participant_token);
        if (connectRunRef.current !== runId) {
          room.disconnect();
          return;
        }

        await room.localParticipant.setMicrophoneEnabled(true);
        if (DEBUG_CONNECTION) {
          console.log('[connection] room connected', {
            roomState: room.state,
            participantCount: room.remoteParticipants.size + 1,
          });
        }
      } catch (err) {
        room.disconnect();
        if (audioStarted) {
          await AudioSession.stopAudioSession().catch(() => {});
        }
        if (connectRunRef.current === runId) {
          dispatch({ type: 'failed', error: err instanceof Error ? err.message : 'Unable to start workout' });
        }
      }
  }, [fetchCredentials, room]);

  const disconnect = useCallback(async () => {
    if (connectionRef.current.status === 'disconnecting') return;
    connectRunRef.current += 1;
    dispatch({ type: 'disconnect_requested' });
    try {
      room.disconnect();
    } finally {
      await AudioSession.stopAudioSession().catch(() => {});
      dispatch({ type: 'disconnected' });
    }
  }, [room]);

  const failActiveAttempt = useCallback(
    async (failure: { attemptId: string; roomName: string; message: string }) => {
      const current = connectionRef.current;
      if (current.attemptId !== failure.attemptId || current.roomName !== failure.roomName) return;
      room.disconnect();
      await AudioSession.stopAudioSession().catch(() => {});
      dispatch({
        type: 'failed',
        error: failure.message,
        attemptId: failure.attemptId,
        roomName: failure.roomName,
      });
    },
    [room],
  );

  const value = useMemo(
    () => ({
      connection,
      isConnectionActive: connection.status === 'starting' || connection.status === 'ready',
      connect,
      disconnect,
    }),
    [connect, connection, disconnect],
  );

  return (
    <RoomContext.Provider value={room}>
      <ConnectionContext.Provider value={value}>
        <ConnectionDataMessageBridge dispatch={dispatch} onStartupFailure={failActiveAttempt} />
        {children}
      </ConnectionContext.Provider>
    </RoomContext.Provider>
  );
}

function ConnectionDataMessageBridge({
  dispatch,
  onStartupFailure,
}: {
  dispatch: Dispatch<ConnectionAction>;
  onStartupFailure: (failure: { attemptId: string; roomName: string; message: string }) => void;
}) {
  const onMessage = useCallback(
    (msg: ReceivedDataMessage) => {
      if (DEBUG_CONNECTION) {
        console.log('[connection] data message received', {
          payloadType: Object.prototype.toString.call(msg.payload),
          payloadLength: msg.payload?.byteLength,
          from: msg.from?.identity,
          topic: msg.topic,
        });
      }
      const message = decodeDataMessage(msg.payload);
      if (!message) {
        if (DEBUG_CONNECTION) {
          console.log('[connection] data message decode failed');
        }
        return;
      }
      if (DEBUG_CONNECTION) {
        console.log('[connection] data message decoded', {
          type: message.type,
          attemptId: 'attemptId' in message.payload ? message.payload.attemptId : undefined,
          roomName: 'roomName' in message.payload ? message.payload.roomName : undefined,
        });
      }
      if (message.type === 'session_ready') {
        dispatch({ type: 'ready_received', payload: message.payload });
      } else if (message.type === 'session_failed') {
        onStartupFailure({
          attemptId: message.payload.attemptId,
          roomName: message.payload.roomName,
          message: message.payload.message,
        });
      }
    },
    [dispatch, onStartupFailure],
  );

  useDataChannel(onMessage);
  return null;
}
