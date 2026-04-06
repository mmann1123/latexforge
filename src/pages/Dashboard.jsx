import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { getProjects, getSharedProjects, getDeletedProjects, createProject, createFile, deleteProject, restoreProject, permanentlyDeleteProject } from '../firebase/firestore.js';
import { uploadFile } from '../firebase/storage.js';
import { getPendingInvitations, acceptInvitation, declineInvitation } from '../firebase/sharing.js';
import { logout } from '../firebase/auth.js';

function generatePlaceholderPng() {
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 200;
  const ctx = canvas.getContext('2d');
  // Light gray background
  ctx.fillStyle = '#e8e8e8';
  ctx.fillRect(0, 0, 400, 200);
  // Border
  ctx.strokeStyle = '#bbb';
  ctx.lineWidth = 2;
  ctx.strokeRect(4, 4, 392, 192);
  // Icon (simple image placeholder)
  ctx.fillStyle = '#999';
  ctx.beginPath();
  ctx.moveTo(170, 100);
  ctx.lineTo(200, 70);
  ctx.lineTo(230, 100);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(180, 100, 40, 30);
  // Text
  ctx.fillStyle = '#888';
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Sample Figure', 200, 160);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [sharedProjects, setSharedProjects] = useState([]);
  const [deletedProjects, setDeletedProjects] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadProjects() {
    if (!user) return;
    setLoading(true);
    try {
      const [ownedResult, sharedResult, pendingResult, deletedResult] = await Promise.allSettled([
        getProjects(user.uid),
        getSharedProjects(user.uid),
        getPendingInvitations(user.email),
        getDeletedProjects(user.uid),
      ]);
      setProjects(ownedResult.status === 'fulfilled' ? ownedResult.value : []);
      setSharedProjects(sharedResult.status === 'fulfilled' ? sharedResult.value : []);
      setInvitations(pendingResult.status === 'fulfilled' ? pendingResult.value : []);
      setDeletedProjects(deletedResult.status === 'fulfilled' ? deletedResult.value : []);
      if (ownedResult.status === 'rejected') console.error('Error loading owned projects:', ownedResult.reason);
      if (sharedResult.status === 'rejected') console.error('Error loading shared projects:', sharedResult.reason);
      if (pendingResult.status === 'rejected') console.error('Error loading invitations:', pendingResult.reason);
    } catch (err) {
      console.error('Error loading projects:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProjects();
  }, [user]);

  async function handleNewProject() {
    const name = window.prompt('Project name:', 'My LaTeX Project');
    if (!name || !name.trim()) return;
    try {
      const projectId = await createProject(user.uid, name.trim());
      // Upload placeholder image to figures/ folder
      try {
        const blob = await generatePlaceholderPng();
        const file = new File([blob], 'example.png', { type: 'image/png' });
        await uploadFile(projectId, file, 'figures/');
        await createFile(projectId, 'figures/example.png', 'binary', '');
      } catch (imgErr) {
        console.warn('Could not create placeholder image:', imgErr);
      }
      navigate(`/project/${projectId}`);
    } catch (err) {
      console.error('Error creating project:', err);
      alert('Failed to create project.');
    }
  }

  async function handleDelete(projectId, projectName) {
    if (!window.confirm(`Move "${projectName}" to trash?`)) return;
    try {
      await deleteProject(projectId);
      let moved = null;
      setProjects((prev) => {
        moved = prev.find((p) => p.id === projectId);
        return prev.filter((p) => p.id !== projectId);
      });
      if (moved) setDeletedProjects((prev) => [{ ...moved, deletedAt: new Date() }, ...prev]);
    } catch (err) {
      console.error('Error deleting project:', err);
    }
  }

  async function handleRestore(projectId) {
    try {
      await restoreProject(projectId);
      await loadProjects();
    } catch (err) {
      console.error('Error restoring project:', err);
    }
  }

  async function handlePermanentDelete(projectId, projectName) {
    if (!window.confirm(`Permanently delete "${projectName}"? This cannot be undone.`)) return;
    try {
      await permanentlyDeleteProject(projectId);
      setDeletedProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch (err) {
      console.error('Error permanently deleting project:', err);
    }
  }

  async function handleAcceptInvitation(invitation) {
    try {
      await acceptInvitation(invitation.id, user.uid, user.email);
      await loadProjects();
    } catch (err) {
      console.error('Error accepting invitation:', err);
    }
  }

  async function handleDeclineInvitation(invitation) {
    try {
      await declineInvitation(invitation.id);
      setInvitations((prev) => prev.filter((i) => i.id !== invitation.id));
    } catch (err) {
      console.error('Error declining invitation:', err);
    }
  }

  function formatDate(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <h1>LaTeX Forge</h1>
        <div className="dashboard-header-right">
          <a
            href="https://github.com/mmann1123/latexforge/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline btn-icon"
            title="Report an issue"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
          </a>
          <span className="user-name">{user?.displayName || user?.email}</span>
          <button className="btn btn-outline" onClick={() => { logout(); navigate('/login'); }}>
            Sign Out
          </button>
        </div>
      </header>

      <main className="dashboard-content">
        {/* Pending invitations */}
        {invitations.length > 0 && (
          <div className="invitations-section">
            <h3>Pending Invitations</h3>
            {invitations.map((inv) => (
              <div key={inv.id} className="invitation-card">
                <span>
                  <strong>{inv.invitedByName || 'Someone'}</strong> invited you to <strong>{inv.projectName}</strong> as {inv.role}
                </span>
                <div className="invitation-actions">
                  <button className="btn btn-primary btn-sm" onClick={() => handleAcceptInvitation(inv)}>
                    Accept
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={() => handleDeclineInvitation(inv)}>
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="dashboard-top">
          <h2>Your Projects</h2>
          <button className="btn btn-primary" onClick={handleNewProject}>
            + New Project
          </button>
        </div>

        {loading ? (
          <div className="dashboard-loading">
            <div className="spinner"></div>
          </div>
        ) : projects.length === 0 ? (
          <div className="dashboard-empty">
            <p>No projects yet. Create your first LaTeX project!</p>
          </div>
        ) : (
          <div className="project-grid">
            {projects.map((p) => (
              <div key={p.id} className="project-card">
                <div className="project-card-body">
                  <h3>{p.name}</h3>
                  <span className="project-date">{formatDate(p.updatedAt)}</span>
                </div>
                <div className="project-card-actions">
                  <button className="btn btn-primary btn-sm" onClick={() => navigate(`/project/${p.id}`)}>
                    Open
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id, p.name)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Shared with me */}
        {sharedProjects.length > 0 && (
          <>
            <div className="dashboard-top" style={{ marginTop: '2rem' }}>
              <h2>Shared with Me</h2>
            </div>
            <div className="project-grid">
              {sharedProjects.map((p) => (
                <div key={p.id} className="project-card project-card-shared">
                  <div className="project-card-body">
                    <h3>{p.name}</h3>
                    <span className="project-date">{formatDate(p.updatedAt)}</span>
                    <span className="project-role">{p.collaborators?.[user?.uid] || 'viewer'}</span>
                  </div>
                  <div className="project-card-actions">
                    <button className="btn btn-primary btn-sm" onClick={() => navigate(`/project/${p.id}`)}>
                      Open
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Trash */}
        {deletedProjects.length > 0 && (
          <>
            <div className="dashboard-top" style={{ marginTop: '2rem' }}>
              <h2>Trash</h2>
            </div>
            <div className="project-grid">
              {deletedProjects.map((p) => (
                <div key={p.id} className="project-card project-card-deleted">
                  <div className="project-card-body">
                    <h3>{p.name}</h3>
                    <span className="project-date">Deleted {formatDate(p.deletedAt)}</span>
                  </div>
                  <div className="project-card-actions">
                    <button className="btn btn-primary btn-sm" onClick={() => handleRestore(p.id)}>
                      Restore
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handlePermanentDelete(p.id, p.name)}>
                      Delete Forever
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      <div className="share-banner">
        <span className="share-banner-text">
          Enjoying LaTeX Forge? Invite your colleagues to collaborate!
        </span>
        <button
          className="btn btn-share-banner"
          onClick={() => navigate('/invite')}
        >
          Share LaTeX Forge
        </button>
      </div>
    </div>
  );
}
