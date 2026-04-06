import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { loginWithGoogle } from '../firebase/auth.js';

export default function Login() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const invitation = searchParams.get('invitation');

  async function handleGoogle() {
    setError('');
    setLoading(true);
    try {
      await loginWithGoogle();
      if (invitation) {
        navigate(`/accept-invite/${invitation}`, { replace: true });
      } else {
        navigate('/');
      }
    } catch (err) {
      if (err.message?.includes('Access is limited to')) {
        navigate('/access-denied', { replace: true });
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  const googleIcon = (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );

  return (
    <div className="landing-page">
      {/* Hero */}
      <header className="landing-hero">
        <nav className="landing-nav">
          <div className="landing-logo">LaTeX Forge</div>
        </nav>
        <div className="landing-hero-content">
          <h1>Write LaTeX Together</h1>
          <p className="landing-subtitle">
            A lightweight, collaborative LaTeX editor with real-time editing,
            instant PDF preview, and cloud-based compilation. No install required.
          </p>
          <div className="landing-cta">
            {error && <div className="auth-error" style={{ marginBottom: 12, maxWidth: 400 }}>{error}</div>}
            {invitation && (
              <div className="auth-info" style={{ marginBottom: 12, maxWidth: 400 }}>Sign in to accept your collaboration invitation.</div>
            )}
            <button onClick={handleGoogle} className="btn btn-google btn-hero" disabled={loading}>
              {googleIcon}
              {loading ? 'Signing in...' : 'Get Started with Google'}
            </button>
            <p className="landing-access-note">
              Available for academic and nonprofit Google accounts (.edu, .ac.uk, .ca, .org, and more).
            </p>
          </div>
        </div>
      </header>

      {/* Features */}
      <section className="landing-features">
        <h2 className="landing-section-title">Everything you need to write LaTeX</h2>
        <div className="landing-features-grid">
          <div className="landing-feature">
            <div className="landing-feature-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <h3>Real-Time Collaboration</h3>
            <p>Edit documents simultaneously with your co-authors. See cursors, selections, and changes as they happen.</p>
          </div>

          <div className="landing-feature">
            <div className="landing-feature-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </div>
            <h3>Instant PDF Preview</h3>
            <p>Compile your LaTeX and see the PDF output right in the browser. Full pdflatex and BibTeX support included.</p>
          </div>

          <div className="landing-feature">
            <div className="landing-feature-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <h3>Multi-File Projects</h3>
            <p>Organize your work with folders, multiple .tex files, images, and BibTeX bibliographies all in one project.</p>
          </div>

          <div className="landing-feature">
            <div className="landing-feature-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6"/>
                <polyline points="8 6 2 12 8 18"/>
              </svg>
            </div>
            <h3>Smart Editor</h3>
            <p>Syntax highlighting, LaTeX autocompletion, spell checking, and a document outline to navigate large files.</p>
          </div>

          <div className="landing-feature">
            <div className="landing-feature-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <h3>Inline Comments</h3>
            <p>Leave comments on specific lines for your collaborators. Resolve them when done — just like a code review.</p>
          </div>

          <div className="landing-feature">
            <div className="landing-feature-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <h3>Secure & Private</h3>
            <p>Email allowlist, Firebase authentication, and per-project access controls keep your work safe.</p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="landing-how">
        <h2 className="landing-section-title">Get started in seconds</h2>
        <div className="landing-steps">
          <div className="landing-step">
            <div className="landing-step-num">1</div>
            <h3>Sign in</h3>
            <p>Use your .edu or .org Google account</p>
          </div>
          <div className="landing-step-arrow">&#8594;</div>
          <div className="landing-step">
            <div className="landing-step-num">2</div>
            <h3>Create a project</h3>
            <p>Start from a template or blank document</p>
          </div>
          <div className="landing-step-arrow">&#8594;</div>
          <div className="landing-step">
            <div className="landing-step-num">3</div>
            <h3>Write & compile</h3>
            <p>Edit LaTeX and see your PDF instantly</p>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="landing-bottom-cta">
        <h2>Ready to write?</h2>
        <button onClick={handleGoogle} className="btn btn-google btn-hero" disabled={loading}>
          {googleIcon}
          {loading ? 'Signing in...' : 'Sign in with Google'}
        </button>
      </section>

      <footer className="landing-footer">
        <p>LaTeX Forge &mdash; A lightweight alternative to Overleaf for teams and classrooms.</p>
      </footer>
    </div>
  );
}
