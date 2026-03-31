import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  deleteField,
  serverTimestamp,
  query,
  where,
} from 'firebase/firestore';
import { db } from './config.js';

/**
 * Invite a collaborator by email. Creates an invitation doc and sends an email.
 */
export async function inviteCollaborator(projectId, projectName, invitedEmail, role, invitedByUser) {
  const email = invitedEmail.toLowerCase();
  const inviterName = invitedByUser.displayName || invitedByUser.email;
  const assignedRole = role || 'editor';

  // Create invitation
  const invRef = await addDoc(collection(db, 'invitations'), {
    projectId,
    projectName,
    invitedEmail: email,
    invitedBy: invitedByUser.uid,
    invitedByName: inviterName,
    role: assignedRole,
    status: 'pending',
    createdAt: serverTimestamp(),
  });

  // Send invitation email via Firebase Trigger Email extension
  const acceptUrl = `https://latexforge.web.app/accept-invite/${invRef.id}`;
  await addDoc(collection(db, 'mail'), {
    to: email,
    message: {
      subject: `You've been invited to collaborate on "${projectName}"`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #333; margin-bottom: 16px;">You're invited to collaborate!</h2>
          <p style="color: #555; font-size: 15px; line-height: 1.5;">
            <strong>${inviterName}</strong> invited you to collaborate on
            <strong>${projectName}</strong> on LaTeX Forge.
          </p>
          <p style="color: #555; font-size: 15px;">Role: <strong>${assignedRole}</strong></p>
          <div style="margin: 28px 0;">
            <a href="${acceptUrl}"
               style="display: inline-block; padding: 12px 28px; background: #4caf50;
                      color: #fff; text-decoration: none; border-radius: 6px;
                      font-size: 15px; font-weight: 600;">
              Accept Invitation
            </a>
          </div>
          <p style="color: #999; font-size: 13px;">
            LaTeX Forge is a free, open-source alternative to Overleaf.
            If you don't have an account yet, sign in with your .edu or .org Google account.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin-top: 32px;" />
          <p style="color: #bbb; font-size: 12px;">
            LaTeX Forge — Free collaborative LaTeX editing
          </p>
        </div>
      `,
    },
  });

  return invRef.id;
}

/**
 * Send a welcome email inviting someone to try LaTeX Forge (not tied to a project).
 */
export async function sendWelcomeInvite(email, invitedByUser) {
  const cleaned = email.toLowerCase();
  const inviterName = invitedByUser.displayName || invitedByUser.email;
  await addDoc(collection(db, 'mail'), {
    to: cleaned,
    message: {
      subject: `${inviterName} invited you to try LaTeX Forge — a free Overleaf alternative`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #333; margin-bottom: 16px;">You're invited to LaTeX Forge!</h2>
          <p style="color: #555; font-size: 15px; line-height: 1.5;">
            <strong>${inviterName}</strong> thinks you'd enjoy <strong>LaTeX Forge</strong> —
            a free, open-source alternative to Overleaf for writing and collaborating on LaTeX documents.
          </p>
          <p style="color: #555; font-size: 15px; line-height: 1.5;">
            Edit LaTeX in your browser with real-time collaboration, instant PDF preview,
            multi-file project support, and BibTeX integration — no subscription required.
          </p>
          <p style="color: #999; font-size: 13px;">
            Sign in with your .edu or .org Google account to get started.
          </p>
          <div style="margin: 28px 0;">
            <a href="https://latexforge.web.app"
               style="display: inline-block; padding: 12px 28px; background: #2979ff;
                      color: #fff; text-decoration: none; border-radius: 6px;
                      font-size: 15px; font-weight: 600;">
              Get Started — It's Free
            </a>
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin-top: 32px;" />
          <p style="color: #bbb; font-size: 12px;">
            LaTeX Forge — Free collaborative LaTeX editing
          </p>
        </div>
      `,
    },
  });
}

/**
 * Get a single invitation by ID.
 */
export async function getInvitation(invitationId) {
  const snap = await getDoc(doc(db, 'invitations', invitationId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
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
