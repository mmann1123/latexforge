import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { getProjects, getSharedProjects, createProject, deleteProject } from '../firebase/firestore.js';
import { getPendingInvitations, acceptInvitation, declineInvitation } from '../firebase/sharing.js';
import { logout } from '../firebase/auth.js';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [sharedProjects, setSharedProjects] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadProjects() {
    if (!user) return;
    setLoading(true);
    try {
      const [owned, shared, pending] = await Promise.all([
        getProjects(user.uid),
        getSharedProjects(user.uid),
        getPendingInvitations(user.email),
      ]);
      setProjects(owned);
      setSharedProjects(shared);
      setInvitations(pending);
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
      navigate(`/project/${projectId}`);
    } catch (err) {
      console.error('Error creating project:', err);
      alert('Failed to create project.');
    }
  }

  async function handleDelete(projectId, projectName) {
    if (!window.confirm(`Delete "${projectName}"? This cannot be undone.`)) return;
    try {
      await deleteProject(projectId);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch (err) {
      console.error('Error deleting project:', err);
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
      </main>
    </div>
  );
}
