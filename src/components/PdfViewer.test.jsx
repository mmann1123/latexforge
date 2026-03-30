import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock pdfjs-dist before importing component
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  version: '4.9.155',
  getDocument: vi.fn(() => ({
    promise: Promise.resolve({
      numPages: 3,
      getPage: vi.fn(() =>
        Promise.resolve({
          getViewport: () => ({ width: 600, height: 800 }),
          render: () => ({ promise: Promise.resolve() }),
        })
      ),
    }),
  })),
}));

import PdfViewer from './PdfViewer.jsx';

describe('PdfViewer', () => {
  it('shows empty state when no pdfData and not compiling', () => {
    render(<PdfViewer pdfData={null} compiling={false} />);
    expect(screen.getByText('Click Compile to generate your PDF')).toBeInTheDocument();
  });

  it('shows compiling state with spinner', () => {
    render(<PdfViewer pdfData={null} compiling={true} />);
    expect(screen.getByText('Compiling...')).toBeInTheDocument();
  });

  it('shows compiling state even when pdfData exists', () => {
    render(<PdfViewer pdfData="somedata" compiling={true} />);
    expect(screen.getByText('Compiling...')).toBeInTheDocument();
  });

  it('renders navigation and download when pdfData is provided', async () => {
    const fakePdf = btoa('fake pdf content');
    render(<PdfViewer pdfData={fakePdf} compiling={false} />);

    // Navigation elements should be present
    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
    expect(screen.getByText('Download PDF')).toBeInTheDocument();
  });

  it('Previous button is disabled on first page', () => {
    const fakePdf = btoa('fake pdf content');
    render(<PdfViewer pdfData={fakePdf} compiling={false} />);
    expect(screen.getByText('Previous')).toBeDisabled();
  });

  it('displays page info text', () => {
    const fakePdf = btoa('fake');
    render(<PdfViewer pdfData={fakePdf} compiling={false} />);
    expect(screen.getByText(/Page \d+ of \d+/)).toBeInTheDocument();
  });
});
