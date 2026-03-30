import React, { useState, useEffect } from 'react';

export default function CompileLog({ log, success }) {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Auto-dismiss success banner after 3 seconds
  useEffect(() => {
    setDismissed(false);
    if (success === true) {
      const timer = setTimeout(() => setDismissed(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [success, log]);

  // Nothing to show
  if (success === null && !log) return null;
  if (dismissed && success === true) return null;

  const isSuccess = success === true;
  const isError = success === false;

  return (
    <div className="compile-banner-wrap">
      <div className={`compile-banner ${isSuccess ? 'banner-success' : ''} ${isError ? 'banner-error' : ''}`}>
        {isSuccess && <span>Compiled successfully.</span>}
        {isError && (
          <>
            <span>Compilation failed</span>
            {log && (
              <button className="banner-link" onClick={() => setExpanded(!expanded)}>
                {expanded ? 'hide log' : 'show log'}
              </button>
            )}
          </>
        )}
      </div>
      {expanded && log && (
        <div className="compile-log-expanded">
          <pre>{log}</pre>
        </div>
      )}
    </div>
  );
}
