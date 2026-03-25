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

export default function Toolbar({ onInsert }) {
  const [figureOpen, setFigureOpen] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);

  return (
    <div className="toolbar">
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
          Fig
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
          Tab
        </button>
        {tableOpen && (
          <div className="toolbar-dropdown-menu">
            <button onClick={() => { onInsert(TABLE_SNIPPET); setTableOpen(false); }}>
              Insert Table
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
