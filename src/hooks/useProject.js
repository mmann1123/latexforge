import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { getFiles } from '../firebase/firestore.js';

export function useProject(userId, projectId) {
  const [project, setProject] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  async function reload() {
    if (!userId || !projectId) return;
    setLoading(true);
    try {
      const projectSnap = await getDoc(
        doc(db, 'users', userId, 'projects', projectId)
      );
      if (projectSnap.exists()) {
        setProject({ id: projectSnap.id, ...projectSnap.data() });
      }
      const fileList = await getFiles(userId, projectId);
      setFiles(fileList);
    } catch (err) {
      console.error('Error loading project:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, [userId, projectId]);

  return { project, files, loading, reload };
}
