import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/config.js';
import { getAuthCheckPromise } from '../firebase/auth.js';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const checkPromise = getAuthCheckPromise();
        if (checkPromise) {
          // A login is in progress — wait for the permission check
          const result = await checkPromise;
          if (!result.permitted) {
            // User will be signed out shortly; don't update state
            return;
          }
        }
      }
      setUser(firebaseUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return { user, loading };
}
