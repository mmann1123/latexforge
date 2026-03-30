import React, { useState } from 'react';

function sortFiles(files) {
  const priority = ['.tex', '.bib', '.cls'];
  const getPriority = (name) => {
    const lower = name.toLowerCase();
    const idx = priority.findIndex((ext) => lower.endsWith(ext));
    return idx === -1 ? priority.length : idx;
  };
  return [...files].sort((a, b) => {
    const pa = getPriority(a.displayName);
    const pb = getPriority(b.displayName);
    if (pa !== pb) return pa - pb;
    return a.displayName.toLowerCase().localeCompare(b.displayName.toLowerCase());
  });
}

function buildTree(files) {
  const root = { children: {}, files: [] };
  for (const file of files) {
    const parts = file.name.split('/');
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!node.children[parts[i]]) {
        node.children[parts[i]] = { children: {}, files: [] };
      }
      node = node.children[parts[i]];
    }
    node.files.push({ ...file, displayName: parts[parts.length - 1] });
  }
  return root;
}

function TreeFolder({ name, node, depth, selectedFileId, onSelectFile, onDeleteFile, onAddFile }) {
  const [expanded, setExpanded] = useState(true);
  const folderNames = Object.keys(node.children).sort();

  return (
    <div className="tree-folder">
      <div
        className="tree-folder-label"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => setExpanded(!expanded)}
      >
        <span className="tree-icon">{expanded ? '\u25BE' : '\u25B8'}</span>
        <span className="tree-folder-name">{name}</span>
        <button
          className="tree-action-btn"
          onClick={(e) => { e.stopPropagation(); onAddFile(name ? name + '/' : ''); }}
          title="New file in folder"
        >+</button>
      </div>
      {expanded && (
        <div className="tree-folder-children">
          {folderNames.map((childName) => (
            <TreeFolder
              key={childName}
              name={childName}
              node={node.children[childName]}
              depth={depth + 1}
              selectedFileId={selectedFileId}
              onSelectFile={onSelectFile}
              onDeleteFile={onDeleteFile}
              onAddFile={(prefix) => onAddFile(name ? `${name}/${prefix}` : prefix)}
            />
          ))}
          {sortFiles(node.files).map((f) => (
            <div
              key={f.id}
              className={`tree-file ${f.id === selectedFileId ? 'active' : ''}`}
              style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
              onClick={() => onSelectFile(f.id)}
            >
              <span className="tree-file-icon">
                {f.type === 'binary' ? '\uD83D\uDDBC' : '\uD83D\uDCC4'}
              </span>
              <span className="tree-file-name" title={f.name}>{f.displayName}</span>
              <button
                className="tree-delete-btn"
                onClick={(e) => { e.stopPropagation(); onDeleteFile(f.id, f.name); }}
                title="Delete"
              >&times;</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FileTree({ files, selectedFileId, onSelectFile, onDeleteFile, onAddFile, onUploadFile, onNewFolder, onCollapseAll, fileInputRef }) {
  const tree = buildTree(files);
  const [allCollapsed, setAllCollapsed] = useState(false);

  return (
    <div className="file-tree">
      <div className="file-tree-header">
        <span>File tree</span>
        <div className="file-tree-actions">
          {onAddFile && (
            <button className="tree-icon-btn" onClick={() => onAddFile('')} title="New file">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M9.5 1.1H3.5C2.95 1.1 2.5 1.55 2.5 2.1V13.9C2.5 14.45 2.95 14.9 3.5 14.9H12.5C13.05 14.9 13.5 14.45 13.5 13.9V5.1L9.5 1.1ZM12.5 13.9H3.5V2.1H9V5.6H12.5V13.9ZM8.5 7.1H7.5V9.1H5.5V10.1H7.5V12.1H8.5V10.1H10.5V9.1H8.5V7.1Z"/></svg>
            </button>
          )}
          {onAddFile && (
            <button className="tree-icon-btn" onClick={() => {
              const name = window.prompt('Folder name:');
              if (name?.trim()) onAddFile(name.trim() + '/');
            }} title="New folder">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M14 4H8L7 3H2C1.45 3 1 3.45 1 4V12C1 12.55 1.45 13 2 13H14C14.55 13 15 12.55 15 12V5C15 4.45 14.55 4 14 4ZM14 12H2V4H6.59L7.59 5H14V12ZM8.5 7H7.5V9H5.5V10H7.5V12H8.5V10H10.5V9H8.5V7Z"/></svg>
            </button>
          )}
          {onUploadFile && (
            <button className="tree-icon-btn" onClick={onUploadFile} title="Upload files">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M7.4 2L8 1.4L8.6 2L11.15 4.55L10.45 5.25L8.5 3.3V10H7.5V3.3L5.55 5.25L4.85 4.55L7.4 2ZM3 12V8H2V12C2 12.55 2.45 13 3 13H13C13.55 13 14 12.55 14 12V8H13V12H3Z"/></svg>
            </button>
          )}
        </div>
      </div>
      <div className="file-tree-content">
        {/* Root-level folders */}
        {Object.keys(tree.children).sort().map((name) => (
          <TreeFolder
            key={name}
            name={name}
            node={tree.children[name]}
            depth={0}
            selectedFileId={selectedFileId}
            onSelectFile={onSelectFile}
            onDeleteFile={onDeleteFile}
            onAddFile={onAddFile}
          />
        ))}
        {/* Root-level files */}
        {sortFiles(tree.files).map((f) => (
          <div
            key={f.id}
            className={`tree-file ${f.id === selectedFileId ? 'active' : ''}`}
            style={{ paddingLeft: '20px' }}
            onClick={() => onSelectFile(f.id)}
          >
            <span className="tree-file-icon">
              {f.type === 'binary' ? '\uD83D\uDDBC' : '\uD83D\uDCC4'}
            </span>
            <span className="tree-file-name" title={f.name}>{f.displayName}</span>
            <button
              className="tree-delete-btn"
              onClick={(e) => { e.stopPropagation(); onDeleteFile(f.id, f.name); }}
              title="Delete"
            >&times;</button>
          </div>
        ))}
        {files.length === 0 && (
          <div className="tree-empty">No files yet</div>
        )}
      </div>
    </div>
  );
}
