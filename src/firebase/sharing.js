import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  deleteField,
  arrayUnion,
  serverTimestamp,
  query,
  where,
  setDoc,
} from 'firebase/firestore';
import { db } from './config.js';

/**
 * Invite a collaborator by email. Creates an invitation doc and
 * auto-adds the email to the Firestore allowlist so they can register.
 */
export async function inviteCollaborator(projectId, projectName, invitedEmail, role, invitedByUser) {
  // Create invitation
  const invRef = await addDoc(collection(db, 'invitations'), {
    projectId,
    projectName,
    invitedEmail: invitedEmail.toLowerCase(),
    invitedBy: invitedByUser.uid,
    invitedByName: invitedByUser.displayName || invitedByUser.email,
    role: role || 'editor',
    status: 'pending',
    createdAt: serverTimestamp(),
  });

  // Auto-add email to Firestore allowlist
  await addToAllowlist(invitedEmail.toLowerCase());

  return invRef.id;
}

/**
 * Get pending invitations for a given email.
 */
export async function getPendingInvitations(email) {
  if (!email) return [];
  const q = query(
    collection(db, 'invitations'),
    where('invitedEmail', '==', email.toLowerCase()),
    where('status', '==', 'pending')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Accept an invitation: add the user as a collaborator on the project.
 * Verifies the caller's email matches the invitation's invitedEmail.
 */
export async function acceptInvitation(invitationId, userId, userEmail) {
  const invDoc = await getDoc(doc(db, 'invitations', invitationId));
  if (!invDoc.exists()) throw new Error('Invitation not found');

  const inv = invDoc.data();

  // Verify the caller is the intended invitee
  if (inv.invitedEmail !== userEmail.toLowerCase()) {
    throw new Error('This invitation is not for your account.');
  }

  // Add user to project collaborators map
  const projectRef = doc(db, 'projects', inv.projectId);
  await updateDoc(projectRef, {
    [`collaborators.${userId}`]: inv.role,
  });

  // Mark invitation as accepted
  await updateDoc(doc(db, 'invitations', invitationId), {
    status: 'accepted',
  });
}

/**
 * Decline an invitation.
 */
export async function declineInvitation(invitationId) {
  await updateDoc(doc(db, 'invitations', invitationId), {
    status: 'declined',
  });
}

/**
 * Remove a collaborator from a project.
 */
export async function removeCollaborator(projectId, userId) {
  const projectRef = doc(db, 'projects', projectId);
  await updateDoc(projectRef, {
    [`collaborators.${userId}`]: deleteField(),
  });
}

/**
 * Get the collaborators list for a project (from the project doc).
 */
export async function getCollaborators(projectId) {
  const snap = await getDoc(doc(db, 'projects', projectId));
  if (!snap.exists()) return {};
  return snap.data().collaborators || {};
}

/**
 * Get sent invitations for a project (to show in share dialog).
 */
export async function getProjectInvitations(projectId) {
  const q = query(
    collection(db, 'invitations'),
    where('projectId', '==', projectId),
    where('status', '==', 'pending')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Cancel a pending invitation.
 */
export async function cancelInvitation(invitationId) {
  await deleteDoc(doc(db, 'invitations', invitationId));
}

// ── Allowlist management ─────────────────────────────────────

const ALLOWLIST_DOC = doc(db, 'config', 'allowedEmails');

/**
 * Add an email to the Firestore-based allowlist.
 */
async function addToAllowlist(email) {
  try {
    const snap = await getDoc(ALLOWLIST_DOC);
    if (snap.exists()) {
      // Use arrayUnion to avoid race conditions with concurrent invitations
      await updateDoc(ALLOWLIST_DOC, {
        emails: arrayUnion(email),
      });
    } else {
      await setDoc(ALLOWLIST_DOC, { emails: [email] });
    }
  } catch (err) {
    console.warn('Error updating allowlist:', err);
  }
}

/**
 * Check if an email is in the Firestore allowlist.
 */
export async function isEmailAllowed(email) {
  try {
    const snap = await getDoc(ALLOWLIST_DOC);
    if (!snap.exists()) return false;
    const emails = snap.data().emails || [];
    return emails.includes(email.toLowerCase());
  } catch {
    return false;
  }
}
