import React, { useState } from 'react';

export default function CompileLog({ log, success }) {
  const [expanded, setExpanded] = useState(false);

  // Nothing to show
  if (success === null && !log) return null;

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
