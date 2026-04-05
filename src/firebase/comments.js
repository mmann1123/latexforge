import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
  query,
  where,
  onSnapshot,
  orderBy,
} from 'firebase/firestore';
import { db } from './config.js';

function commentsRef(projectId, fileId) {
  return collection(db, 'projects', projectId, 'files', fileId, 'comments');
}

/**
 * Load all unresolved comments for a file.
 */
export async function loadComments(projectId, fileId) {
  const q = query(
    commentsRef(projectId, fileId),
    where('resolved', '==', false),
    orderBy('createdAt', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Add a comment to a specific line.
 */
export async function addComment(projectId, fileId, { line, text, authorUid, authorName }) {
  const ref = await addDoc(commentsRef(projectId, fileId), {
    line,
    text,
    authorUid,
    authorName,
    resolved: false,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Mark a comment as resolved.
 */
export async function resolveComment(projectId, fileId, commentId) {
  await updateDoc(doc(db, 'projects', projectId, 'files', fileId, 'comments', commentId), {
    resolved: true,
  });
}

/**
 * Subscribe to real-time comment updates for a file.
 * Returns an unsubscribe function.
 */
export function subscribeComments(projectId, fileId, callback) {
  const q = query(
    commentsRef(projectId, fileId),
    where('resolved', '==', false),
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(q, (snap) => {
    const comments = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(comments);
  }, (err) => {
    console.warn('Error subscribing to comments:', err);
  });
}
