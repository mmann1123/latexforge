import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as Y from 'yjs';

const mockGetDoc = vi.fn();
const mockSetDoc = vi.fn().mockResolvedValue();
const mockUpdateDoc = vi.fn().mockResolvedValue();
const mockOnSnapshot = vi.fn(() => vi.fn());
const mockRunTransaction = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((...args) => args.join('/')),
  getDoc: (...args) => mockGetDoc(...args),
  setDoc: (...args) => mockSetDoc(...args),
  updateDoc: (...args) => mockUpdateDoc(...args),
  onSnapshot: (...args) => mockOnSnapshot(...args),
  runTransaction: (...args) => mockRunTransaction(...args),
  arrayUnion: vi.fn((val) => val),
  serverTimestamp: vi.fn(() => 'mock-ts'),
}));

vi.mock('../firebase/config.js', () => ({
  db: 'mock-db',
}));

import { FirestoreYjsProvider } from './FirestoreYjsProvider.js';
import { toBase64 } from './encoding.js';

describe('FirestoreYjsProvider', () => {
  let yDoc;
  let provider;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    yDoc = new Y.Doc();
    provider = new FirestoreYjsProvider('proj-1', 'file-1', yDoc);
  });

  afterEach(() => {
    provider.destroy();
    yDoc.destroy();
    vi.useRealTimers();
  });

  it('initializes with correct state', () => {
    expect(provider.projectId).toBe('proj-1');
    expect(provider.fileId).toBe('file-1');
    expect(provider.yDoc).toBe(yDoc);
    expect(provider.destroyed).toBe(false);
    expect(provider.connected).toBe(false);
    expect(provider.pendingUpdates).toEqual([]);
  });

  describe('connect', () => {
    it('connects and sets up listener when no existing doc', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });

      await provider.connect();
      expect(provider.connected).toBe(true);
      expect(mockOnSnapshot).toHaveBeenCalled();
    });

    it('loads existing snapshot on connect', async () => {
      // Create a snapshot from a separate doc
      const sourceDoc = new Y.Doc();
      sourceDoc.getText('content').insert(0, 'existing content');
      const snapshot = Y.encodeStateAsUpdate(sourceDoc);
      const b64Snapshot = toBase64(snapshot);
      sourceDoc.destroy();

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ snapshot: b64Snapshot, updates: [] }),
      });

      await provider.connect();
      expect(yDoc.getText('content').toString()).toBe('existing content');
    });

    it('applies incremental updates on connect', async () => {
      // Create incremental update
      const tempDoc = new Y.Doc();
      tempDoc.getText('content').insert(0, 'hello');
      const update = Y.encodeStateAsUpdate(tempDoc);
      const b64Update = toBase64(update);
      tempDoc.destroy();

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ snapshot: null, updates: [b64Update] }),
      });

      await provider.connect();
      expect(yDoc.getText('content').toString()).toBe('hello');
      expect(provider.appliedUpdateCount).toBe(1);
    });

    it('calls onStatusChange when synced', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });
      const statusFn = vi.fn();
      provider.onStatusChange = statusFn;

      await provider.connect();
      expect(statusFn).toHaveBeenCalledWith('synced');
    });
  });

  describe('_onYjsUpdate', () => {
    it('ignores remote-origin updates', () => {
      provider._onYjsUpdate(new Uint8Array([1, 2, 3]), 'remote');
      expect(provider.pendingUpdates).toHaveLength(0);
    });

    it('queues local updates', () => {
      provider._onYjsUpdate(new Uint8Array([1, 2, 3]), 'local');
      expect(provider.pendingUpdates).toHaveLength(1);
    });

    it('does not queue when destroyed', () => {
      provider.destroyed = true;
      provider._onYjsUpdate(new Uint8Array([1, 2, 3]), 'local');
      expect(provider.pendingUpdates).toHaveLength(0);
    });
  });

  describe('_flushUpdates', () => {
    it('does nothing when no pending updates', async () => {
      await provider._flushUpdates();
      expect(mockGetDoc).not.toHaveBeenCalled();
    });

    it('creates doc on first write', async () => {
      provider.pendingUpdates = [new Uint8Array([1, 2])];
      mockGetDoc
        .mockResolvedValueOnce({ exists: () => false })  // first check
        .mockResolvedValueOnce({ exists: () => true, data: () => ({ updates: [1] }) }); // compaction check

      await provider._flushUpdates();
      expect(mockSetDoc).toHaveBeenCalled();
    });

    it('uses arrayUnion for existing doc', async () => {
      provider.pendingUpdates = [new Uint8Array([1, 2])];
      mockGetDoc
        .mockResolvedValueOnce({ exists: () => true })
        .mockResolvedValueOnce({ exists: () => true, data: () => ({ updates: [1, 2] }) });

      await provider._flushUpdates();
      expect(mockUpdateDoc).toHaveBeenCalled();
    });

    it('does nothing when destroyed', async () => {
      provider.destroyed = true;
      provider.pendingUpdates = [new Uint8Array([1])];
      await provider._flushUpdates();
      expect(mockGetDoc).not.toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('sets destroyed flag and disconnects', () => {
      provider.destroy();
      expect(provider.destroyed).toBe(true);
      expect(provider.connected).toBe(false);
    });

    it('unsubscribes from onSnapshot', async () => {
      const unsub = vi.fn();
      mockOnSnapshot.mockReturnValue(unsub);
      mockGetDoc.mockResolvedValue({ exists: () => false });

      await provider.connect();
      provider.destroy();
      expect(unsub).toHaveBeenCalled();
    });

    it('removes yDoc update listener', () => {
      const offSpy = vi.spyOn(yDoc, 'off');
      provider.destroy();
      expect(offSpy).toHaveBeenCalledWith('update', provider._onYjsUpdate);
    });

    it('flushes pending updates on destroy', () => {
      provider.pendingUpdates = [new Uint8Array([1, 2])];
      const flushSpy = vi.spyOn(provider, '_flushUpdates');
      provider.destroy();
      expect(flushSpy).toHaveBeenCalled();
    });
  });
});
