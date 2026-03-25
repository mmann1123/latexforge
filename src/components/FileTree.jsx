import React, { useState } from 'react';

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
          {node.files.map((f) => (
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

export default function FileTree({ files, selectedFileId, onSelectFile, onDeleteFile, onAddFile, onUploadFile, fileInputRef }) {
  const tree = buildTree(files);

  return (
    <div className="file-tree">
      <div className="file-tree-header">
        <span>Files</span>
        <div className="file-tree-actions">
          <button className="tree-header-btn" onClick={() => onAddFile('')} title="New file">+ New</button>
          <button className="tree-header-btn" onClick={onUploadFile} title="Upload files">Upload</button>
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
        {tree.files.map((f) => (
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
