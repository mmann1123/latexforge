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

export async function createProject(userId, name) {
  const projectRef = await addDoc(collection(db, 'users', userId, 'projects'), {
    name: name,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await addDoc(collection(db, 'users', userId, 'projects', projectRef.id, 'files'), {
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
    collection(db, 'users', userId, 'projects'),
    orderBy('updatedAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function deleteProject(userId, projectId) {
  const filesSnapshot = await getDocs(
    collection(db, 'users', userId, 'projects', projectId, 'files')
  );
  const deletePromises = filesSnapshot.docs.map((d) => deleteDoc(d.ref));
  await Promise.all(deletePromises);
  await deleteDoc(doc(db, 'users', userId, 'projects', projectId));
}

export async function getFiles(userId, projectId) {
  const q = query(
    collection(db, 'users', userId, 'projects', projectId, 'files'),
    orderBy('name', 'asc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getFile(userId, projectId, fileId) {
  const snap = await getDoc(
    doc(db, 'users', userId, 'projects', projectId, 'files', fileId)
  );
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function createFile(userId, projectId, name, type, content) {
  const ref = await addDoc(
    collection(db, 'users', userId, 'projects', projectId, 'files'),
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

export async function updateFileContent(userId, projectId, fileId, content) {
  await updateDoc(
    doc(db, 'users', userId, 'projects', projectId, 'files', fileId),
    {
      content,
      updatedAt: serverTimestamp(),
    }
  );

  await updateDoc(doc(db, 'users', userId, 'projects', projectId), {
    updatedAt: serverTimestamp(),
  });
}

export async function deleteFile(userId, projectId, fileId) {
  await deleteDoc(
    doc(db, 'users', userId, 'projects', projectId, 'files', fileId)
  );
}

export async function updateProjectName(userId, projectId, name) {
  await updateDoc(doc(db, 'users', userId, 'projects', projectId), {
    name,
    updatedAt: serverTimestamp(),
  });
}
