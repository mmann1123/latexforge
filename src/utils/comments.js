import { StateField, StateEffect, RangeSet } from '@codemirror/state';
import { gutter, GutterMarker, EditorView, hoverTooltip } from '@codemirror/view';

// ── State Effects ───────────────────────────────────────────

/** Replace all comments (used on load / real-time sync). */
export const setCommentsEffect = StateEffect.define();

// ── State Field ─────────────────────────────────────────────

export const commentsField = StateField.define({
  create() {
    return [];
  },
  update(comments, tr) {
    for (const e of tr.effects) {
      if (e.is(setCommentsEffect)) return e.value;
    }
    return comments;
  },
});

// ── Gutter Marker ───────────────────────────────────────────

class CommentMarker extends GutterMarker {
  constructor(count) {
    super();
    this.count = count;
  }

  toDOM() {
    const el = document.createElement('div');
    el.className = 'cm-comment-marker';
    el.textContent = '\u25CF'; // filled circle
    if (this.count > 1) el.title = `${this.count} comments`;
    return el;
  }
}

const commentGutter = gutter({
  class: 'cm-comment-gutter',
  markers(view) {
    const comments = view.state.field(commentsField);
    const markers = [];
    // Group by line number
    const byLine = {};
    for (const c of comments) {
      if (c.line >= 1 && c.line <= view.state.doc.lines) {
        byLine[c.line] = (byLine[c.line] || 0) + 1;
      }
    }
    for (const [lineNum, count] of Object.entries(byLine)) {
      const line = view.state.doc.line(Number(lineNum));
      markers.push(line.from, new CommentMarker(count));
    }
    return RangeSet.of(markers, true);
  },
  domEventHandlers: {
    click(view, line) {
      const lineNum = view.state.doc.lineAt(line.from).number;
      // Dispatch custom event for the editor to handle
      view.dom.dispatchEvent(new CustomEvent('comment-gutter-click', {
        detail: { line: lineNum },
        bubbles: true,
      }));
      return true;
    },
  },
});

// ── Hover Tooltip ───────────────────────────────────────────

const commentTooltip = hoverTooltip((view, pos) => {
  const line = view.state.doc.lineAt(pos);
  const lineNum = line.number;
  const comments = view.state.field(commentsField);
  const lineComments = comments.filter((c) => c.line === lineNum);
  if (lineComments.length === 0) return null;

  return {
    pos: line.from,
    above: true,
    create() {
      const container = document.createElement('div');
      container.className = 'cm-comment-tooltip';

      for (const c of lineComments) {
        const item = document.createElement('div');
        item.className = 'cm-comment-tooltip-item';

        const header = document.createElement('div');
        header.className = 'cm-comment-tooltip-author';
        header.textContent = c.authorName || 'Unknown';
        item.appendChild(header);

        const body = document.createElement('div');
        body.className = 'cm-comment-tooltip-text';
        body.textContent = c.text;
        item.appendChild(body);

        const resolveBtn = document.createElement('button');
        resolveBtn.className = 'cm-comment-resolve-btn';
        resolveBtn.textContent = 'Resolve';
        resolveBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          view.dom.dispatchEvent(new CustomEvent('comment-resolve', {
            detail: { commentId: c.id },
            bubbles: true,
          }));
        });
        item.appendChild(resolveBtn);

        container.appendChild(item);
      }

      return { dom: container };
    },
  };
});

// ── Right-click context menu ────────────────────────────────

const commentContextMenu = EditorView.domEventHandlers({
  contextmenu(event, view) {
    // Don't override if the browser context menu is wanted (e.g., on selected text for copy)
    // We add our item to a custom menu instead
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
    if (pos === null) return false;
    const lineNum = view.state.doc.lineAt(pos).number;

    // Store the line number for the context menu handler
    view.dom.dataset.commentLine = lineNum;
    return false; // Don't prevent default — let the browser menu show
  },
});

// ── Theme ───────────────────────────────────────────────────

const commentTheme = EditorView.baseTheme({
  '.cm-comment-gutter': {
    width: '16px',
    cursor: 'pointer',
  },
  '.cm-comment-marker': {
    color: '#4caf50',
    fontSize: '12px',
    lineHeight: '1.4',
    textAlign: 'center',
  },
  '.cm-comment-tooltip': {
    background: '#2a2a2a',
    border: '1px solid #4caf50',
    borderRadius: '6px',
    padding: '8px',
    maxWidth: '300px',
    fontSize: '13px',
    color: '#ddd',
  },
  '.cm-comment-tooltip-item': {
    marginBottom: '8px',
    '&:last-child': { marginBottom: '0' },
  },
  '.cm-comment-tooltip-author': {
    fontWeight: '600',
    color: '#4caf50',
    marginBottom: '2px',
    fontSize: '12px',
  },
  '.cm-comment-tooltip-text': {
    lineHeight: '1.4',
    marginBottom: '4px',
  },
  '.cm-comment-resolve-btn': {
    background: 'none',
    border: '1px solid #4caf50',
    color: '#4caf50',
    borderRadius: '3px',
    padding: '2px 8px',
    fontSize: '11px',
    cursor: 'pointer',
    '&:hover': {
      background: '#4caf50',
      color: '#fff',
    },
  },
});

// ── Export ───────────────────────────────────────────────────

export function commentsExtension() {
  return [
    commentsField,
    commentGutter,
    commentTooltip,
    commentTheme,
  ];
}
