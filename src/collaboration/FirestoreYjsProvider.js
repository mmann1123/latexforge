import * as Y from 'yjs';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  runTransaction,
  arrayUnion,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { fromBase64, toBase64 } from './encoding.js';

const COMPACTION_THRESHOLD = 50;
const BUFFER_MS = 500;

/**
 * Syncs a Yjs Y.Doc to/from a Firestore document at projects/{projectId}/yjs/{fileId}.
 *
 * The Firestore doc stores:
 *   updates: string[]   — base64-encoded incremental Yjs updates
 *   snapshot: string     — base64-encoded full state snapshot (after compaction)
 *   updatedAt: timestamp
 */
export class FirestoreYjsProvider {
  constructor(projectId, fileId, yDoc) {
    this.projectId = projectId;
    this.fileId = fileId;
    this.yDoc = yDoc;
    this.docRef = doc(db, 'projects', projectId, 'yjs', fileId);
    this.unsubscribe = null;
    this.localOrigin = `local-${Math.random().toString(36).slice(2)}`;
    this.pendingUpdates = [];
    this.bufferTimer = null;
    this.destroyed = false;
    this.appliedUpdateCount = 0;
    this.connected = false;
    this.onStatusChange = null;

    this._onYjsUpdate = this._onYjsUpdate.bind(this);
  }

  async connect() {
    // Load initial state
    const snap = await getDoc(this.docRef);
    if (snap.exists()) {
      const data = snap.data();
      // Apply snapshot first if it exists
      if (data.snapshot) {
        const snapshotUpdate = fromBase64(data.snapshot);
        Y.applyUpdate(this.yDoc, snapshotUpdate, 'remote');
      }
      // Then apply incremental updates
      if (data.updates && data.updates.length > 0) {
        for (const b64 of data.updates) {
          const update = fromBase64(b64);
          Y.applyUpdate(this.yDoc, update, 'remote');
        }
        this.appliedUpdateCount = data.updates.length;
      }
    }

    // Listen for local changes
    this.yDoc.on('update', this._onYjsUpdate);

    // Listen for remote changes via onSnapshot
    this.unsubscribe = onSnapshot(this.docRef, (snap) => {
      if (this.destroyed) return;
      if (!snap.exists()) return;
      const data = snap.data();
      const updates = data.updates || [];

      // Only apply updates we haven't seen
      if (updates.length > this.appliedUpdateCount) {
        const newUpdates = updates.slice(this.appliedUpdateCount);
        for (const b64 of newUpdates) {
          const update = fromBase64(b64);
          Y.applyUpdate(this.yDoc, update, 'remote');
        }
        this.appliedUpdateCount = updates.length;
      }

      // Check if compaction happened (snapshot changed, updates reset)
      if (data.snapshot && updates.length < this.appliedUpdateCount) {
        // Re-sync from snapshot + new updates
        this.appliedUpdateCount = updates.length;
      }
    });

    this.connected = true;
    this.onStatusChange?.('synced');
  }

  _onYjsUpdate(update, origin) {
    if (this.destroyed) return;
    // Don't send back remote updates
    if (origin === 'remote') return;

    this.pendingUpdates.push(update);

    // Buffer updates before sending
    if (this.bufferTimer) clearTimeout(this.bufferTimer);
    this.bufferTimer = setTimeout(() => this._flushUpdates(), BUFFER_MS);
  }

  async _flushUpdates() {
    if (this.destroyed || this.pendingUpdates.length === 0) return;

    const merged = Y.mergeUpdates(this.pendingUpdates);
    this.pendingUpdates = [];
    const b64 = toBase64(merged);

    try {
      const snap = await getDoc(this.docRef);
      if (!snap.exists()) {
        // First write — create the document
        await setDoc(this.docRef, {
          updates: [b64],
          snapshot: null,
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(this.docRef, {
          updates: arrayUnion(b64),
          updatedAt: serverTimestamp(),
        });
      }
      this.appliedUpdateCount += 1;

      // Check if compaction is needed
      const currentSnap = await getDoc(this.docRef);
      if (currentSnap.exists()) {
        const data = currentSnap.data();
        if ((data.updates?.length || 0) >= COMPACTION_THRESHOLD) {
          await this._compact();
        }
      }
    } catch (err) {
      console.error('Error writing Yjs update to Firestore:', err);
    }
  }

  async _compact() {
    try {
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(this.docRef);
        if (!snap.exists()) return;
        const data = snap.data();
        if ((data.updates?.length || 0) < COMPACTION_THRESHOLD) return;

        // Merge snapshot + all updates into one snapshot
        const fullState = Y.encodeStateAsUpdate(this.yDoc);
        const b64Snapshot = toBase64(fullState);

        transaction.update(this.docRef, {
          snapshot: b64Snapshot,
          updates: [],
          updatedAt: serverTimestamp(),
        });
      });
      this.appliedUpdateCount = 0;
    } catch (err) {
      // Another client may have compacted — that's fine
      console.warn('Compaction failed (likely concurrent):', err);
    }
  }

  destroy() {
    this.destroyed = true;
    if (this.bufferTimer) clearTimeout(this.bufferTimer);
    // Flush any remaining updates synchronously-ish
    if (this.pendingUpdates.length > 0) {
      this._flushUpdates();
    }
    this.yDoc.off('update', this._onYjsUpdate);
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.connected = false;
  }
}
