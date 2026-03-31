import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './config.js';

// Admin email — always permitted regardless of domain
const ADMIN_EMAILS = ['mmann1123@gmail.com'];

// Allowed top-level domain suffixes
const ALLOWED_DOMAIN_SUFFIXES = ['.edu', '.org'];

/**
 * Check if an email's domain is allowed.
 * Permits .edu and .org domains, plus admin emails.
 */
function checkAllowedDomain(email) {
  const lower = email.toLowerCase();
  if (ADMIN_EMAILS.includes(lower)) return;

  const domain = lower.split('@')[1];
  if (domain && ALLOWED_DOMAIN_SUFFIXES.some((suffix) => domain.endsWith(suffix))) return;

  throw new Error(
    'Access is limited to .edu and .org Google accounts. Contact the admin if you need access.'
  );
}

export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  const userCredential = await signInWithPopup(auth, provider);
  const user = userCredential.user;
  checkAllowedDomain(user.email);

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
