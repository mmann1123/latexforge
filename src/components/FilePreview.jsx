import React, { useState, useEffect } from 'react';
import { getFileUrl } from '../firebase/storage.js';

export default function FilePreview({ projectId, fileName }) {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setUrl(null);

    getFileUrl(`projects/${projectId}/${fileName}`)
      .then((u) => { if (!cancelled) setUrl(u); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [projectId, fileName]);

  if (loading) {
    return (
      <div className="file-preview">
        <div className="spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="file-preview">
        <p className="file-preview-error">Failed to load file: {error}</p>
      </div>
    );
  }

  const ext = fileName.split('.').pop().toLowerCase();
  const isImage = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext);
  const isPdf = ext === 'pdf';

  return (
    <div className="file-preview">
      <div className="file-preview-header">{fileName}</div>
      <div className="file-preview-content">
        {isImage && <img src={url} alt={fileName} className="file-preview-image" />}
        {isPdf && <iframe src={`${url}#navpanes=0&scrollbar=1`} title={fileName} className="file-preview-pdf" />}
        {!isImage && !isPdf && (
          <p className="file-preview-unsupported">
            Preview not available for this file type.
            <br />
            <a href={url} target="_blank" rel="noopener noreferrer">Download</a>
          </p>
        )}
      </div>
    </div>
  );
}
