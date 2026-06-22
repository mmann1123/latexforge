import {
  collection,
  doc,
  addDoc,
  setDoc,
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
 * Extract the base-domain form of an email: strip subdomains down to the
 * last two parts.  e.g. foo@gwmail.gwu.edu → foo@gwu.edu,
 * foo@email.harvard.edu → foo@harvard.edu.  If the domain already has
 * only two parts (foo@gwu.edu) it is returned as-is.
 */
export function baseDomainEmail(email) {
  const lower = email.toLowerCase();
  const [user, domain] = lower.split('@');
  if (!domain) return lower;
  const parts = domain.split('.');
  if (parts.length <= 2) return lower;
  return `${user}@${parts.slice(-2).join('.')}`;
}

/**
 * Check whether two emails refer to the same person by comparing their
 * username and base domain.
 */
export function emailsMatch(a, b) {
  return baseDomainEmail(a) === baseDomainEmail(b);
}

/**
 * Recover the invited (base-domain) email from a deterministic invitation ID
 * of the form `baseDomain(email)_projectId`. Firestore auto-IDs contain no
 * underscore, so the invited email is everything before the last underscore.
 * Returns '' for legacy random IDs that don't follow this scheme.
 */
export function invitedEmailFromId(invitationId) {
  if (!invitationId) return '';
  const sep = invitationId.lastIndexOf('_');
  if (sep <= 0) return '';
  return invitationId.slice(0, sep);
}

/**
 * Invite a collaborator by email. Creates an invitation doc and sends an email.
 */
export async function inviteCollaborator(projectId, projectName, invitedEmail, role, invitedByUser) {
  const email = invitedEmail.toLowerCase();
  const inviterName = invitedByUser.displayName || invitedByUser.email;
  const assignedRole = role || 'editor';

  // Create invitation with a deterministic ID (baseDomain(email)_projectId) so
  // it is bound to one person + one project. Firestore rules verify this ID
  // before letting the invitee add themselves to the project. setDoc (not
  // addDoc) means re-inviting the same person overwrites rather than duplicates.
  const invitationId = `${baseDomainEmail(email)}_${projectId}`;
  await setDoc(doc(db, 'invitations', invitationId), {
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
  const acceptUrl = `https://latexforge.web.app/accept-invite/${encodeURIComponent(invitationId)}`;
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

  return invitationId;
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
  const lower = email.toLowerCase();
  const base = baseDomainEmail(lower);

  // Query for the exact email
  const q = query(
    collection(db, 'invitations'),
    where('invitedEmail', '==', lower),
    where('status', '==', 'pending')
  );
  const snapshot = await getDocs(q);
  const results = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

  // If the base domain differs, also query for that variant
  if (base !== lower) {
    const q2 = query(
      collection(db, 'invitations'),
      where('invitedEmail', '==', base),
      where('status', '==', 'pending')
    );
    const snapshot2 = await getDocs(q2);
    const extra = snapshot2.docs.map((d) => ({ id: d.id, ...d.data() }));
    // Deduplicate by id
    const seen = new Set(results.map((r) => r.id));
    for (const inv of extra) {
      if (!seen.has(inv.id)) results.push(inv);
    }
  }

  return results;
}

/**
 * Accept an invitation: add the user as a collaborator on the project.
 * Verifies the caller's email matches the invitation's invitedEmail.
 */
export async function acceptInvitation(invitationId, userId, userEmail) {
  const invDoc = await getDoc(doc(db, 'invitations', invitationId));
  if (!invDoc.exists()) throw new Error('Invitation not found');

  const inv = invDoc.data();

  // Verify the caller is the intended invitee (flexible base-domain match)
  if (!emailsMatch(inv.invitedEmail, userEmail)) {
    throw new Error('This invitation is not for your account.');
  }

  // Add user to project collaborators map
  const projectRef = doc(db, 'projects', inv.projectId);
  await updateDoc(projectRef, {
    [`collaborators.${userId}`]: inv.role,
  });

  // Mark invitation as accepted, recording which uid accepted it so the share
  // dialog can map the collaborator uid back to a human-readable email.
  await updateDoc(doc(db, 'invitations', invitationId), {
    status: 'accepted',
    acceptedBy: userId,
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
 * Resolve a list of user uids to their profile info ({ email, displayName }),
 * read from the users/{uid} docs written at login. Used by the share dialog to
 * display collaborators by email/name instead of raw uid. Missing or
 * unreadable profiles are skipped.
 */
export async function getUserProfiles(uids) {
  const entries = await Promise.all(
    uids.map(async (uid) => {
      try {
        const snap = await getDoc(doc(db, 'users', uid));
        if (!snap.exists()) return null;
        const data = snap.data();
        return [uid, { email: data.email || '', displayName: data.displayName || '' }];
      } catch {
        return null;
      }
    })
  );
  return Object.fromEntries(entries.filter(Boolean));
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
 * Get all invitations for a project (to show in the share dialog). Includes
 * pending ones (shown as "Pending Invitations") and accepted ones (used to
 * resolve a collaborator's uid back to their email for display).
 */
export async function getProjectInvitations(projectId) {
  const q = query(
    collection(db, 'invitations'),
    where('projectId', '==', projectId)
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
