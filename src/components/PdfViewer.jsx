import React, { useRef, useEffect, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export default function PdfViewer({ pdfData, compiling }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  // Load PDF from base64
  useEffect(() => {
    if (!pdfData) {
      setPdfDoc(null);
      setTotalPages(0);
      setCurrentPage(1);
      return;
    }

    async function loadPdf() {
      try {
        const binaryStr = atob(pdfData);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setCurrentPage(1);
      } catch (err) {
        console.error('Error loading PDF:', err);
      }
    }

    loadPdf();
  }, [pdfData]);

  // Render current page, filling container width
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || !containerRef.current) return;

    async function renderPage() {
      try {
        const page = await pdfDoc.getPage(currentPage);
        const containerWidth = containerRef.current.clientWidth - 32; // padding
        const unscaledViewport = page.getViewport({ scale: 1 });
        const scale = containerWidth / unscaledViewport.width;
        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: context, viewport }).promise;
      } catch (err) {
        console.error('Error rendering page:', err);
      }
    }

    renderPage();
  }, [pdfDoc, currentPage]);

  // Not yet compiled
  if (!pdfData && !compiling) {
    return (
      <div className="pdf-empty">
        <p>Click Compile to generate your PDF</p>
      </div>
    );
  }

  // Compiling
  if (compiling) {
    return (
      <div className="pdf-empty">
        <div className="spinner"></div>
        <p>Compiling...</p>
      </div>
    );
  }

  function handleDownload() {
    const binaryStr = atob(pdfData);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'output.pdf';
    a.click();
    URL.revokeObjectURL(url);
  }

  // Compiled
  return (
    <div className="pdf-viewer" ref={containerRef}>
      <div className="pdf-canvas-wrap">
        <canvas ref={canvasRef} />
      </div>
      <div className="pdf-nav">
        <button
          className="pdf-nav-btn"
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage <= 1}
        >
          Previous
        </button>
        <span className="pdf-page-info">
          Page {currentPage} of {totalPages}
        </span>
        <button
          className="pdf-nav-btn"
          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          disabled={currentPage >= totalPages}
        >
          Next
        </button>
        <button className="pdf-nav-btn pdf-download-btn" onClick={handleDownload}>
          Download PDF
        </button>
      </div>
    </div>
  );
}
