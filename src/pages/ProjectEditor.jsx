import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { useProject } from '../hooks/useProject.js';
import { useCollaboration } from '../collaboration/useCollaboration.js';
import {
  getFile,
  updateFileContent,
  updateProjectName,
  createFile,
  deleteFile,
  renameFile,
} from '../firebase/firestore.js';
import { uploadFile, getProjectFileAsBase64, getFileUrl } from '../firebase/storage.js';
import Editor from '../components/Editor.jsx';
import Toolbar from '../components/Toolbar.jsx';
import PdfViewer from '../components/PdfViewer.jsx';
import CompileLog from '../components/CompileLog.jsx';
import FileTree from '../components/FileTree.jsx';
import ShareDialog from '../components/ShareDialog.jsx';
import CollaboratorAvatars from '../components/CollaboratorAvatars.jsx';
import FilePreview from '../components/FilePreview.jsx';

export default function ProjectEditor() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { project, files, loading, reload } = useProject(projectId);

  const [selectedFileId, setSelectedFileId] = useState(null);
  const [pdfData, setPdfData] = useState(null);
  const [compileLog, setCompileLog] = useState('');
  const [compileErrors, setCompileErrors] = useState([]);
  const [compileSuccess, setCompileSuccess] = useState(null);
  const [compiling, setCompiling] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const [filesMenuOpen, setFilesMenuOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  // Resizable pane state
  const [fileTreeVisible, setFileTreeVisible] = useState(() => localStorage.getItem('latexforge-filetree-visible') !== 'false');
  const [previewVisible, setPreviewVisible] = useState(() => localStorage.getItem('latexforge-preview-visible') !== 'false');
  const [fileTreeWidth, setFileTreeWidth] = useState(() => Number(localStorage.getItem('latexforge-filetree-width')) || 220);
  const [editorWidthPercent, setEditorWidthPercent] = useState(() => Number(localStorage.getItem('latexforge-editor-pct')) || 50);
  const [isDragging, setIsDragging] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);

  const editorInsertRef = useRef(null);
  const editorGoToLineRef = useRef(null);
  const editorUndoRedoRef = useRef(null);
  const fileInputRef = useRef(null);
  const filesMenuRef = useRef(null);
  const editorLayoutRef = useRef(null);
  const dragTypeRef = useRef(null);

  // Persist pane layout to localStorage
  useEffect(() => { localStorage.setItem('latexforge-filetree-visible', fileTreeVisible); }, [fileTreeVisible]);
  useEffect(() => { localStorage.setItem('latexforge-preview-visible', previewVisible); }, [previewVisible]);
  useEffect(() => { localStorage.setItem('latexforge-filetree-width', fileTreeWidth); }, [fileTreeWidth]);
  useEffect(() => { localStorage.setItem('latexforge-editor-pct', editorWidthPercent); }, [editorWidthPercent]);

  // Drag-to-resize handlers
  const handleResizeStart = useCallback((e, type) => {
    e.preventDefault();
    dragTypeRef.current = type;
    setIsDragging(true);
    const startX = e.clientX;
    const layout = editorLayoutRef.current;
    if (!layout) return;
    const layoutRect = layout.getBoundingClientRect();
    const startFileTreeWidth = fileTreeWidth;
    const startEditorPct = editorWidthPercent;

    function onMouseMove(ev) {
      const dx = ev.clientX - startX;
      if (dragTypeRef.current === 'filetree') {
        const newWidth = Math.max(150, Math.min(500, startFileTreeWidth + dx));
        setFileTreeWidth(newWidth);
      } else if (dragTypeRef.current === 'editor-preview') {
        const ftw = fileTreeVisible ? fileTreeWidth : 0;
        const handleWidth = 6;
        const available = layoutRect.width - ftw - handleWidth * (fileTreeVisible ? 2 : 1);
        const editorStartPx = (startEditorPct / 100) * available;
        const newEditorPx = editorStartPx + dx;
        const newPct = Math.max(20, Math.min(80, (newEditorPx / available) * 100));
        setEditorWidthPercent(newPct);
      }
    }

    function onMouseUp() {
      setIsDragging(false);
      dragTypeRef.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [fileTreeWidth, editorWidthPercent, fileTreeVisible]);

  const isOwner = project?.ownerId === user?.uid;
  const userRole = isOwner ? 'owner' : (project?.collaborators?.[user?.uid] || null);
  const canEdit = isOwner || userRole === 'editor';

  // Collaborative editing hook
  const { yText, awareness, undoManager, status: collabStatus } = useCollaboration(
    projectId,
    selectedFileId,
    user,
    canEdit
  );

  // Select main.tex automatically, or first file if none selected / selection invalid
  useEffect(() => {
    if (files.length === 0) return;
    const currentValid = selectedFileId && files.some((f) => f.id === selectedFileId);
    if (!currentValid) {
      const mainTex = files.find((f) => f.name === 'main.tex');
      setSelectedFileId((mainTex || files[0]).id);
    }
  }, [files]);

  // Sync title
  useEffect(() => {
    if (project?.name) setTitleValue(project.name);
  }, [project?.name]);

  // Close files menu on outside click
  useEffect(() => {
    function handleClick(e) {
      if (filesMenuRef.current && !filesMenuRef.current.contains(e.target)) {
        setFilesMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Ctrl+S to force sync
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (yText && selectedFileId) {
          updateFileContent(projectId, selectedFileId, yText.toString())
            .then(() => {
              setSaveFlash(true);
              setTimeout(() => setSaveFlash(false), 1500);
            })
            .catch((err) => console.error('Error saving:', err));
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [yText, selectedFileId, projectId]);

  function handleSelectFile(fileId) {
    setSelectedFileId(fileId);
    setFilesMenuOpen(false);
  }

  async function handleTitleBlur() {
    setEditingTitle(false);
    if (titleValue.trim() && titleValue !== project?.name) {
      try {
        await updateProjectName(projectId, titleValue.trim());
      } catch (err) {
        console.error('Error updating project name:', err);
      }
    }
  }

  async function handleAddFile(folderPrefix = '') {
    // New folder request from the folder button — create a placeholder .tex file inside it
    if (folderPrefix && folderPrefix.endsWith('/')) {
      try {
        await createFile(projectId, `${folderPrefix}main.tex`, 'tex', '');
      } catch (err) {
        console.error('Error creating file:', err);
      }
      return;
    }
    const hint = folderPrefix ? `File name in ${folderPrefix}:` : 'File name (e.g., chapter1.tex, images/fig.png):';
    const name = window.prompt(hint);
    if (!name || !name.trim()) return;
    const fullName = folderPrefix ? `${folderPrefix}${name.trim()}` : name.trim();
    try {
      await createFile(projectId, fullName, 'tex', '');
    } catch (err) {
      console.error('Error creating file:', err);
    }
  }

  async function handleUploadFile(e) {
    const uploadedFiles = Array.from(e.target.files);
    if (!uploadedFiles.length) return;
    const textExtensions = ['.tex', '.bib', '.cls', '.sty', '.bst', '.tikz', '.dtx', '.ins', '.def', '.cfg', '.fd', '.bbx', '.cbx', '.lbx'];
    try {
      for (const file of uploadedFiles) {
        const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        if (textExtensions.includes(ext)) {
          const content = await file.text();
          await createFile(projectId, file.name, 'tex', content);
        } else {
          await uploadFile(projectId, file);
          await createFile(projectId, file.name, 'binary', '');
        }
      }
    } catch (err) {
      console.error('Error uploading file:', err);
    }
    e.target.value = '';
  }

  async function handleDeleteFile(fileId, fileName) {
    if (!window.confirm(`Delete "${fileName}"?`)) return;
    try {
      await deleteFile(projectId, fileId);
      if (selectedFileId === fileId) {
        setSelectedFileId(null);
      }
    } catch (err) {
      console.error('Error deleting file:', err);
    }
  }

  async function handleRenameFile(file) {
    const displayName = file.name.includes('/') ? file.name.split('/').pop() : file.name;
    const newDisplayName = window.prompt('New name:', displayName);
    if (!newDisplayName?.trim() || newDisplayName.trim() === displayName) return;
    const folder = file.name.includes('/') ? file.name.substring(0, file.name.lastIndexOf('/') + 1) : '';
    try {
      await renameFile(projectId, file.id, folder + newDisplayName.trim());
    } catch (err) {
      console.error('Error renaming file:', err);
    }
  }

  async function handleDownloadFile(file) {
    try {
      if (file.type === 'binary') {
        const url = await getFileUrl(`projects/${projectId}/${file.name}`);
        window.open(url, '_blank');
      } else {
        const full = await getFile(projectId, file.id);
        const blob = new Blob([full?.content || ''], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.displayName || file.name;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Error downloading file:', err);
    }
  }

  async function handleMoveFile(file, targetFolder) {
    const fileName = file.name.includes('/') ? file.name.split('/').pop() : file.name;
    const newName = targetFolder ? `${targetFolder}/${fileName}` : fileName;
    if (newName === file.name) return;
    try {
      await renameFile(projectId, file.id, newName);
    } catch (err) {
      console.error('Error moving file:', err);
    }
  }

  async function handleCompile() {
    const compileUrl = import.meta.env.VITE_COMPILE_SERVICE_URL;
    if (!compileUrl) {
      setCompileLog('Error: VITE_COMPILE_SERVICE_URL is not configured.');
      setCompileSuccess(false);
      return;
    }

    // Flush current Yjs content to Firestore before compiling
    if (yText && selectedFileId) {
      try {
        await updateFileContent(projectId, selectedFileId, yText.toString());
      } catch (err) {
        console.warn('Error flushing content before compile:', err);
      }
    }

    setCompiling(true);
    setCompileLog('');
    setCompileSuccess(null);
    setPdfData(null);

    try {
      const allFiles = [];
      for (const f of files) {
        if (f.type === 'binary') {
          try {
            const b64 = await getProjectFileAsBase64(projectId, f.name);
            allFiles.push({ name: f.name, content: b64, encoding: 'base64' });
          } catch (err) {
            console.warn(`Skipping binary file ${f.name}:`, err);
          }
        } else {
          const full = await getFile(projectId, f.id);
          if (full) allFiles.push({ name: f.name, content: full.content || '', encoding: 'text' });
        }
      }

      const token = await user.getIdToken();
      const response = await fetch(compileUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          mainFile: selectedFile?.name || project?.mainFile || 'main.tex',
          files: allFiles,
        }),
      });

      const result = await response.json();

      if (result.success && result.pdf) {
        setPdfData(result.pdf);
        setCompileSuccess(true);
        setCompileLog(result.log || '');
        setCompileErrors(result.errors || []);
      } else {
        setCompileSuccess(false);
        setCompileLog(result.log || 'Compilation failed.');
        setCompileErrors(result.errors || []);
      }
    } catch (err) {
      setCompileSuccess(false);
      setCompileLog(`Compile error: ${err.message}`);
      setCompileErrors([]);
    } finally {
      setCompiling(false);
    }
  }

  function handleInsertSnippet(snippet) {
    // Auto-add required packages to preamble
    const packageMap = {
      '\\sout{': 'ulem',  // loaded with [normalem] option below
      '\\href{': 'hyperref',
      '\\url{': 'hyperref',
    };
    if (yText) {
      const content = yText.toString();
      for (const [cmd, pkg] of Object.entries(packageMap)) {
        if (snippet.includes(cmd) && !content.includes(`\\usepackage{${pkg}}`) && !content.includes(`\\usepackage[normalem]{${pkg}}`)) {
          const docClassEnd = content.indexOf('\n', content.indexOf('\\documentclass'));
          if (docClassEnd !== -1) {
            const usepackageLine = pkg === 'ulem' ? `\\usepackage[normalem]{${pkg}}` : `\\usepackage{${pkg}}`;
            yText.insert(docClassEnd + 1, usepackageLine + '\n');
          }
        }
      }
    }
    if (editorInsertRef.current) {
      editorInsertRef.current(snippet);
    }
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading project...</p>
      </div>
    );
  }

  const selectedFile = files.find((f) => f.id === selectedFileId);

  return (
    <div className="editor-page">
      {/* Top Navigation Bar */}
      <nav className="nav-bar">
        <div className="nav-left">
          <button className="nav-back" onClick={() => navigate('/')} title="Back to Dashboard">
            &larr;
          </button>
          <span className="nav-logo">LaTeX Forge</span>
          <a
            href="https://github.com/mmann1123/latexforge/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="nav-github-link"
            title="Report an issue"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
          </a>
        </div>

        <div className="nav-center">
          {editingTitle && isOwner ? (
            <input
              className="nav-title-input"
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={(e) => e.key === 'Enter' && handleTitleBlur()}
              autoFocus
            />
          ) : (
            <span
              className="nav-title"
              onClick={() => isOwner && setEditingTitle(true)}
              title={isOwner ? 'Click to rename' : project?.name}
            >
              {project?.name || 'Untitled'}
            </span>
          )}
          {selectedFile && (
            <span className="nav-filename">{selectedFile.name}</span>
          )}
          {collabStatus === 'connecting' && <span className="save-indicator">Connecting...</span>}
          {saveFlash ? (
            <span className="save-indicator saved">Saved</span>
          ) : (
            collabStatus === 'synced' && <span className="save-indicator synced">Synced</span>
          )}
        </div>

        <div className="nav-right">
          <button
            className="nav-btn pane-toggle-btn"
            onClick={() => setFileTreeVisible((v) => !v)}
            title={fileTreeVisible ? 'Hide file tree' : 'Show file tree'}
          >
            {fileTreeVisible ? '◀' : '▶'}
          </button>
          <button
            className="nav-btn pane-toggle-btn"
            onClick={() => setPreviewVisible((v) => !v)}
            title={previewVisible ? 'Hide PDF preview' : 'Show PDF preview'}
          >
            {previewVisible ? '▶' : '◀'}
          </button>
          <CollaboratorAvatars awareness={awareness} currentUser={user} />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={handleUploadFile}
            accept=".tex,.bib,.cls,.sty,.bst,.png,.jpg,.jpeg,.gif,.svg,.pdf,.eps,.tikz,.dtx,.ins,.def,.cfg,.fd,.bbx,.cbx,.lbx"
          />
          {isOwner && (
            <button
              className="nav-btn"
              onClick={() => setShareDialogOpen(true)}
              title="Share project"
            >
              Share
            </button>
          )}
          <button
            className="compile-btn"
            onClick={handleCompile}
            disabled={compiling}
          >
            {compiling ? 'Compiling...' : 'Compile'}
          </button>
        </div>
      </nav>

      {/* Main Content: file tree + editor + preview */}
      <div className={`editor-layout${isDragging ? ' is-dragging' : ''}`} ref={editorLayoutRef}>
        {fileTreeVisible && (
          <>
            <div className="file-tree-pane" style={{ width: fileTreeWidth }}>
              <FileTree
                files={files}
                selectedFileId={selectedFileId}
                onSelectFile={handleSelectFile}
                onDeleteFile={canEdit ? handleDeleteFile : undefined}
                onAddFile={canEdit ? handleAddFile : undefined}
                onUploadFile={canEdit ? () => fileInputRef.current?.click() : undefined}
                onRenameFile={canEdit ? handleRenameFile : undefined}
                onDownloadFile={handleDownloadFile}
                onMoveFile={canEdit ? handleMoveFile : undefined}
              />
            </div>
            <div
              className="resize-handle"
              onMouseDown={(e) => handleResizeStart(e, 'filetree')}
            />
          </>
        )}
        <div className="editor-pane" style={{ flex: previewVisible ? editorWidthPercent : 1 }}>
          <Toolbar
            onInsert={handleInsertSnippet}
            onUndo={() => editorUndoRedoRef.current?.undo()}
            onRedo={() => editorUndoRedoRef.current?.redo()}
          />
          <CompileLog
            log={compileLog}
            success={compileSuccess}
            errors={compileErrors}
            onGoToLine={(line) => editorGoToLineRef.current?.(line)}
            sourceCode={yText?.toString() || ''}
          />
          {selectedFile ? (
            selectedFile.type === 'binary' ? (
              <FilePreview projectId={projectId} fileName={selectedFile.name} />
            ) : (
              <Editor
                yText={yText}
                awareness={awareness}
                undoManager={undoManager}
                readOnly={!canEdit}
                insertRef={editorInsertRef}
                goToLineRef={editorGoToLineRef}
                undoRedoRef={editorUndoRedoRef}
              />
            )
          ) : (
            <div className="editor-placeholder">
              <p>Select a file to begin editing</p>
            </div>
          )}
        </div>
        {previewVisible && (
          <>
            <div
              className="resize-handle"
              onMouseDown={(e) => handleResizeStart(e, 'editor-preview')}
            />
            <div className="preview-pane" style={{ flex: 100 - editorWidthPercent }}>
              <PdfViewer pdfData={pdfData} compiling={compiling} />
            </div>
          </>
        )}
      </div>

      {/* Share Dialog */}
      {shareDialogOpen && (
        <ShareDialog
          projectId={projectId}
          project={project}
          onClose={() => setShareDialogOpen(false)}
        />
      )}
    </div>
  );
}
