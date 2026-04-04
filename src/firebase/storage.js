import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { storage } from './config.js';

export async function uploadFile(projectId, file, folderPrefix = '') {
  const storagePath = `projects/${projectId}/${folderPrefix}${file.name}`;
  const storageRef = ref(storage, storagePath);
  const snapshot = await uploadBytes(storageRef, file);
  const downloadURL = await getDownloadURL(snapshot.ref);
  return { storagePath, downloadURL };
}

export async function getFileUrl(storagePath) {
  const storageRef = ref(storage, storagePath);
  return await getDownloadURL(storageRef);
}

export async function deleteStorageFile(storagePath) {
  const storageRef = ref(storage, storagePath);
  await deleteObject(storageRef);
}

/**
 * Save a compiled PDF (base64) to Firebase Storage for the project.
 */
export async function saveCompiledPdf(projectId, base64Pdf) {
  const storagePath = `projects/${projectId}/_compiled.pdf`;
  const storageRef = ref(storage, storagePath);
  const byteChars = atob(base64Pdf);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
  await uploadBytes(storageRef, bytes, { contentType: 'application/pdf' });
}

/**
 * Load the last compiled PDF from Firebase Storage as a base64 string.
 * Returns null if no compiled PDF exists.
 */
export async function loadCompiledPdf(projectId) {
  try {
    const storagePath = `projects/${projectId}/_compiled.pdf`;
    const storageRef = ref(storage, storagePath);
    const url = await getDownloadURL(storageRef);
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function getProjectFileAsBase64(projectId, fileName) {
  const storagePath = `projects/${projectId}/${fileName}`;
  const storageRef = ref(storage, storagePath);
  const url = await getDownloadURL(storageRef);
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.readAsDataURL(blob);
  });
}
