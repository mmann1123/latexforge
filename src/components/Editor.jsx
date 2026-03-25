import React, { useRef, useEffect, useCallback } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, indentOnInput, StreamLanguage } from '@codemirror/language';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { autocompletion, completionKeymap } from '@codemirror/autocomplete';
import { oneDark } from '@codemirror/theme-one-dark';
import { latexCompletionSource } from '../utils/latexCompletions.js';

// Custom LaTeX stream parser
const latexStreamParser = {
  startState() {
    return { inMath: false };
  },
  token(stream, state) {
    if (stream.match('%')) {
      stream.skipToEnd();
      return 'comment';
    }
    if (stream.match(/\\[a-zA-Z@]+/)) {
      return 'keyword';
    }
    if (stream.match(/\\./)) {
      return 'escape';
    }
    if (stream.match(/[{}]/)) {
      return 'bracket';
    }
    if (stream.match(/[\[\]]/)) {
      return 'squareBracket';
    }
    if (stream.match('$$')) {
      state.inMath = !state.inMath;
      return 'atom';
    }
    if (stream.match('$')) {
      state.inMath = !state.inMath;
      return 'atom';
    }
    if (stream.match('&')) {
      return 'operator';
    }
    if (stream.match(/\d+/)) {
      return 'number';
    }
    stream.next();
    if (state.inMath) return 'string';
    return null;
  },
};

const latexLanguage = StreamLanguage.define(latexStreamParser);

export default function Editor({ value, onChange, insertRef }) {
  const containerRef = useRef(null);
  const viewRef = useRef(null);
  const isExternalUpdate = useRef(false);
  const onChangeRef = useRef(onChange);

  // Always keep the ref pointing to the latest onChange
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && !isExternalUpdate.current) {
        onChangeRef.current(update.state.doc.toString());
      }
    });

    const state = EditorState.create({
      doc: value || '',
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        drawSelection(),
        indentOnInput(),
        bracketMatching(),
        history(),
        highlightSelectionMatches(),
        latexLanguage,
        autocompletion({ override: [latexCompletionSource] }),
        oneDark,
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, ...completionKeymap, indentWithTab]),
        updateListener,
        EditorView.lineWrapping,
        EditorView.theme({
          '&': { height: '100%', fontSize: '14px' },
          '.cm-scroller': { overflow: 'auto', fontFamily: "'Source Code Pro', 'Fira Code', 'Consolas', monospace" },
        }),
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    return () => {
      view.destroy();
    };
  }, []);

  // Update content when value prop changes externally
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentValue = view.state.doc.toString();
    if (currentValue !== value) {
      isExternalUpdate.current = true;
      view.dispatch({
        changes: { from: 0, to: currentValue.length, insert: value || '' },
      });
      isExternalUpdate.current = false;
    }
  }, [value]);

  // Expose insert function to parent via ref
  useEffect(() => {
    if (insertRef) {
      insertRef.current = (snippet) => {
        const view = viewRef.current;
        if (!view) return;
        const { from, to } = view.state.selection.main;
        const selectedText = view.state.doc.sliceString(from, to);

        let insertText = snippet;
        if (snippet.includes('{}') && selectedText) {
          insertText = snippet.replace('{}', `{${selectedText}}`);
        }

        view.dispatch({
          changes: { from, to, insert: insertText },
          selection: { anchor: from + insertText.length },
        });
        view.focus();
      };
    }
  }, [insertRef]);

  return <div className="editor-container" ref={containerRef} />;
}
