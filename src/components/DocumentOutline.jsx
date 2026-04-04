import { useState, useEffect, useRef, useCallback } from 'react';

const LEVEL_MAP = {
  part: 0,
  chapter: 1,
  section: 2,
  subsection: 3,
  subsubsection: 4,
  paragraph: 5,
};

const SECTION_REGEX = /^\\(part|chapter|section|subsection|subsubsection|paragraph)\*?\{(.+?)\}/gm;

function parseOutline(content) {
  if (!content) return [];
  const items = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    SECTION_REGEX.lastIndex = 0;
    const match = SECTION_REGEX.exec(lines[i]);
    if (match) {
      items.push({
        title: match[2].replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1').replace(/[{}\\]/g, ''),
        level: LEVEL_MAP[match[1]] ?? 2,
        line: i + 1,
      });
    }
  }
  return items;
}

function nestOutline(flatItems) {
  const result = [];
  const stack = [];

  for (const item of flatItems) {
    const node = { ...item, children: [] };

    while (stack.length && stack[stack.length - 1].level >= node.level) {
      stack.pop();
    }

    if (stack.length) {
      stack[stack.length - 1].children.push(node);
    } else {
      result.push(node);
    }
    stack.push(node);
  }
  return result;
}

function OutlineItem({ item, onJumpToLine, depth }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = item.children && item.children.length > 0;

  return (
    <li>
      <div
        className="outline-item"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          <button
            className="outline-toggle"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? '\u25BE' : '\u25B8'}
          </button>
        ) : (
          <span className="outline-toggle-spacer" />
        )}
        <button
          className="outline-title"
          onClick={() => onJumpToLine(item.line)}
          title={`Line ${item.line}`}
        >
          {item.title}
        </button>
      </div>
      {expanded && hasChildren && (
        <ul className="outline-list">
          {item.children.map((child, i) => (
            <OutlineItem
              key={`${child.line}-${i}`}
              item={child}
              onJumpToLine={onJumpToLine}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function DocumentOutline({ content, onJumpToLine }) {
  const [outline, setOutline] = useState([]);
  const [collapsed, setCollapsed] = useState(false);
  const [height, setHeight] = useState(() => Number(localStorage.getItem('latexforge-outline-height')) || 200);
  const timerRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const flat = parseOutline(content);
      setOutline(nestOutline(flat));
    }, 500);
    return () => clearTimeout(timerRef.current);
  }, [content]);

  useEffect(() => {
    localStorage.setItem('latexforge-outline-height', height);
  }, [height]);

  const handleDragStart = useCallback((e) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = height;

    function onMouseMove(ev) {
      const dy = startY - ev.clientY;
      setHeight(Math.max(80, Math.min(500, startHeight + dy)));
    }
    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [height]);

  if (outline.length === 0) return null;

  return (
    <div className="document-outline" ref={containerRef} style={{ height: collapsed ? 'auto' : height, minHeight: 0 }}>
      <div className="outline-resize-handle" onMouseDown={handleDragStart} />
      <div className="outline-header" onClick={() => setCollapsed(!collapsed)}>
        <span className="outline-header-toggle">{collapsed ? '\u25B8' : '\u25BE'}</span>
        <span>Outline</span>
      </div>
      {!collapsed && (
        <ul className="outline-list outline-root">
          {outline.map((item, i) => (
            <OutlineItem
              key={`${item.line}-${i}`}
              item={item}
              onJumpToLine={onJumpToLine}
              depth={0}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
