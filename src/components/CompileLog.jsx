import { useState, useEffect } from 'react';
import { explainLatexError } from '../firebase/ai.js';

function ErrorEntry({ entry, onGoToLine, sourceCode }) {
  const [expanded, setExpanded] = useState(false);
  const [aiExplanation, setAiExplanation] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  async function handleExplain() {
    if (aiExplanation) {
      setAiExplanation(null);
      return;
    }
    setAiLoading(true);
    try {
      // Get ~5 lines of source around the error
      let codeSnippet = '';
      if (sourceCode && entry.line) {
        const lines = sourceCode.split('\n');
        const start = Math.max(0, entry.line - 3);
        const end = Math.min(lines.length, entry.line + 2);
        codeSnippet = lines.slice(start, end)
          .map((l, i) => `${start + i + 1}: ${l}`)
          .join('\n');
      }
      const explanation = await explainLatexError(entry.message, entry.context, codeSnippet);
      setAiExplanation(explanation);
    } catch (err) {
      setAiExplanation('Could not get explanation: ' + err.message);
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className={`compile-entry compile-entry-${entry.level}`}>
      <div className="compile-entry-header">
        <span className="compile-entry-level">
          {entry.level === 'error' ? '!' : entry.level === 'warning' ? '\u26A0' : '\u2139'}
        </span>
        <span className="compile-entry-msg" onClick={() => entry.context && setExpanded(!expanded)}>
          {entry.message}
        </span>
        <div className="compile-entry-actions">
          {entry.line && (
            <button
              className="compile-entry-line"
              onClick={() => onGoToLine?.(entry.line)}
              title={`Go to line ${entry.line}`}
            >
              L{entry.line}
            </button>
          )}
          {entry.level === 'error' && (
            <button
              className="compile-entry-explain"
              onClick={handleExplain}
              disabled={aiLoading}
              title="Explain this error with AI"
            >
              {aiLoading ? '...' : aiExplanation ? 'Hide' : 'Explain'}
            </button>
          )}
        </div>
      </div>
      {expanded && entry.context && (
        <pre className="compile-entry-ctx">{entry.context}</pre>
      )}
      {aiExplanation && (
        <div className="compile-ai-box">{aiExplanation}</div>
      )}
    </div>
  );
}

export default function CompileLog({ log, success, errors, onGoToLine, sourceCode }) {
  const [showRawLog, setShowRawLog] = useState(false);
  const [showErrors, setShowErrors] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  // Auto-dismiss success banner after 3 seconds (only if no warnings)
  useEffect(() => {
    setDismissed(false);
    setShowRawLog(false);
    if (success === true && (!errors || errors.length === 0)) {
      const timer = setTimeout(() => setDismissed(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [success, log]);

  // Nothing to show
  if (success === null && !log) return null;
  if (dismissed && success === true) return null;

  const isSuccess = success === true;
  const isError = success === false;

  const errorCount = errors?.filter((e) => e.level === 'error').length || 0;
  const warnCount = errors?.filter((e) => e.level === 'warning').length || 0;

  return (
    <div className="compile-banner-wrap">
      <div className={`compile-banner ${isSuccess ? 'banner-success' : ''} ${isError ? 'banner-error' : ''}`}>
        {isSuccess && !errors?.length && <span>Compiled successfully.</span>}
        {isSuccess && errors?.length > 0 && (
          <span>Compiled with {warnCount} warning{warnCount !== 1 ? 's' : ''}</span>
        )}
        {isError && (
          <span>
            Compilation failed
            {errorCount > 0 && ` \u2014 ${errorCount} error${errorCount !== 1 ? 's' : ''}`}
            {warnCount > 0 && `, ${warnCount} warning${warnCount !== 1 ? 's' : ''}`}
          </span>
        )}
        {errors?.length > 0 && (
          <button className="banner-link" onClick={() => setShowErrors(!showErrors)}>
            {showErrors ? 'hide errors' : 'show errors'}
          </button>
        )}
        {log && (
          <button className="banner-link" onClick={() => setShowRawLog(!showRawLog)}>
            {showRawLog ? 'hide full log' : 'show full log'}
          </button>
        )}
      </div>

      {/* Structured error/warning list */}
      {showErrors && errors?.length > 0 && (
        <div className="compile-entries">
          {errors.map((entry, i) => (
            <ErrorEntry
              key={i}
              entry={entry}
              onGoToLine={onGoToLine}
              sourceCode={sourceCode}
            />
          ))}
        </div>
      )}

      {/* Raw log fallback */}
      {showRawLog && log && (
        <div className="compile-log-expanded">
          <pre>{log}</pre>
        </div>
      )}
    </div>
  );
}
