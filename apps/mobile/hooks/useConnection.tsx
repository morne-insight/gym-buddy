import { TokenSource } from 'livekit-client';
import { createContext, useContext, useMemo, useState } from 'react';
import { SessionProvider, useSession } from '@livekit/components-react';
import { AudioSession, AndroidAudioTypePresets } from '@livekit/react-native';

// Override per-machine in apps/mobile/.env (EXPO_PUBLIC_TOKEN_ENDPOINT).
// Default targets the dev machine's LAN IP on the token-server port (3001).
// Android emulator: use http://10.0.2.2:3001/getToken instead.
const TOKEN_ENDPOINT =
  process.env.EXPO_PUBLIC_TOKEN_ENDPOINT ?? 'http://192.168.1.202:3001/getToken';

const AGENT_NAME = 'gym-buddy';

interface ConnectionContextType {
  isConnectionActive: boolean;
  connect: () => void;
  disconnect: () => void;
}

const ConnectionContext = createContext<ConnectionContextType>({
  isConnectionActive: false,
  connect: () => {},
  disconnect: () => {},
});

export function useConnection() {
  const ctx = useContext(ConnectionContext);
  if (!ctx) {
    throw new Error('useConnection must be used within a ConnectionProvider');
  }
  return ctx;
}

export function ConnectionProvider({ children }: { children: React.ReactNode }) {
  const [isConnectionActive, setIsConnectionActive] = useState(false);

  const tokenSource = useMemo(() => TokenSource.endpoint(TOKEN_ENDPOINT), []);

  const session = useSession(tokenSource, { agentName: AGENT_NAME });

  const value = useMemo(
    () => ({
      isConnectionActive,
      connect: async () => {
        // The native audio session must be configured before the room connects
        // and started so remote (agent) audio actually routes to the speaker.
        // Without this, the agent joins but is inaudible on device.
        await AudioSession.configureAudio({
          android: { audioTypeOptions: AndroidAudioTypePresets.communication },
        });
        await AudioSession.startAudioSession();
        setIsConnectionActive(true);
        await session.start();
      },
      disconnect: async () => {
        setIsConnectionActive(false);
        await session.end();
        await AudioSession.stopAudioSession();
      },
    }),
    [session, isConnectionActive],
  );

  return (
    <SessionProvider session={session}>
      <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>
    </SessionProvider>
  );
}
