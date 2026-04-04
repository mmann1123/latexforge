import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  where,
} from 'firebase/firestore';
import { db } from './config.js';

const STARTER_LATEX = `\\documentclass{article}
\\usepackage{amsmath}
\\usepackage{graphicx}

\\title{My New Document}
\\author{Author Name}
\\date{\\today}

\\begin{document}

\\maketitle

\\section{Introduction}
Write your introduction here.

\\section{Methods}
Describe your methods here.

\\end{document}`;

// ── Projects (top-level collection) ──────────────────────────

export async function createProject(userId, name) {
  const projectRef = await addDoc(collection(db, 'projects'), {
    name,
    ownerId: userId,
    collaborators: {},
    deletedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await addDoc(collection(db, 'projects', projectRef.id, 'files'), {
    name: 'main.tex',
    type: 'tex',
    content: STARTER_LATEX,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return projectRef.id;
}

export async function getProjects(userId) {
  const q = query(
    collection(db, 'projects'),
    where('ownerId', '==', userId),
    where('deletedAt', '==', null),
    orderBy('updatedAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getSharedProjects(userId) {
  // Query on dynamic map key — no orderBy to avoid needing a composite index
  // that can't be pre-created for every userId; sort and filter client-side
  const q = query(
    collection(db, 'projects'),
    where(`collaborators.${userId}`, 'in', ['editor', 'viewer'])
  );
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => !p.deletedAt)
    .sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0));
}

export async function getProject(projectId) {
  const snap = await getDoc(doc(db, 'projects', projectId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function deleteProject(projectId) {
  // Soft-delete: set deletedAt timestamp instead of removing data
  await updateDoc(doc(db, 'projects', projectId), {
    deletedAt: serverTimestamp(),
  });
}

export async function restoreProject(projectId) {
  await updateDoc(doc(db, 'projects', projectId), {
    deletedAt: null,
  });
}

export async function getDeletedProjects(userId) {
  const q = query(
    collection(db, 'projects'),
    where('ownerId', '==', userId),
    where('deletedAt', '!=', null)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function permanentlyDeleteProject(projectId) {
  // Hard-delete: remove all subcollections and the project doc
  const filesSnapshot = await getDocs(
    collection(db, 'projects', projectId, 'files')
  );
  await Promise.all(filesSnapshot.docs.map((d) => deleteDoc(d.ref)));

  const yjsSnapshot = await getDocs(
    collection(db, 'projects', projectId, 'yjs')
  );
  await Promise.all(yjsSnapshot.docs.map((d) => deleteDoc(d.ref)));

  const presenceSnapshot = await getDocs(
    collection(db, 'projects', projectId, 'presence')
  );
  await Promise.all(presenceSnapshot.docs.map((d) => deleteDoc(d.ref)));

  await deleteDoc(doc(db, 'projects', projectId));
}

// ── Files ────────────────────────────────────────────────────

export async function getFiles(projectId) {
  const q = query(
    collection(db, 'projects', projectId, 'files'),
    orderBy('name', 'asc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getFile(projectId, fileId) {
  const snap = await getDoc(
    doc(db, 'projects', projectId, 'files', fileId)
  );
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function createFile(projectId, name, type, content) {
  const ref = await addDoc(
    collection(db, 'projects', projectId, 'files'),
    {
      name,
      type,
      content: content || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
  );
  return ref.id;
}

export async function updateFileContent(projectId, fileId, content) {
  await updateDoc(
    doc(db, 'projects', projectId, 'files', fileId),
    {
      content,
      updatedAt: serverTimestamp(),
    }
  );

  await updateDoc(doc(db, 'projects', projectId), {
    updatedAt: serverTimestamp(),
  });
}

/**
 * Get the updatedAt timestamp for a file (lightweight read for staleness checks).
 */
export async function getFileUpdatedAt(projectId, fileId) {
  const snap = await getDoc(doc(db, 'projects', projectId, 'files', fileId));
  if (!snap.exists()) return null;
  return snap.data().updatedAt || null;
}

export async function renameFile(projectId, fileId, newName) {
  await updateDoc(
    doc(db, 'projects', projectId, 'files', fileId),
    { name: newName, updatedAt: serverTimestamp() }
  );
}

export async function deleteFile(projectId, fileId) {
  await deleteDoc(
    doc(db, 'projects', projectId, 'files', fileId)
  );
}

export async function updateProjectName(projectId, name) {
  await updateDoc(doc(db, 'projects', projectId), {
    name,
    updatedAt: serverTimestamp(),
  });
}
