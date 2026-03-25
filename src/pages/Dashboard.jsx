import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { getProjects, createProject, deleteProject } from '../firebase/firestore.js';
import { logout } from '../firebase/auth.js';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadProjects() {
    if (!user) return;
    setLoading(true);
    try {
      setProjects(await getProjects(user.uid));
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
      await deleteProject(user.uid, projectId);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch (err) {
      console.error('Error deleting project:', err);
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
      </main>
    </div>
  );
}
