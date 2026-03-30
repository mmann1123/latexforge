import React, { useState, useEffect, useRef } from 'react';

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

function getFolders(files) {
  const folders = new Set(['']);
  for (const f of files) {
    const parts = f.name.split('/');
    for (let i = 1; i < parts.length; i++) {
      folders.add(parts.slice(0, i).join('/'));
    }
  }
  return Array.from(folders).sort();
}

function ContextMenu({ x, y, file, onClose, onRename, onDownload, onDelete, onMove, folders }) {
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  // Adjust position if menu would go off-screen
  const style = { position: 'fixed', left: x, top: y, zIndex: 1000 };

  return (
    <div className="tree-context-menu" style={style} ref={menuRef}>
      {onRename && <button onClick={() => { onRename(file); onClose(); }}>Rename</button>}
      {onDownload && <button onClick={() => { onDownload(file); onClose(); }}>Download</button>}
      {onDelete && <button onClick={() => { onDelete(file.id, file.name); onClose(); }}>Delete</button>}
      {onMove && folders.length > 1 && (
        <>
          <div className="tree-context-separator" />
          <div className="tree-context-submenu">
            <span className="tree-context-label">Move to...</span>
            {folders.map((folder) => {
              const currentFolder = file.name.includes('/') ? file.name.substring(0, file.name.lastIndexOf('/')) : '';
              if (folder === currentFolder) return null;
              return (
                <button key={folder} onClick={() => { onMove(file, folder); onClose(); }}>
                  {folder || '/ (root)'}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function FileItem({ file, depth, selectedFileId, onSelectFile, onContextMenu }) {
  const isActive = file.id === selectedFileId;
  return (
    <div
      className={`tree-file ${isActive ? 'active' : ''}`}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
      onClick={() => onSelectFile(file.id)}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(e, file); }}
    >
      <span className="tree-file-icon">
        {file.type === 'binary' ? '\uD83D\uDDBC' : '\uD83D\uDCC4'}
      </span>
      <span className="tree-file-name" title={file.name}>{file.displayName}</span>
      {isActive && (
        <button
          className="tree-kebab-btn"
          onClick={(e) => { e.stopPropagation(); onContextMenu(e, file); }}
          title="File actions"
        >&#x22EE;</button>
      )}
    </div>
  );
}

function TreeFolder({ name, node, depth, selectedFileId, onSelectFile, onAddFile, onContextMenu }) {
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
        {onAddFile && (
          <button
            className="tree-action-btn"
            onClick={(e) => { e.stopPropagation(); onAddFile(name ? name + '/' : ''); }}
            title="New file in folder"
          >+</button>
        )}
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
              onAddFile={onAddFile}
              onContextMenu={onContextMenu}
            />
          ))}
          {sortFiles(node.files).map((f) => (
            <FileItem
              key={f.id}
              file={f}
              depth={depth + 1}
              selectedFileId={selectedFileId}
              onSelectFile={onSelectFile}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FileTree({ files, selectedFileId, onSelectFile, onDeleteFile, onAddFile, onUploadFile, onRenameFile, onDownloadFile, onMoveFile }) {
  const tree = buildTree(files);
  const folders = getFolders(files);
  const [contextMenu, setContextMenu] = useState(null);

  function handleContextMenu(e, file) {
    setContextMenu({ x: e.clientX, y: e.clientY, file });
  }

  return (
    <div className="file-tree">
      <div className="file-tree-header">
        <span></span>
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
        {Object.keys(tree.children).sort().map((name) => (
          <TreeFolder
            key={name}
            name={name}
            node={tree.children[name]}
            depth={0}
            selectedFileId={selectedFileId}
            onSelectFile={onSelectFile}
            onAddFile={onAddFile}
            onContextMenu={handleContextMenu}
          />
        ))}
        {sortFiles(tree.files).map((f) => (
          <FileItem
            key={f.id}
            file={f}
            depth={1}
            selectedFileId={selectedFileId}
            onSelectFile={onSelectFile}
            onContextMenu={handleContextMenu}
          />
        ))}
        {files.length === 0 && (
          <div className="tree-empty">No files yet</div>
        )}
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          file={contextMenu.file}
          folders={folders}
          onClose={() => setContextMenu(null)}
          onRename={onRenameFile}
          onDownload={onDownloadFile}
          onDelete={onDeleteFile}
          onMove={onMoveFile}
        />
      )}
    </div>
  );
}
