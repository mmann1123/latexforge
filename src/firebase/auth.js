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

const ALLOWED_EMAILS = ['mmann1123@gmail.com'];

function checkAllowedEmail(email) {
  if (!ALLOWED_EMAILS.includes(email.toLowerCase())) {
    throw new Error('Access denied. This app is restricted to authorized users only.');
  }
}

export async function registerWithEmail(email, password, displayName) {
  checkAllowedEmail(email);
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
  checkAllowedEmail(email);
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
}

export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  const userCredential = await signInWithPopup(auth, provider);
  const user = userCredential.user;
  checkAllowedEmail(user.email);

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
