import React, { useState, useEffect } from 'react';
import {
  inviteCollaborator,
  getCollaborators,
  getProjectInvitations,
  removeCollaborator,
  cancelInvitation,
} from '../firebase/sharing.js';
import { useAuth } from '../hooks/useAuth.js';

export default function ShareDialog({ projectId, project, onClose }) {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('editor');
  const [collaborators, setCollaborators] = useState({});
  const [pendingInvites, setPendingInvites] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, [projectId]);

  async function loadData() {
    try {
      const [collabs, invites] = await Promise.all([
        getCollaborators(projectId),
        getProjectInvitations(projectId),
      ]);
      setCollaborators(collabs);
      setPendingInvites(invites);
    } catch (err) {
      console.error('Error loading share data:', err);
    }
  }

  async function handleInvite(e) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    if (trimmed === user.email.toLowerCase()) {
      setError("You can't invite yourself.");
      return;
    }
    const domain = trimmed.split('@')[1];
    if (!domain || !(domain.endsWith('.edu') || domain.endsWith('.org'))) {
      setError('Only .edu and .org email addresses can be invited.');
      return;
    }

    setSending(true);
    setError('');
    try {
      await inviteCollaborator(projectId, project?.name || 'Untitled', trimmed, role, user);
      setEmail('');
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  async function handleRemove(uid) {
    if (!window.confirm('Remove this collaborator?')) return;
    try {
      await removeCollaborator(projectId, uid);
      await loadData();
    } catch (err) {
      console.error('Error removing collaborator:', err);
    }
  }

  async function handleCancelInvite(invId) {
    try {
      await cancelInvitation(invId);
      await loadData();
    } catch (err) {
      console.error('Error canceling invitation:', err);
    }
  }

  const collabEntries = Object.entries(collaborators);

  return (
    <div className="share-dialog-overlay" onClick={onClose}>
      <div className="share-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="share-dialog-header">
          <h3>Share Project</h3>
          <button className="share-dialog-close" onClick={onClose}>&times;</button>
        </div>

        <form className="share-invite-form" onSubmit={handleInvite}>
          <input
            type="email"
            placeholder="Email address (.edu or .org)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </select>
          <button type="submit" className="btn btn-primary btn-sm" disabled={sending}>
            {sending ? 'Inviting...' : 'Invite'}
          </button>
        </form>

        {error && <p className="share-error">{error}</p>}

        {/* Current collaborators */}
        {collabEntries.length > 0 && (
          <div className="share-section">
            <h4>Collaborators</h4>
            {collabEntries.map(([uid, r]) => (
              <div key={uid} className="share-member">
                <span className="share-member-id">{uid}</span>
                <span className="share-member-role">{r}</span>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleRemove(uid)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Pending invitations */}
        {pendingInvites.length > 0 && (
          <div className="share-section">
            <h4>Pending Invitations</h4>
            {pendingInvites.map((inv) => (
              <div key={inv.id} className="share-member">
                <span className="share-member-id">{inv.invitedEmail}</span>
                <span className="share-member-role">{inv.role}</span>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => handleCancelInvite(inv.id)}
                >
                  Cancel
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
