import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { getInvitation, acceptInvitation, emailsMatch, invitedEmailFromId } from '../firebase/sharing.js';
import { loginWithGoogle } from '../firebase/auth.js';

export default function AcceptInvite() {
  const { invitationId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // loading | accepting | error | mismatch
  const [error, setError] = useState('');
  const [mismatch, setMismatch] = useState({ invited: '', current: '' });
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      // Not logged in — redirect to login with the invitation so the login
      // screen can pre-suggest the invited Google account.
      navigate(`/login?invitation=${encodeURIComponent(invitationId)}`, { replace: true });
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

        // Signed in with the wrong Google account — guide them to switch
        // instead of dead-ending on a "not for your account" error.
        if (!emailsMatch(invitation.invitedEmail, user.email)) {
          setMismatch({ invited: invitation.invitedEmail, current: user.email });
          setStatus('mismatch');
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

  // Open the Google account chooser in place so the user can pick the account
  // the invite was actually sent to. Once a new account is selected, the auth
  // state changes and the effect above re-runs the accept flow automatically.
  async function chooseAnotherAccount() {
    setSwitching(true);
    setError('');
    try {
      await loginWithGoogle(invitedEmailFromId(invitationId));
      setStatus('accepting'); // show spinner until the effect re-runs
    } catch (err) {
      if (err.message?.includes('Access is limited to')) {
        navigate('/access-denied', { replace: true });
      } else {
        setError(err.message);
        setStatus('error');
      }
    } finally {
      setSwitching(false);
    }
  }

  if (authLoading || status === 'loading' || status === 'accepting') {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>{status === 'accepting' ? 'Accepting invitation...' : 'Loading...'}</p>
      </div>
    );
  }

  if (status === 'mismatch') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1 className="auth-title">LaTeX Forge</h1>
          <h2>Wrong account</h2>
          <p className="auth-info">
            This invitation was sent to <strong>{mismatch.invited}</strong>, but
            you're signed in as <strong>{mismatch.current}</strong>.
          </p>
          <button className="btn btn-primary" onClick={chooseAnotherAccount} disabled={switching}>
            {switching ? 'Opening account chooser...' : 'Use a different account'}
          </button>
          <button
            className="btn btn-secondary"
            style={{ marginTop: 8 }}
            onClick={() => navigate('/')}
            disabled={switching}
          >
            Go to Dashboard
          </button>
        </div>
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
