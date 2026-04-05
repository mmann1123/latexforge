import { StateField, StateEffect, Facet, RangeSetBuilder } from '@codemirror/state';
import { gutter, GutterMarker, EditorView, showTooltip, Decoration, ViewPlugin } from '@codemirror/view';

// ── State Effects ───────────────────────────────────────────

/** Replace all comments (used on load / real-time sync). */
export const setCommentsEffect = StateEffect.define();

/** Open/close the comment tooltip for a given line (null = close). */
const showCommentLine = StateEffect.define();

// ── State Fields ────────────────────────────────────────────

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

/** Tracks which line number's tooltip is open (null = none). */
const openCommentLine = StateField.define({
  create() {
    return null;
  },
  update(line, tr) {
    for (const e of tr.effects) {
      if (e.is(showCommentLine)) return e.value;
    }
    return line;
  },
  provide(field) {
    return showTooltip.computeN([field, commentsField], (state) => {
      const lineNum = state.field(field);
      if (lineNum === null) return [];
      const comments = state.field(commentsField);
      const lineComments = comments.filter((c) => c.line === lineNum);
      if (lineComments.length === 0) return [];

      const line = state.doc.line(Math.min(lineNum, state.doc.lines));
      return [{
        pos: line.from,
        above: true,
        create(view) {
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
              // Close tooltip after resolving
              view.dispatch({ effects: showCommentLine.of(null) });
            });
            item.appendChild(resolveBtn);

            container.appendChild(item);
          }

          return { dom: container };
        },
      }];
    });
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

class AddCommentMarker extends GutterMarker {
  toDOM() {
    const el = document.createElement('div');
    el.className = 'cm-comment-add';
    el.textContent = '+';
    return el;
  }
}

const addMarker = new AddCommentMarker();

const commentGutter = gutter({
  class: 'cm-comment-gutter',
  lineMarker(view, line) {
    const comments = view.state.field(commentsField);
    const lineNum = view.state.doc.lineAt(line.from).number;
    let count = 0;
    for (const c of comments) {
      if (c.line === lineNum) count++;
    }
    return count > 0 ? new CommentMarker(count) : addMarker;
  },
  initialSpacer: () => new CommentMarker(0),
  domEventHandlers: {
    click(view, line) {
      const lineNum = view.state.doc.lineAt(line.from).number;
      const comments = view.state.field(commentsField);
      const hasComments = comments.some((c) => c.line === lineNum);

      if (hasComments) {
        // Toggle tooltip: close if already open on this line, open otherwise
        const current = view.state.field(openCommentLine);
        view.dispatch({
          effects: showCommentLine.of(current === lineNum ? null : lineNum),
        });
      } else {
        // No comments on this line — add new comment
        view.dom.dispatchEvent(new CustomEvent('comment-gutter-click', {
          detail: { line: lineNum },
          bubbles: true,
        }));
      }
      return true;
    },
  },
});

// Close tooltip on Escape or clicking in the editor content
const closeOnEscape = EditorView.domEventHandlers({
  keydown(event, view) {
    if (event.key === 'Escape' && view.state.field(openCommentLine) !== null) {
      view.dispatch({ effects: showCommentLine.of(null) });
      return true;
    }
    return false;
  },
  mousedown(event, view) {
    // Close tooltip when clicking in the editor (not on the tooltip itself)
    if (view.state.field(openCommentLine) !== null &&
        !event.target.closest('.cm-comment-tooltip')) {
      view.dispatch({ effects: showCommentLine.of(null) });
    }
    return false;
  },
});

// ── Line Highlight ──────────────────────────────────────────

const commentLineDeco = Decoration.line({ class: 'cm-comment-line' });

const commentLineHighlight = ViewPlugin.fromClass(class {
  constructor(view) {
    this.decorations = this.build(view);
  }
  update(update) {
    if (update.docChanged || update.state.field(commentsField) !== update.startState.field(commentsField)) {
      this.decorations = this.build(update.view);
    }
  }
  build(view) {
    const builder = new RangeSetBuilder();
    const comments = view.state.field(commentsField);
    const seen = new Set();
    for (const c of comments) {
      if (c.line >= 1 && c.line <= view.state.doc.lines && !seen.has(c.line)) {
        seen.add(c.line);
        const line = view.state.doc.line(c.line);
        builder.add(line.from, line.from, commentLineDeco);
      }
    }
    return builder.finish();
  }
}, { decorations: (v) => v.decorations });

// ── Theme ───────────────────────────────────────────────────

const commentTheme = EditorView.baseTheme({
  '.cm-comment-gutter': {
    width: '16px',
    cursor: 'pointer',
  },
  '.cm-comment-add': {
    color: 'rgba(76, 175, 80, 0.5)',
    fontSize: '14px',
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: '1.4',
    opacity: '0',
  },
  '.cm-comment-gutter .cm-gutterElement:hover .cm-comment-add': {
    opacity: '1',
  },
  '.cm-comment-marker': {
    color: '#4caf50',
    fontSize: '12px',
    lineHeight: '1.4',
    textAlign: 'center',
  },
  '.cm-comment-line': {
    backgroundColor: 'rgba(76, 175, 80, 0.08)',
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
    openCommentLine,
    commentGutter,
    commentLineHighlight,
    closeOnEscape,
    commentTheme,
  ];
}
