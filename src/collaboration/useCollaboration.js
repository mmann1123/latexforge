import { useState, useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness.js';
import { FirestoreYjsProvider } from './FirestoreYjsProvider.js';
import { FirestorePresenceProvider } from './FirestorePresenceProvider.js';
import { getFile, updateFileContent, getFileUpdatedAt } from '../firebase/firestore.js';

const SNAPSHOT_INTERVAL = 30_000; // Sync yText → Firestore content every 30s
const RESYNC_DELAY = 2000; // Wait 2s after tab becomes visible before flushing

/**
 * React hook that manages collaborative editing for a single file.
 *
 * Returns: { yText, awareness, undoManager, status }
 *   - yText: Y.Text instance bound to the file content
 *   - awareness: Yjs Awareness instance for cursor/presence
 *   - undoManager: Y.UndoManager for undo/redo
 *   - status: 'connecting' | 'synced' | 'disconnected'
 */
export function useCollaboration(projectId, fileId, user, canEdit) {
  const [yText, setYText] = useState(null);
  const [awareness, setAwareness] = useState(null);
  const [undoManager, setUndoManager] = useState(null);
  const [status, setStatus] = useState('disconnected');
  const cleanupRef = useRef(null);

  useEffect(() => {
    if (!projectId || !fileId || !user) {
      setYText(null);
      setAwareness(null);
      setUndoManager(null);
      setStatus('disconnected');
      return;
    }

    let cancelled = false;

    async function setup() {
      setStatus('connecting');

      const yDoc = new Y.Doc();
      const text = yDoc.getText('content');
      const aware = new Awareness(yDoc);

      // Track our last successful write time for staleness checks
      let lastWriteTime = null;

      // Create providers
      const yjsProvider = new FirestoreYjsProvider(projectId, fileId, yDoc);
      yjsProvider.onStatusChange = (s) => {
        if (!cancelled) setStatus(s);
      };

      const presenceProvider = new FirestorePresenceProvider(
        projectId, fileId, aware, user
      );

      // Connect Yjs provider (loads initial state)
      await yjsProvider.connect();

      // If Y.Doc is empty, seed it from Firestore file content
      if (text.length === 0) {
        try {
          const file = await getFile(projectId, fileId);
          if (file?.content) {
            yDoc.transact(() => {
              text.insert(0, file.content);
            });
          }
        } catch (err) {
          console.warn('Error seeding Yjs from file content:', err);
        }
      }

      // Connect presence provider
      await presenceProvider.connect();

      // Create undo manager
      const undo = new Y.UndoManager(text);

      /**
       * Guarded flush: only write to files/{fileId}.content if no other
       * session has written since our last flush.
       */
      async function guardedFlush() {
        if (cancelled) return;
        try {
          const remoteUpdatedAt = await getFileUpdatedAt(projectId, fileId);
          // If remote timestamp is newer than our last write, skip — another session wrote
          if (lastWriteTime && remoteUpdatedAt) {
            const remoteMs = remoteUpdatedAt.toMillis ? remoteUpdatedAt.toMillis() : new Date(remoteUpdatedAt).getTime();
            if (remoteMs > lastWriteTime) {
              return; // Skip write — remote content is newer
            }
          }
          await updateFileContent(projectId, fileId, text.toString());
          lastWriteTime = Date.now();
        } catch (err) {
          console.warn('Error snapshotting content:', err);
        }
      }

      // Periodic snapshot: write yText content back to files/{fileId}.content
      let snapshotTimer = setInterval(guardedFlush, SNAPSHOT_INTERVAL);

      // ── Visibility change: pause/resume periodic snapshots ──
      function handleVisibilityChange() {
        if (cancelled) return;
        if (document.hidden) {
          // Tab hidden — stop the periodic timer to prevent stale writes
          clearInterval(snapshotTimer);
          snapshotTimer = null;
        } else {
          // Tab visible — wait for Yjs onSnapshot to re-sync, then restart timer
          setTimeout(() => {
            if (cancelled) return;
            if (!snapshotTimer) {
              snapshotTimer = setInterval(guardedFlush, SNAPSHOT_INTERVAL);
            }
          }, RESYNC_DELAY);
        }
      }
      document.addEventListener('visibilitychange', handleVisibilityChange);

      if (!cancelled) {
        setYText(text);
        setAwareness(aware);
        setUndoManager(undo);
        setStatus('synced');
      }

      // Store cleanup function
      cleanupRef.current = async () => {
        cancelled = true;
        if (snapshotTimer) clearInterval(snapshotTimer);
        document.removeEventListener('visibilitychange', handleVisibilityChange);

        // Final guarded snapshot before disconnect
        try {
          const remoteUpdatedAt = await getFileUpdatedAt(projectId, fileId);
          if (lastWriteTime && remoteUpdatedAt) {
            const remoteMs = remoteUpdatedAt.toMillis ? remoteUpdatedAt.toMillis() : new Date(remoteUpdatedAt).getTime();
            if (remoteMs > lastWriteTime) {
              // Skip — remote content is newer, don't overwrite
            } else {
              await updateFileContent(projectId, fileId, text.toString());
            }
          } else {
            await updateFileContent(projectId, fileId, text.toString());
          }
        } catch (err) {
          console.warn('Error on final content snapshot:', err);
        }

        yjsProvider.destroy();
        await presenceProvider.destroy();
        undo.destroy();
        aware.destroy();
        yDoc.destroy();
      };
    }

    setup().catch((err) => {
      console.error('Error setting up collaboration:', err);
      if (!cancelled) setStatus('disconnected');
    });

    return () => {
      // Run cleanup from previous setup
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [projectId, fileId, user?.uid, canEdit]);

  return { yText, awareness, undoManager, status };
}
