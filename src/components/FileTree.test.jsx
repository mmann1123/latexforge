import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FileTree from './FileTree.jsx';

const mockFiles = [
  { id: '1', name: 'main.tex', type: 'tex', displayName: 'main.tex' },
  { id: '2', name: 'refs.bib', type: 'tex', displayName: 'refs.bib' },
  { id: '3', name: 'chapters/intro.tex', type: 'tex', displayName: 'intro.tex' },
  { id: '4', name: 'chapters/methods.tex', type: 'tex', displayName: 'methods.tex' },
  { id: '5', name: 'images/fig1.png', type: 'binary', displayName: 'fig1.png' },
];

describe('FileTree', () => {
  it('renders root-level files', () => {
    render(
      <FileTree
        files={mockFiles}
        selectedFileId={null}
        onSelectFile={vi.fn()}
        onDeleteFile={vi.fn()}
        onAddFile={vi.fn()}
        onUploadFile={vi.fn()}
      />
    );
    expect(screen.getByText('main.tex')).toBeInTheDocument();
    expect(screen.getByText('refs.bib')).toBeInTheDocument();
  });

  it('renders folder names', () => {
    render(
      <FileTree
        files={mockFiles}
        selectedFileId={null}
        onSelectFile={vi.fn()}
        onDeleteFile={vi.fn()}
        onAddFile={vi.fn()}
        onUploadFile={vi.fn()}
      />
    );
    expect(screen.getByText('chapters')).toBeInTheDocument();
    expect(screen.getByText('images')).toBeInTheDocument();
  });

  it('renders files inside folders', () => {
    render(
      <FileTree
        files={mockFiles}
        selectedFileId={null}
        onSelectFile={vi.fn()}
        onDeleteFile={vi.fn()}
        onAddFile={vi.fn()}
        onUploadFile={vi.fn()}
      />
    );
    expect(screen.getByText('intro.tex')).toBeInTheDocument();
    expect(screen.getByText('methods.tex')).toBeInTheDocument();
    expect(screen.getByText('fig1.png')).toBeInTheDocument();
  });

  it('highlights the selected file', () => {
    render(
      <FileTree
        files={mockFiles}
        selectedFileId="1"
        onSelectFile={vi.fn()}
        onDeleteFile={vi.fn()}
        onAddFile={vi.fn()}
        onUploadFile={vi.fn()}
      />
    );
    const mainTex = screen.getByText('main.tex').closest('.tree-file');
    expect(mainTex).toHaveClass('active');
  });

  it('calls onSelectFile when clicking a file', () => {
    const onSelectFile = vi.fn();
    render(
      <FileTree
        files={mockFiles}
        selectedFileId={null}
        onSelectFile={onSelectFile}
        onDeleteFile={vi.fn()}
        onAddFile={vi.fn()}
        onUploadFile={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('main.tex'));
    expect(onSelectFile).toHaveBeenCalledWith('1');
  });

  it('renders header with New and Upload buttons', () => {
    render(
      <FileTree
        files={mockFiles}
        selectedFileId={null}
        onSelectFile={vi.fn()}
        onDeleteFile={vi.fn()}
        onAddFile={vi.fn()}
        onUploadFile={vi.fn()}
      />
    );
    expect(screen.getByText('+ New')).toBeInTheDocument();
    expect(screen.getByText('Upload')).toBeInTheDocument();
  });

  it('calls onUploadFile when Upload is clicked', () => {
    const onUploadFile = vi.fn();
    render(
      <FileTree
        files={mockFiles}
        selectedFileId={null}
        onSelectFile={vi.fn()}
        onDeleteFile={vi.fn()}
        onAddFile={vi.fn()}
        onUploadFile={onUploadFile}
      />
    );
    fireEvent.click(screen.getByText('Upload'));
    expect(onUploadFile).toHaveBeenCalled();
  });

  it('shows empty state when no files', () => {
    render(
      <FileTree
        files={[]}
        selectedFileId={null}
        onSelectFile={vi.fn()}
        onDeleteFile={vi.fn()}
        onAddFile={vi.fn()}
        onUploadFile={vi.fn()}
      />
    );
    expect(screen.getByText('No files yet')).toBeInTheDocument();
  });

  it('collapses folder when clicking folder label', () => {
    render(
      <FileTree
        files={mockFiles}
        selectedFileId={null}
        onSelectFile={vi.fn()}
        onDeleteFile={vi.fn()}
        onAddFile={vi.fn()}
        onUploadFile={vi.fn()}
      />
    );
    // intro.tex should be visible initially (folders start expanded)
    expect(screen.getByText('intro.tex')).toBeInTheDocument();

    // Click the "chapters" folder to collapse it
    fireEvent.click(screen.getByText('chapters'));

    // intro.tex should no longer be visible
    expect(screen.queryByText('intro.tex')).not.toBeInTheDocument();
  });
});
