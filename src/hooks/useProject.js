import { useState, useEffect, useCallback } from 'react';
import { doc, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config.js';

export function useProject(projectId) {
  const [project, setProject] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);

    // Real-time listener on the project document
    const unsubProject = onSnapshot(
      doc(db, 'projects', projectId),
      (snap) => {
        if (snap.exists()) {
          setProject({ id: snap.id, ...snap.data() });
        } else {
          setProject(null);
        }
      },
      (err) => console.error('Error listening to project:', err)
    );

    // Real-time listener on the files subcollection
    const filesQuery = query(
      collection(db, 'projects', projectId, 'files'),
      orderBy('name', 'asc')
    );
    const unsubFiles = onSnapshot(
      filesQuery,
      (snapshot) => {
        const fileList = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setFiles(fileList);
        setLoading(false);
      },
      (err) => {
        console.error('Error listening to files:', err);
        setLoading(false);
      }
    );

    return () => {
      unsubProject();
      unsubFiles();
    };
  }, [projectId]);

  const reload = useCallback(() => {
    // With onSnapshot, reload is a no-op — data updates automatically.
    // Kept for API compatibility.
  }, []);

  return { project, files, loading, reload };
}
