import {
  connectionReducer,
  initialConnectionState,
  type ConnectionState,
} from './connectionState';

const readyPayload = {
  attemptId: 'attempt-1',
  roomName: 'room-1',
  sessionId: 'session-1',
  restDay: false,
  workoutName: 'Push Day',
  initialExerciseProgress: null,
};

describe('connectionReducer', () => {
  it('starts from idle and ignores duplicate starts', () => {
    const starting = connectionReducer(initialConnectionState, { type: 'start_requested' });
    const duplicate = connectionReducer(starting, { type: 'start_requested' });

    expect(starting.status).toBe('starting');
    expect(duplicate).toBe(starting);
  });

  it('keeps credentials if the token callback wins the start render race', () => {
    const withCredentials = connectionReducer(initialConnectionState, {
      type: 'credentials_received',
      attemptId: 'attempt-1',
      roomName: 'room-1',
    });
    const duplicateStart = connectionReducer(withCredentials, { type: 'start_requested' });

    expect(withCredentials).toMatchObject({
      status: 'starting',
      attemptId: 'attempt-1',
      roomName: 'room-1',
    });
    expect(duplicateStart).toBe(withCredentials);
  });

  it('transitions to ready only for the active attempt and room', () => {
    const state: ConnectionState = {
      ...initialConnectionState,
      status: 'starting',
      attemptId: 'attempt-1',
      roomName: 'room-1',
    };

    const ready = connectionReducer(state, { type: 'ready_received', payload: readyPayload });

    expect(ready.status).toBe('ready');
    expect(ready.readyPayload).toEqual(readyPayload);
  });

  it('ignores stale readiness messages', () => {
    const state: ConnectionState = {
      ...initialConnectionState,
      status: 'starting',
      attemptId: 'attempt-2',
      roomName: 'room-2',
    };

    const after = connectionReducer(state, { type: 'ready_received', payload: readyPayload });

    expect(after).toBe(state);
  });

  it('ignores stale failure messages', () => {
    const state: ConnectionState = {
      ...initialConnectionState,
      status: 'starting',
      attemptId: 'attempt-2',
      roomName: 'room-2',
    };

    const after = connectionReducer(state, {
      type: 'failed',
      error: 'old attempt failed',
      attemptId: 'attempt-1',
      roomName: 'room-1',
    });

    expect(after).toBe(state);
  });

  it('resets after disconnect teardown completes', () => {
    const disconnecting = connectionReducer(
      { ...initialConnectionState, status: 'ready', readyPayload },
      { type: 'disconnect_requested' },
    );

    expect(disconnecting.status).toBe('disconnecting');
    expect(connectionReducer(disconnecting, { type: 'disconnected' })).toEqual(initialConnectionState);
  });
});
