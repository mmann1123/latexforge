import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { useProject } from '../hooks/useProject.js';
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

export default function ProjectEditor() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { project, files, loading, reload } = useProject(user?.uid, projectId);

  const [selectedFileId, setSelectedFileId] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [pdfData, setPdfData] = useState(null);
  const [compileLog, setCompileLog] = useState('');
  const [compileSuccess, setCompileSuccess] = useState(null);
  const [compiling, setCompiling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const [filesMenuOpen, setFilesMenuOpen] = useState(false);
  const [autoCompile, setAutoCompile] = useState(() => localStorage.getItem('latexforge-autocompile') === 'true');
  const editorInsertRef = useRef(null);
  const fileInputRef = useRef(null);
  const filesMenuRef = useRef(null);
  const autoCompileTimerRef = useRef(null);

  // Select main.tex automatically
  useEffect(() => {
    if (files.length > 0 && !selectedFileId) {
      const mainTex = files.find((f) => f.name === 'main.tex');
      const first = mainTex || files[0];
      setSelectedFileId(first.id);
      setFileContent(first.content || '');
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

  const pendingSaveRef = useRef(null);

  async function flushPendingSave() {
    if (pendingSaveRef.current) {
      clearTimeout(pendingSaveRef.current.timer);
      const { fileId, content } = pendingSaveRef.current;
      pendingSaveRef.current = null;
      try {
        await updateFileContent(user.uid, projectId, fileId, content);
      } catch (err) {
        console.error('Error saving file:', err);
      }
    }
  }

  async function handleSelectFile(fileId) {
    if (!user) return;
    await flushPendingSave();
    setSelectedFileId(fileId);
    setFilesMenuOpen(false);
    try {
      const file = await getFile(user.uid, projectId, fileId);
      if (file) setFileContent(file.content || '');
    } catch (err) {
      console.error('Error loading file:', err);
    }
  }

  const handleContentChange = useCallback(
    (newContent) => {
      setFileContent(newContent);
      if (!user || !selectedFileId) return;

      // Cancel any pending save (might be for a different file)
      if (pendingSaveRef.current?.timer) {
        clearTimeout(pendingSaveRef.current.timer);
      }

      // Capture the current file ID at edit time, not save time
      const fileIdAtEdit = selectedFileId;
      const timer = setTimeout(async () => {
        setSaving(true);
        try {
          await updateFileContent(user.uid, projectId, fileIdAtEdit, newContent);
        } catch (err) {
          console.error('Error saving file:', err);
        } finally {
          setSaving(false);
          if (pendingSaveRef.current?.fileId === fileIdAtEdit) {
            pendingSaveRef.current = null;
          }
        }
      }, 2000);

      pendingSaveRef.current = { fileId: fileIdAtEdit, content: newContent, timer };

      // Auto-compile after save settles
      if (autoCompile) {
        if (autoCompileTimerRef.current) clearTimeout(autoCompileTimerRef.current);
        autoCompileTimerRef.current = setTimeout(() => {
          handleCompile();
        }, 5000);
      }
    },
    [user, projectId, selectedFileId, autoCompile]
  );

  async function handleTitleBlur() {
    setEditingTitle(false);
    if (titleValue.trim() && titleValue !== project?.name) {
      try {
        await updateProjectName(user.uid, projectId, titleValue.trim());
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
      await createFile(user.uid, projectId, fullName, 'tex', '');
      await reload();
    } catch (err) {
      console.error('Error creating file:', err);
    }
  }

  async function handleUploadFile(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const textExtensions = ['.tex', '.bib', '.cls', '.sty', '.bst', '.tikz', '.dtx', '.ins', '.def', '.cfg', '.fd', '.bbx', '.cbx', '.lbx'];
    try {
      for (const file of files) {
        const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        if (textExtensions.includes(ext)) {
          const content = await file.text();
          await createFile(user.uid, projectId, file.name, 'tex', content);
        } else {
          await uploadFile(user.uid, projectId, file);
          await createFile(user.uid, projectId, file.name, 'binary', '');
        }
      }
      await reload();
    } catch (err) {
      console.error('Error uploading file:', err);
    }
    e.target.value = '';
  }

  async function handleDeleteFile(fileId, fileName) {
    if (!window.confirm(`Delete "${fileName}"?`)) return;
    try {
      await deleteFile(user.uid, projectId, fileId);
      if (selectedFileId === fileId) {
        setSelectedFileId(null);
        setFileContent('');
      }
      await reload();
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

    setCompiling(true);
    setCompileLog('');
    setCompileSuccess(null);
    setPdfData(null);

    try {
      const allFiles = [];
      for (const f of files) {
        if (f.type === 'binary') {
          try {
            const b64 = await getProjectFileAsBase64(user.uid, projectId, f.name);
            allFiles.push({ name: f.name, content: b64, encoding: 'base64' });
          } catch (err) {
            console.warn(`Skipping binary file ${f.name}:`, err);
          }
        } else {
          const full = await getFile(user.uid, projectId, f.id);
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
          {editingTitle ? (
            <input
              className="nav-title-input"
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={(e) => e.key === 'Enter' && handleTitleBlur()}
              autoFocus
            />
          ) : (
            <span className="nav-title" onClick={() => setEditingTitle(true)} title="Click to rename">
              {project?.name || 'Untitled'}
            </span>
          )}
          {selectedFile && (
            <span className="nav-filename">{selectedFile.name}</span>
          )}
          {saving && <span className="save-indicator">Saving...</span>}
        </div>

        <div className="nav-right">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={handleUploadFile}
            accept=".tex,.bib,.cls,.sty,.bst,.png,.jpg,.jpeg,.gif,.svg,.pdf,.eps,.tikz,.dtx,.ins,.def,.cfg,.fd,.bbx,.cbx,.lbx"
          />
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
            onDeleteFile={handleDeleteFile}
            onAddFile={handleAddFile}
            onUploadFile={() => fileInputRef.current?.click()}
          />
        </div>
        <div className="editor-pane">
          {selectedFile ? (
            <Editor
              value={fileContent}
              onChange={handleContentChange}
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
    </div>
  );
}
