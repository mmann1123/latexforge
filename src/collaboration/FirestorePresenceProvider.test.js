import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockSetDoc = vi.fn().mockResolvedValue();
const mockDeleteDoc = vi.fn().mockResolvedValue();
const mockOnSnapshot = vi.fn(() => vi.fn()); // returns unsubscribe fn

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((...args) => args.join('/')),
  doc: vi.fn((...args) => args.join('/')),
  setDoc: (...args) => mockSetDoc(...args),
  deleteDoc: (...args) => mockDeleteDoc(...args),
  onSnapshot: (...args) => mockOnSnapshot(...args),
  serverTimestamp: vi.fn(() => 'mock-ts'),
  query: vi.fn((ref) => ref),
}));

vi.mock('../firebase/config.js', () => ({
  db: 'mock-db',
}));

import { FirestorePresenceProvider } from './FirestorePresenceProvider.js';

function createMockAwareness() {
  const listeners = {};
  return {
    setLocalStateField: vi.fn(),
    getLocalState: vi.fn(() => ({ cursor: null })),
    on: vi.fn((event, fn) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(fn);
    }),
    off: vi.fn((event, fn) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((f) => f !== fn);
      }
    }),
    _listeners: listeners,
  };
}

describe('FirestorePresenceProvider', () => {
  let provider;
  let awareness;
  const user = { uid: 'user-1', displayName: 'Test User', email: 'test@example.com' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    awareness = createMockAwareness();
    provider = new FirestorePresenceProvider('proj-1', 'file-1', awareness, user);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with correct state', () => {
    expect(provider.projectId).toBe('proj-1');
    expect(provider.fileId).toBe('file-1');
    expect(provider.destroyed).toBe(false);
    expect(provider.remotePeers).toBeInstanceOf(Map);
    expect(provider.remotePeers.size).toBe(0);
  });

  it('sets local awareness state on connect', async () => {
    await provider.connect();
    expect(awareness.setLocalStateField).toHaveBeenCalledWith('user', {
      uid: 'user-1',
      displayName: 'Test User',
      color: expect.any(String),
    });
  });

  it('writes initial presence on connect', async () => {
    await provider.connect();
    expect(mockSetDoc).toHaveBeenCalled();
    const presenceData = mockSetDoc.mock.calls[0][1];
    expect(presenceData.uid).toBe('user-1');
    expect(presenceData.displayName).toBe('Test User');
    expect(presenceData.fileId).toBe('file-1');
  });

  it('listens for awareness updates on connect', async () => {
    await provider.connect();
    expect(awareness.on).toHaveBeenCalledWith('update', expect.any(Function));
  });

  it('subscribes to remote presence via onSnapshot', async () => {
    await provider.connect();
    expect(mockOnSnapshot).toHaveBeenCalled();
  });

  it('getRemotePeers returns empty array initially', () => {
    expect(provider.getRemotePeers()).toEqual([]);
  });

  it('assigns deterministic color based on uid', async () => {
    await provider.connect();
    const presenceData = mockSetDoc.mock.calls[0][1];
    expect(presenceData.color).toMatch(/^#[0-9a-f]{6}$/i);

    // Same uid should get same color
    const provider2 = new FirestorePresenceProvider('proj-2', 'file-2', createMockAwareness(), user);
    await provider2.connect();
    const presenceData2 = mockSetDoc.mock.calls[1][1];
    expect(presenceData2.color).toBe(presenceData.color);
  });

  it('uses email as displayName fallback', async () => {
    const noNameUser = { uid: 'u2', displayName: '', email: 'fallback@test.com' };
    const p = new FirestorePresenceProvider('proj-1', 'file-1', createMockAwareness(), noNameUser);
    await p.connect();
    // setLocalStateField gets displayName from user.displayName || user.email
    const call = p.awareness.setLocalStateField.mock.calls[0][1];
    expect(call.displayName).toBe('fallback@test.com');
  });

  describe('destroy', () => {
    it('sets destroyed flag', async () => {
      await provider.connect();
      await provider.destroy();
      expect(provider.destroyed).toBe(true);
    });

    it('removes awareness listener', async () => {
      await provider.connect();
      await provider.destroy();
      expect(awareness.off).toHaveBeenCalledWith('update', expect.any(Function));
    });

    it('deletes presence doc from Firestore', async () => {
      await provider.connect();
      await provider.destroy();
      expect(mockDeleteDoc).toHaveBeenCalled();
    });

    it('unsubscribes from onSnapshot', async () => {
      const unsub = vi.fn();
      mockOnSnapshot.mockReturnValue(unsub);
      await provider.connect();
      await provider.destroy();
      expect(unsub).toHaveBeenCalled();
    });
  });
});
