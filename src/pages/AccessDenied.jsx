import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginWithGoogle } from '../firebase/auth.js';

export default function AccessDenied() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function handleTryAgain() {
    setError('');
    setLoading(true);
    try {
      await loginWithGoogle();
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="access-denied-page">
      <div className="access-denied-card">
        <div className="access-denied-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#e57373" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
        </div>
        <h1>Access Restricted</h1>
        <p className="access-denied-message">
          LaTeX Forge is available to users with Google-authenticated
          institutional email accounts.
        </p>

        <div className="access-denied-details">
          <h3>Supported accounts</h3>
          <ul>
            <li><strong>.edu</strong> accounts (US universities and colleges)</li>
            <li><strong>.ca</strong> accounts (Canadian institutions)</li>
            <li><strong>.ac.uk</strong> accounts (UK universities)</li>
            <li><strong>.edu.xx</strong> accounts (international academic — .edu.br, .edu.mx, .edu.ar, .edu.eu, etc.)</li>
            <li><strong>.org</strong> accounts (research organizations, nonprofits)</li>
            <li>Personal accounts added by an administrator</li>
          </ul>
        </div>

        <div className="access-denied-details">
          <h3>Need access with a personal account?</h3>
          <p>
            If your organization uses Google Workspace but not a .edu or .org domain,
            or if you need individual access, please{' '}
            <a href="https://github.com/mmann1123/latexforge/issues" target="_blank" rel="noopener noreferrer">
              open an issue on GitHub
            </a>{' '}
            with your email address and we will review your request.
          </p>
        </div>

        {error && <div className="auth-error" style={{ marginTop: 16 }}>{error}</div>}

        <div className="access-denied-actions">
          <button onClick={handleTryAgain} className="btn btn-google" disabled={loading}>
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            {loading ? 'Signing in...' : 'Try a different account'}
          </button>
          <a href="/login" className="access-denied-back">Back to home</a>
        </div>
      </div>
    </div>
  );
}
