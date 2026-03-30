import React, { useState } from 'react';

const FIGURE_SNIPPET = `\\begin{figure}[h]
  \\centering
  \\includegraphics[width=0.8\\textwidth]{filename}
  \\caption{Caption here}
  \\label{fig:label}
\\end{figure}`;

const TABLE_SNIPPET = `\\begin{table}[h]
  \\centering
  \\begin{tabular}{|c|c|c|}
    \\hline
    A & B & C \\\\
    \\hline
    1 & 2 & 3 \\\\
    \\hline
  \\end{tabular}
  \\caption{Caption here}
  \\label{tab:label}
\\end{table}`;

const BULLET_SNIPPET = `\\begin{itemize}
  \\item
  \\item
\\end{itemize}`;

const NUMBERED_SNIPPET = `\\begin{enumerate}
  \\item
  \\item
\\end{enumerate}`;

export default function Toolbar({ onInsert, onUndo, onRedo }) {
  const [figureOpen, setFigureOpen] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);

  return (
    <div className="toolbar">
      {onUndo && (
        <button className="toolbar-btn" title="Undo (Ctrl+Z)" onClick={onUndo}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M4.7 7.3L2 10l2.7 2.7.6-.7L3.8 10.5H10c1.9 0 3.5-1.6 3.5-3.5S11.9 3.5 10 3.5H7v1h3c1.4 0 2.5 1.1 2.5 2.5S11.4 9.5 10 9.5H3.8L5.3 8l-.6-.7z"/></svg>
        </button>
      )}
      {onRedo && (
        <button className="toolbar-btn" title="Redo (Ctrl+Shift+Z)" onClick={onRedo}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M11.3 7.3L14 10l-2.7 2.7-.6-.7 1.5-1.5H6c-1.9 0-3.5-1.6-3.5-3.5S4.1 3.5 6 3.5h3v1H6C4.6 4.5 3.5 5.6 3.5 7S4.6 9.5 6 9.5h6.2L10.7 8l.6-.7z"/></svg>
        </button>
      )}
      <span className="toolbar-sep" />
      <button className="toolbar-btn" title="Bold (\\textbf)" onClick={() => onInsert('\\textbf{}')}>
        <strong>B</strong>
      </button>
      <button className="toolbar-btn toolbar-btn-italic" title="Italic (\\textit)" onClick={() => onInsert('\\textit{}')}>
        <em>I</em>
      </button>
      <span className="toolbar-sep" />
      <button className="toolbar-btn" title="Section (\\section)" onClick={() => onInsert('\\section{}')}>
        &sect;
      </button>
      <span className="toolbar-sep" />
      <button className="toolbar-btn" title="Display math ($$...$$)" onClick={() => onInsert('$$\n\n$$')}>
        &sum;
      </button>
      <button className="toolbar-btn" title="Inline math ($...$)" onClick={() => onInsert('$  $')}>
        $
      </button>
      <span className="toolbar-sep" />

      {/* Figure dropdown */}
      <div className="toolbar-dropdown">
        <button
          className="toolbar-btn"
          title="Insert figure environment"
          onClick={() => { setFigureOpen(!figureOpen); setTableOpen(false); }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M14 2H2C1.45 2 1 2.45 1 3V13C1 13.55 1.45 14 2 14H14C14.55 14 15 13.55 15 13V3C15 2.45 14.55 2 14 2ZM14 13H2V3H14V13ZM4 11L6.5 7.5L8.5 10L10 8L12 11H4Z"/></svg>
        </button>
        {figureOpen && (
          <div className="toolbar-dropdown-menu">
            <button onClick={() => { onInsert(FIGURE_SNIPPET); setFigureOpen(false); }}>
              Insert Figure
            </button>
          </div>
        )}
      </div>

      {/* Table dropdown */}
      <div className="toolbar-dropdown">
        <button
          className="toolbar-btn"
          title="Insert table environment"
          onClick={() => { setTableOpen(!tableOpen); setFigureOpen(false); }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M1 2V14H15V2H1ZM6 13H2V10H6V13ZM6 9H2V6H6V9ZM6 5H2V3H6V5ZM10 13H7V10H10V13ZM10 9H7V6H10V9ZM10 5H7V3H10V5ZM14 13H11V10H14V13ZM14 9H11V6H14V9ZM14 5H11V3H14V5Z"/></svg>
        </button>
        {tableOpen && (
          <div className="toolbar-dropdown-menu">
            <button onClick={() => { onInsert(TABLE_SNIPPET); setTableOpen(false); }}>
              Insert Table
            </button>
          </div>
        )}
      </div>

      <span className="toolbar-sep" />

      {/* Bullet list */}
      <button className="toolbar-btn" title="Bullet list (\begin{itemize})" onClick={() => onInsert(BULLET_SNIPPET)}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="3" cy="4" r="1.5"/><rect x="6" y="3" width="9" height="2" rx="0.5"/><circle cx="3" cy="8" r="1.5"/><rect x="6" y="7" width="9" height="2" rx="0.5"/><circle cx="3" cy="12" r="1.5"/><rect x="6" y="11" width="9" height="2" rx="0.5"/></svg>
      </button>

      {/* Numbered list */}
      <button className="toolbar-btn" title="Numbered list (\begin{enumerate})" onClick={() => onInsert(NUMBERED_SNIPPET)}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><text x="1.5" y="5.5" fontSize="5" fontWeight="700" fontFamily="sans-serif">1</text><rect x="6" y="3" width="9" height="2" rx="0.5"/><text x="1.5" y="9.5" fontSize="5" fontWeight="700" fontFamily="sans-serif">2</text><rect x="6" y="7" width="9" height="2" rx="0.5"/><text x="1.5" y="13.5" fontSize="5" fontWeight="700" fontFamily="sans-serif">3</text><rect x="6" y="11" width="9" height="2" rx="0.5"/></svg>
      </button>
    </div>
  );
}
