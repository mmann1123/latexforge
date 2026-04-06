import { useRef, useState, useEffect } from 'react';
import 'mathlive';

export default function MathLiveDialog({ onInsert, onClose }) {
  const mathFieldRef = useRef(null);
  const [mode, setMode] = useState('display');

  useEffect(() => {
    // Focus the math field when dialog opens
    const mf = mathFieldRef.current;
    if (mf) {
      requestAnimationFrame(() => mf.focus());
    }
  }, []);

  function handleInsert() {
    const mf = mathFieldRef.current;
    if (!mf) return;
    const latex = mf.value;
    if (!latex.trim()) return;

    const wrapped = mode === 'display'
      ? `\\[\n${latex}\n\\]`
      : `$${latex}$`;
    onInsert(wrapped);
    onClose();
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleInsert();
  }

  return (
    <div className="share-dialog-overlay" onClick={onClose} onKeyDown={handleKeyDown}>
      <div className="mathlive-dialog" onClick={(e) => e.stopPropagation()}>
        <button className="share-dialog-close" onClick={onClose}>&times;</button>
        <h3>Formula Editor</h3>
        <p className="mathlive-hint">
          Type LaTeX or use the virtual keyboard to build your equation.
          Press Ctrl+Enter to insert.
        </p>
        <math-field
          ref={mathFieldRef}
          class="mathlive-field"
          virtual-keyboard-mode="manual"
        />
        <div className="mathlive-controls">
          <div className="mathlive-mode-toggle">
            <label>
              <input
                type="radio"
                name="mathmode"
                value="display"
                checked={mode === 'display'}
                onChange={() => setMode('display')}
              />
              Display math <code>\[...\]</code>
            </label>
            <label>
              <input
                type="radio"
                name="mathmode"
                value="inline"
                checked={mode === 'inline'}
                onChange={() => setMode('inline')}
              />
              Inline math <code>$...$</code>
            </label>
          </div>
          <div className="mathlive-actions">
            <button className="btn mathlive-btn-cancel" onClick={onClose}>Cancel</button>
            <button className="btn mathlive-btn-insert" onClick={handleInsert}>Insert</button>
          </div>
        </div>
      </div>
    </div>
  );
}
