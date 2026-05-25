import { TokenSource } from 'livekit-client';
import { createContext, useContext, useMemo, useState } from 'react';
import { SessionProvider, useSession } from '@livekit/components-react';

const TOKEN_ENDPOINT = 'http://192.168.1.206:3001/getToken';

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
      connect: () => {
        setIsConnectionActive(true);
        session.start();
      },
      disconnect: () => {
        setIsConnectionActive(false);
        session.end();
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
