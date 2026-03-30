import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { storage } from './config.js';

export async function uploadFile(projectId, file) {
  const storagePath = `projects/${projectId}/${file.name}`;
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
