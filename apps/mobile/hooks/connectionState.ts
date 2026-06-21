import type { SessionReadyPayload } from './useDataMessages';

export type ConnectionStatus = 'idle' | 'starting' | 'ready' | 'failed' | 'disconnecting';

export interface ConnectionState {
  status: ConnectionStatus;
  attemptId: string | null;
  roomName: string | null;
  readyPayload: SessionReadyPayload | null;
  error: string | null;
}

export type ConnectionAction =
  | { type: 'start_requested' }
  | { type: 'credentials_received'; attemptId: string; roomName: string }
  | { type: 'ready_received'; payload: SessionReadyPayload }
  | { type: 'failed'; error: string; attemptId?: string; roomName?: string }
  | { type: 'disconnect_requested' }
  | { type: 'disconnected' };

export const initialConnectionState: ConnectionState = {
  status: 'idle',
  attemptId: null,
  roomName: null,
  readyPayload: null,
  error: null,
};

export function connectionReducer(state: ConnectionState, action: ConnectionAction): ConnectionState {
  switch (action.type) {
    case 'start_requested':
      if (state.status === 'starting' || state.status === 'disconnecting') return state;
      return { ...initialConnectionState, status: 'starting' };
    case 'credentials_received':
      if (state.status !== 'idle' && state.status !== 'starting') return state;
      return { ...state, status: 'starting', attemptId: action.attemptId, roomName: action.roomName };
    case 'ready_received':
      if (
        state.status !== 'starting' ||
        state.attemptId !== action.payload.attemptId ||
        state.roomName !== action.payload.roomName
      ) {
        return state;
      }
      return { ...state, status: 'ready', readyPayload: action.payload, error: null };
    case 'failed':
      if (state.status === 'disconnecting') return state;
      if (
        action.attemptId &&
        action.roomName &&
        (state.attemptId !== action.attemptId || state.roomName !== action.roomName)
      ) {
        return state;
      }
      return { ...state, status: 'failed', error: action.error };
    case 'disconnect_requested':
      if (state.status === 'disconnecting') return state;
      return { ...state, status: 'disconnecting' };
    case 'disconnected':
      return initialConnectionState;
  }
}
