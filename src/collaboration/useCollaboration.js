import { useState, useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness.js';
import { FirestoreYjsProvider } from './FirestoreYjsProvider.js';
import { FirestorePresenceProvider } from './FirestorePresenceProvider.js';
import { getFile, updateFileContent } from '../firebase/firestore.js';

const SNAPSHOT_INTERVAL = 30_000; // Sync yText → Firestore content every 30s

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

      // Periodic snapshot: write yText content back to files/{fileId}.content
      const snapshotTimer = setInterval(async () => {
        if (cancelled) return;
        try {
          await updateFileContent(projectId, fileId, text.toString());
        } catch (err) {
          console.warn('Error snapshotting content:', err);
        }
      }, SNAPSHOT_INTERVAL);

      if (!cancelled) {
        setYText(text);
        setAwareness(aware);
        setUndoManager(undo);
        setStatus('synced');
      }

      // Store cleanup function
      cleanupRef.current = async () => {
        cancelled = true;
        clearInterval(snapshotTimer);

        // Final snapshot before disconnect
        try {
          await updateFileContent(projectId, fileId, text.toString());
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
