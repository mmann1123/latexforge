import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { getInvitation, acceptInvitation } from '../firebase/sharing.js';

export default function AcceptInvite() {
  const { invitationId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // loading | accepting | error | done
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      // Not logged in — redirect to register with invitation param
      navigate(`/login?invitation=${invitationId}`, { replace: true });
      return;
    }

    // User is logged in — accept the invitation
    async function accept() {
      setStatus('accepting');
      try {
        const invitation = await getInvitation(invitationId);
        if (!invitation) {
          setError('Invitation not found. It may have been cancelled.');
          setStatus('error');
          return;
        }
        if (invitation.status === 'accepted') {
          // Already accepted — just redirect to the project
          navigate(`/project/${invitation.projectId}`, { replace: true });
          return;
        }
        if (invitation.status !== 'pending') {
          setError('This invitation has already been declined or is no longer valid.');
          setStatus('error');
          return;
        }

        await acceptInvitation(invitationId, user.uid, user.email);
        navigate(`/project/${invitation.projectId}`, { replace: true });
      } catch (err) {
        setError(err.message);
        setStatus('error');
      }
    }

    accept();
  }, [user, authLoading, invitationId, navigate]);

  if (authLoading || status === 'loading' || status === 'accepting') {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>{status === 'accepting' ? 'Accepting invitation...' : 'Loading...'}</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1 className="auth-title">LaTeX Forge</h1>
          <h2>Invitation Error</h2>
          <div className="auth-error">{error}</div>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return null;
}
