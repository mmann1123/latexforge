import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './config.js';

// Admin email — always permitted regardless of domain
const ADMIN_EMAILS = ['mmann1123@gmail.com'];

// Allowed top-level domain suffixes
const ALLOWED_DOMAIN_SUFFIXES = ['.edu', '.org'];

/**
 * Check if an email is permitted to use the app.
 * Checks: admin list → domain suffix → Firestore exceptions list.
 */
export async function isEmailPermitted(email) {
  const lower = email.toLowerCase();

  // Admin bypass
  if (ADMIN_EMAILS.includes(lower)) return true;

  // Domain check
  const domain = lower.split('@')[1];
  if (domain && ALLOWED_DOMAIN_SUFFIXES.some((suffix) => domain.endsWith(suffix))) return true;

  // Firestore exceptions list
  try {
    const snap = await getDoc(doc(db, 'config', 'allowedEmails'));
    if (snap.exists()) {
      const emails = snap.data().emails || [];
      if (emails.includes(lower)) return true;
    }
  } catch {
    // Firestore unavailable — fall through to deny
  }

  return false;
}

export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  const userCredential = await signInWithPopup(auth, provider);
  const user = userCredential.user;

  const permitted = await isEmailPermitted(user.email);
  if (!permitted) {
    await signOut(auth);
    throw new Error(
      'Access is limited to .edu and .org Google accounts. Contact the admin if you need access.'
    );
  }

  await setDoc(
    doc(db, 'users', user.uid),
    {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || '',
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );

  return user;
}

export async function logout() {
  await signOut(auth);
}
