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
} from '../firebase/firestore.js';
import { uploadFile, getProjectFileAsBase64 } from '../firebase/storage.js';
import Editor from '../components/Editor.jsx';
import Toolbar from '../components/Toolbar.jsx';
import PdfViewer from '../components/PdfViewer.jsx';
import CompileLog from '../components/CompileLog.jsx';
import FileTree from '../components/FileTree.jsx';
import ShareDialog from '../components/ShareDialog.jsx';
import CollaboratorAvatars from '../components/CollaboratorAvatars.jsx';

export default function ProjectEditor() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { project, files, loading, reload } = useProject(projectId);

  const [selectedFileId, setSelectedFileId] = useState(null);
  const [pdfData, setPdfData] = useState(null);
  const [compileLog, setCompileLog] = useState('');
  const [compileSuccess, setCompileSuccess] = useState(null);
  const [compiling, setCompiling] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const [filesMenuOpen, setFilesMenuOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [autoCompile, setAutoCompile] = useState(() => localStorage.getItem('latexforge-autocompile') === 'true');
  const editorInsertRef = useRef(null);
  const fileInputRef = useRef(null);
  const filesMenuRef = useRef(null);
  const autoCompileTimerRef = useRef(null);

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

  // Select main.tex automatically
  useEffect(() => {
    if (files.length > 0 && !selectedFileId) {
      const mainTex = files.find((f) => f.name === 'main.tex');
      const first = mainTex || files[0];
      setSelectedFileId(first.id);
    }
  }, [files, selectedFileId]);

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
      } else {
        setCompileSuccess(false);
        setCompileLog(result.log || 'Compilation failed.');
      }
    } catch (err) {
      setCompileSuccess(false);
      setCompileLog(`Compile error: ${err.message}`);
    } finally {
      setCompiling(false);
    }
  }

  function handleInsertSnippet(snippet) {
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
          {collabStatus === 'synced' && <span className="save-indicator synced">Synced</span>}
        </div>

        <div className="nav-right">
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
          <button
            className={`nav-btn auto-compile-btn ${autoCompile ? 'auto-compile-active' : ''}`}
            onClick={() => {
              const next = !autoCompile;
              setAutoCompile(next);
              localStorage.setItem('latexforge-autocompile', next);
              if (!next && autoCompileTimerRef.current) clearTimeout(autoCompileTimerRef.current);
            }}
            title={autoCompile ? 'Disable auto-compile' : 'Enable auto-compile'}
          >
            Auto {autoCompile ? 'ON' : 'OFF'}
          </button>
        </div>
      </nav>

      {/* Toolbar */}
      <Toolbar onInsert={handleInsertSnippet} />

      {/* Compile Log Banner */}
      <CompileLog log={compileLog} success={compileSuccess} />

      {/* Main Content: file tree + editor + preview */}
      <div className="editor-layout">
        <div className="file-tree-pane">
          <FileTree
            files={files}
            selectedFileId={selectedFileId}
            onSelectFile={handleSelectFile}
            onDeleteFile={canEdit ? handleDeleteFile : undefined}
            onAddFile={canEdit ? handleAddFile : undefined}
            onUploadFile={canEdit ? () => fileInputRef.current?.click() : undefined}
          />
        </div>
        <div className="editor-pane">
          {selectedFile ? (
            <Editor
              yText={yText}
              awareness={awareness}
              undoManager={undoManager}
              readOnly={!canEdit}
              insertRef={editorInsertRef}
            />
          ) : (
            <div className="editor-placeholder">
              <p>Select a file to begin editing</p>
            </div>
          )}
        </div>
        <div className="preview-pane">
          <PdfViewer pdfData={pdfData} compiling={compiling} />
        </div>
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
