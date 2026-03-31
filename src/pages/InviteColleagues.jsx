import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { sendWelcomeInvite } from '../firebase/sharing.js';

const ALLOWED_DOMAIN_SUFFIXES = ['.edu', '.org'];

function isAllowedDomain(email) {
  const domain = email.split('@')[1];
  return domain && ALLOWED_DOMAIN_SUFFIXES.some((suffix) => domain.endsWith(suffix));
}

/**
 * Parse a raw input string into email addresses.
 * Accepts: plain emails, "Name <email>" format, comma/newline/semicolon separated.
 */
function parseEmails(raw) {
  const entries = raw.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
  const emails = [];
  for (const entry of entries) {
    // Match "Name LastName <email@domain>" pattern
    const angleMatch = entry.match(/<([^>]+)>/);
    if (angleMatch) {
      emails.push(angleMatch[1].trim().toLowerCase());
    } else {
      // Treat the whole thing as an email if it looks like one
      const cleaned = entry.trim().toLowerCase();
      if (cleaned.includes('@')) {
        emails.push(cleaned);
      }
    }
  }
  // Deduplicate
  return [...new Set(emails)];
}

export default function InviteColleagues() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState(null);

  async function handleInvite(e) {
    e.preventDefault();
    const emails = parseEmails(input);
    if (emails.length === 0) return;

    // Filter out the current user
    const filtered = emails.filter((em) => em !== user.email.toLowerCase());
    if (filtered.length === 0) {
      setResults({ sent: [], rejected: [], failed: [] });
      return;
    }

    // Split into allowed and rejected domains
    const allowed = [];
    const rejected = [];
    for (const em of filtered) {
      if (isAllowedDomain(em)) {
        allowed.push(em);
      } else {
        rejected.push(em);
      }
    }

    setSending(true);
    setResults(null);

    const sent = [];
    const failed = [];

    for (const email of allowed) {
      try {
        await sendWelcomeInvite(email, user);
        sent.push(email);
      } catch (err) {
        failed.push(email);
        console.error(`Failed to invite ${email}:`, err);
      }
    }

    setResults({ sent, rejected, failed });
    setSending(false);
    if (sent.length > 0) setInput('');
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <h1 style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>LaTeX Forge</h1>
        <div className="dashboard-header-right">
          <span className="user-name">{user?.displayName || user?.email}</span>
          <button className="btn btn-outline" onClick={() => navigate('/')}>
            Back to Projects
          </button>
        </div>
      </header>

      <main className="invite-page-content">
        <h2>Invite Colleagues to LaTeX Forge</h2>
        <p className="invite-subtitle">
          Share LaTeX Forge with your colleagues! Only .edu and .org email addresses
          can be invited. Recipients will get an email with a link to sign in with Google.
        </p>

        <form className="invite-form" onSubmit={handleInvite}>
          <textarea
            className="invite-textarea"
            placeholder={"Paste .edu or .org email addresses here, one per line.\n\nAccepted formats:\n  jane@university.edu\n  John Smith <john@university.edu>\n  alice@lab.org, bob@lab.org"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={8}
          />
          <button
            type="submit"
            className="btn btn-invite-send"
            disabled={sending || !input.trim()}
          >
            {sending ? 'Sending Invites...' : `Invite Colleagues`}
          </button>
        </form>

        {results && (
          <div className="invite-results">
            {results.sent.length > 0 && (
              <div className="invite-result-success">
                <strong>Invited ({results.sent.length}):</strong>
                <ul>
                  {results.sent.map((em) => <li key={em}>{em}</li>)}
                </ul>
              </div>
            )}
            {results.rejected?.length > 0 && (
              <div className="invite-result-warning">
                <strong>Not invited ({results.rejected.length}) — only .edu and .org addresses are allowed:</strong>
                <ul>
                  {results.rejected.map((em) => <li key={em}>{em}</li>)}
                </ul>
              </div>
            )}
            {results.failed?.length > 0 && (
              <div className="invite-result-error">
                <strong>Failed to send:</strong>
                <ul>
                  {results.failed.map((em) => <li key={em}>{em}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
