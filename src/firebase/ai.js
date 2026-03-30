import { auth } from './config.js';

const COMPILE_URL = import.meta.env.VITE_COMPILE_SERVICE_URL;
// Derive base URL from compile URL (strip /compile suffix)
const BASE_URL = COMPILE_URL?.replace(/\/compile$/, '') || '';

/**
 * Ask the backend to explain a LaTeX compilation error using Gemini.
 * The API key is kept server-side — the frontend authenticates via Firebase token.
 */
export async function explainLatexError(errorMessage, context, sourceCode) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${BASE_URL}/explain`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ errorMessage, context, sourceCode }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Error: ${response.status}`);
  }

  const data = await response.json();
  return data.explanation;
}
