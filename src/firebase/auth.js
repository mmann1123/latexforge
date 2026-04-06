import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './config.js';

// Auth gate — lets useAuth know a permission check is in progress
let _authResolve = null;
let _authCheckPromise = null;
export function getAuthCheckPromise() { return _authCheckPromise; }

// Admin email — always permitted regardless of domain
const ADMIN_EMAILS = ['mmann1123@gmail.com'];

// Allowed domain suffixes (academic and nonprofit institutions)
const ALLOWED_DOMAIN_SUFFIXES = [
  // US / general
  '.edu', '.org',
  // Canada (no .edu.ca exists; universities use plain .ca, restricted to Canadian entities by CIRA)
  '.ca',
  // UK
  '.ac.uk',
  // Europe
  '.edu.eu', '.edu.es', '.edu.pt',
  // Latin America
  '.edu.br', '.edu.mx', '.edu.ar', '.edu.co', '.edu.pe',
  // Other academic (Asia, Oceania, Africa)
  '.ac.nz', '.ac.au', '.ac.in', '.ac.jp', '.ac.za', '.ac.at', '.ac.be',
];

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
  provider.setCustomParameters({ prompt: 'select_account' });

  _authCheckPromise = new Promise((resolve) => { _authResolve = resolve; });

  try {
    const userCredential = await signInWithPopup(auth, provider);
    const user = userCredential.user;

    const permitted = await isEmailPermitted(user.email);
    if (!permitted) {
      _authResolve({ permitted: false });
      await signOut(auth);
      throw new Error(
        'Access is limited to academic and nonprofit Google accounts (.edu, .ac.uk, .ca, .org, and more). Contact the admin if you need access.'
      );
    }

    _authResolve({ permitted: true });

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
  } finally {
    // Safety net: ensure the gate is always resolved and cleared
    if (_authResolve) _authResolve({ permitted: false });
    _authCheckPromise = null;
    _authResolve = null;
  }
}

export async function logout() {
  await signOut(auth);
}
