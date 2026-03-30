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
    orderBy('updatedAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getSharedProjects(userId) {
  // Query on dynamic map key — no orderBy to avoid needing a composite index
  // that can't be pre-created for every userId; sort client-side instead
  const q = query(
    collection(db, 'projects'),
    where(`collaborators.${userId}`, 'in', ['editor', 'viewer'])
  );
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0));
}

export async function getProject(projectId) {
  const snap = await getDoc(doc(db, 'projects', projectId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function deleteProject(projectId) {
  // Delete all files in the project
  const filesSnapshot = await getDocs(
    collection(db, 'projects', projectId, 'files')
  );
  const deletePromises = filesSnapshot.docs.map((d) => deleteDoc(d.ref));
  await Promise.all(deletePromises);

  // Delete all yjs docs
  const yjsSnapshot = await getDocs(
    collection(db, 'projects', projectId, 'yjs')
  );
  await Promise.all(yjsSnapshot.docs.map((d) => deleteDoc(d.ref)));

  // Delete all presence docs
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
