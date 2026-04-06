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

const STARTER_LATEX = `\\documentclass[12pt]{article}

% --- Packages ---
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath, amssymb}
\\usepackage{graphicx}
\\usepackage{booktabs}
\\usepackage[margin=1in]{geometry}
\\usepackage[numbers]{natbib}
\\usepackage{hyperref}

% --- Title ---
\\title{A Template for Academic Papers in LaTeX Forge}
\\author{
  First Author\\thanks{Department of Example Studies, University of Somewhere, email@university.edu} \\\\and
  Second Author\\thanks{Institute for Research, Another University, author2@example.org}
}
\\date{\\today}

\\begin{document}

\\maketitle

% --- Abstract ---
\\begin{abstract}
This document is a starter template for writing academic papers in LaTeX Forge. It demonstrates common elements including sections, citations, figures, tables, and equations. Replace this content with your own work.
\\end{abstract}

% --- Introduction ---
\\section{Introduction}

This template shows how to structure an academic paper. LaTeX Forge supports real-time collaboration, BibTeX bibliographies, and multi-file projects.

You can cite references in several ways. Use a numbered citation like this \\cite{smith2023}. For an inline textual citation, write \\citet{johnson2021} to get the author name as part of the sentence. For a parenthetical citation, use \\citep{doe2022}.

% --- Literature Review ---
\\section{Literature Review}

Prior work has explored various approaches to this problem. \\citet{smith2023} introduced a framework that was later extended by \\citet{johnson2021}. A comprehensive overview can be found in \\citep{doe2022}.

% --- Methods ---
\\section{Methods}

\\subsection{Data Collection}

Describe your data sources and collection procedures here.

\\subsection{Model Specification}

Equations are straightforward in LaTeX. For example, a linear regression model:

\\begin{equation}
  y_i = \\beta_0 + \\beta_1 x_{i1} + \\beta_2 x_{i2} + \\epsilon_i, \\quad \\epsilon_i \\sim \\mathcal{N}(0, \\sigma^2)
  \\label{eq:regression}
\\end{equation}

You can reference equations by number: see Equation~\\ref{eq:regression}.

% --- Results ---
\\section{Results}

\\subsection{Descriptive Statistics}

Tables can be created with the \\texttt{booktabs} package for clean formatting:

\\begin{table}[h]
  \\centering
  \\caption{Summary statistics for key variables.}
  \\label{tab:summary}
  \\begin{tabular}{lrrr}
    \\toprule
    Variable & Mean & Std.\\ Dev. & N \\\\
    \\midrule
    Outcome      & 42.3  & 8.7  & 150 \\\\
    Predictor 1  & 0.65  & 0.12 & 150 \\\\
    Predictor 2  & 3.14  & 1.59 & 148 \\\\
    \\bottomrule
  \\end{tabular}
\\end{table}

\\subsection{Figures}

Upload images to the \\texttt{figures/} folder and reference them by path:

\\begin{figure}[h]
  \\centering
  \\includegraphics[width=0.5\\textwidth]{figures/example.png}
  \\caption{A sample figure. Replace with your own image.}
  \\label{fig:example}
\\end{figure}

As shown in Figure~\\ref{fig:example}, the results support the hypothesis. Table~\\ref{tab:summary} provides the corresponding statistics.

% --- Discussion ---
\\section{Discussion}

Interpret your findings here. Discuss limitations and implications for future work.

% --- Conclusion ---
\\section{Conclusion}

Summarize the key contributions of your paper.

% --- Bibliography ---
\\bibliographystyle{plainnat}
\\bibliography{references}

\\end{document}`;

const STARTER_BIB = `@article{smith2023,
  author  = {Smith, Alice and Lee, Brian},
  title   = {A Novel Framework for Collaborative Document Editing},
  journal = {Journal of Scientific Computing},
  year    = {2023},
  volume  = {45},
  number  = {2},
  pages   = {112--130},
  doi     = {10.1000/example.2023.001}
}

@book{doe2022,
  author    = {Doe, Jane},
  title     = {Foundations of Typesetting and Document Preparation},
  publisher = {Academic Press},
  year      = {2022},
  edition   = {3rd},
  address   = {New York}
}

@inproceedings{johnson2021,
  author    = {Johnson, Carlos and Patel, Deepa},
  title     = {Real-Time Synchronization in Web-Based Editors},
  booktitle = {Proceedings of the International Conference on Software Engineering},
  year      = {2021},
  pages     = {88--95},
  publisher = {ACM},
  doi       = {10.1000/example.2021.045}
}
`;

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

  await addDoc(collection(db, 'projects', projectRef.id, 'files'), {
    name: 'references.bib',
    type: 'tex',
    content: STARTER_BIB,
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
