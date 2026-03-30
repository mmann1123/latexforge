import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  query,
} from 'firebase/firestore';
import { db } from '../firebase/config.js';

const HEARTBEAT_INTERVAL = 15_000;
const STALE_THRESHOLD = 30_000;

// Assign a stable color per user based on their uid
const COLORS = [
  '#e06c75', '#61afef', '#98c379', '#d19a66',
  '#c678dd', '#56b6c2', '#e5c07b', '#be5046',
];

function uidToColor(uid) {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

/**
 * Syncs cursor/presence state to Firestore for collaborative awareness.
 *
 * Each connected user writes their own document to:
 *   projects/{projectId}/presence/{odUnique}
 *
 * All connected users listen to the presence collection to see who else is online.
 */
export class FirestorePresenceProvider {
  constructor(projectId, fileId, awareness, user) {
    this.projectId = projectId;
    this.fileId = fileId;
    this.awareness = awareness;
    this.user = user;
    this.odUnique = `${user.uid}-${Math.random().toString(36).slice(2, 8)}`;
    this.presenceRef = doc(db, 'projects', projectId, 'presence', this.odUnique);
    this.collectionRef = collection(db, 'projects', projectId, 'presence');
    this.unsubscribe = null;
    this.heartbeatTimer = null;
    this.destroyed = false;
    this.remotePeers = new Map(); // odUnique -> { uid, displayName, color, ... }

    this._onAwarenessUpdate = this._onAwarenessUpdate.bind(this);
  }

  async connect() {
    // Set local awareness state
    const color = uidToColor(this.user.uid);
    this.awareness.setLocalStateField('user', {
      uid: this.user.uid,
      displayName: this.user.displayName || this.user.email,
      color,
    });

    // Write initial presence
    await this._writePresence();

    // Listen for awareness changes (cursor moves)
    this.awareness.on('update', this._onAwarenessUpdate);

    // Listen for remote presence docs
    this.unsubscribe = onSnapshot(query(this.collectionRef), (snapshot) => {
      if (this.destroyed) return;
      const now = Date.now();
      const states = [];

      snapshot.docs.forEach((d) => {
        if (d.id === this.odUnique) return; // skip self
        const data = d.data();
        // Filter to same fileId and not stale
        if (data.fileId !== this.fileId) return;
        const lastSeen = data.lastSeen?.toMillis?.() || 0;
        if (now - lastSeen > STALE_THRESHOLD) return;

        states.push({
          odUnique: d.id,
          uid: data.uid,
          displayName: data.displayName,
          color: data.color,
          cursor: data.cursor,
        });
      });

      this.remotePeers = new Map(states.map((s) => [s.odUnique, s]));
    });

    // Start heartbeat
    this.heartbeatTimer = setInterval(() => this._writePresence(), HEARTBEAT_INTERVAL);
  }

  _onAwarenessUpdate() {
    if (this.destroyed) return;
    // Debounce awareness writes to avoid excessive Firestore writes
    if (this._awarenessTimer) clearTimeout(this._awarenessTimer);
    this._awarenessTimer = setTimeout(() => this._writePresence(), 300);
  }

  async _writePresence() {
    if (this.destroyed) return;
    const localState = this.awareness.getLocalState();
    // Convert cursor to plain JSON — Yjs RelativePosition objects are not
    // serializable by Firestore, so we strip them to simple {anchor, head} numbers
    let cursor = null;
    if (localState?.cursor) {
      const c = localState.cursor;
      cursor = {
        anchor: typeof c.anchor === 'number' ? c.anchor : (c.anchor?.index ?? null),
        head: typeof c.head === 'number' ? c.head : (c.head?.index ?? null),
      };
    }
    try {
      await setDoc(this.presenceRef, {
        uid: this.user.uid,
        displayName: this.user.displayName || 'Anonymous',
        color: uidToColor(this.user.uid),
        fileId: this.fileId,
        cursor,
        lastSeen: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Error writing presence:', err);
    }
  }

  getRemotePeers() {
    return Array.from(this.remotePeers.values());
  }

  async destroy() {
    this.destroyed = true;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this._awarenessTimer) clearTimeout(this._awarenessTimer);
    this.awareness.off('update', this._onAwarenessUpdate);
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    // Delete own presence doc
    try {
      await deleteDoc(this.presenceRef);
    } catch (err) {
      console.warn('Error deleting presence doc:', err);
    }
  }
}
