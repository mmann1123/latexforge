import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './config.js';
import { isEmailAllowed } from './sharing.js';

// Hardcoded base allowlist — always permitted
const ALLOWED_EMAILS = ['mmann1123@gmail.com'];

/**
 * Check if an email is allowed to use the app.
 * Checks both the hardcoded list and the Firestore-based allowlist
 * (where invited collaborators get auto-added).
 */
async function checkAllowedEmail(email) {
  const lower = email.toLowerCase();
  if (ALLOWED_EMAILS.includes(lower)) return;

  // Check Firestore allowlist (populated when collaborators are invited)
  const allowed = await isEmailAllowed(lower);
  if (allowed) return;

  throw new Error('Access denied. This app is restricted to authorized users only.');
}

export async function registerWithEmail(email, password, displayName) {
  await checkAllowedEmail(email);
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  await updateProfile(user, { displayName });

  await setDoc(doc(db, 'users', user.uid), {
    uid: user.uid,
    email: user.email,
    displayName: displayName,
    createdAt: serverTimestamp(),
  });

  return user;
}

export async function loginWithEmail(email, password) {
  await checkAllowedEmail(email);
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
}

export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  const userCredential = await signInWithPopup(auth, provider);
  const user = userCredential.user;
  await checkAllowedEmail(user.email);

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
