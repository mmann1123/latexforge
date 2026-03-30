import nspell from 'nspell';
import { linter, lintGutter } from '@codemirror/lint';

// Singleton spell checker instance
let speller = null;
let loadPromise = null;

// Words to never flag (LaTeX terms, common abbreviations)
const CUSTOM_WORDS = new Set([
  'itemize', 'enumerate', 'tabular', 'includegraphics', 'textbf', 'textit',
  'documentclass', 'usepackage', 'bibliographystyle', 'bibliography',
  'maketitle', 'tableofcontents', 'newcommand', 'renewcommand',
  'hline', 'centering', 'caption', 'label', 'ref', 'cite', 'citep', 'citet',
  'emph', 'footnote', 'href', 'url', 'vspace', 'hspace', 'noindent',
  'et', 'al', 'cf', 'ibid', 'eg', 'ie', 'etc', 'vs',
  'pdf', 'tex', 'bib', 'cls', 'sty', 'bst', 'png', 'jpg', 'svg',
  'arxiv', 'doi', 'isbn', 'issn',
]);

function loadDictionary() {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const [affResp, dicResp] = await Promise.all([
        fetch('/dictionaries/en/index.aff'),
        fetch('/dictionaries/en/index.dic'),
      ]);
      if (!affResp.ok || !dicResp.ok) throw new Error('Failed to load dictionary');
      const [aff, dic] = await Promise.all([affResp.text(), dicResp.text()]);
      speller = nspell(aff, dic);
    } catch (err) {
      console.warn('Spell check: failed to load dictionary', err);
      loadPromise = null; // Allow retry
    }
  })();
  return loadPromise;
}

/**
 * Extract plain text ranges from a document using the LaTeX stream parser.
 * Only returns ranges where the parser returns null (prose text, not in math mode).
 */
function getPlainTextRanges(doc, parser, fromLine, toLine) {
  const ranges = [];
  const state = parser.startState();

  for (let lineNum = 1; lineNum <= Math.min(toLine, doc.lines); lineNum++) {
    const line = doc.line(lineNum);
    const lineText = line.text;
    let pos = 0;

    // Simple stream-like tokenizer that mirrors CodeMirror's StreamLanguage
    while (pos < lineText.length) {
      const startPos = pos;
      let tokenType = null;

      // Try each pattern from the parser in order
      const rest = lineText.slice(pos);

      if (rest.startsWith('%')) {
        // Comment — skip rest of line
        pos = lineText.length;
        tokenType = 'comment';
      } else {
        const cmdMatch = rest.match(/^\\[a-zA-Z@]+/);
        if (cmdMatch) {
          pos += cmdMatch[0].length;
          tokenType = 'keyword';
        } else if (rest.match(/^\\./)) {
          pos += 2;
          tokenType = 'escape';
        } else if (rest.match(/^[{}]/)) {
          pos += 1;
          tokenType = 'bracket';
        } else if (rest.match(/^[\[\]]/)) {
          pos += 1;
          tokenType = 'squareBracket';
        } else if (rest.startsWith('$$')) {
          pos += 2;
          state.inMath = !state.inMath;
          tokenType = 'atom';
        } else if (rest.startsWith('$')) {
          pos += 1;
          state.inMath = !state.inMath;
          tokenType = 'atom';
        } else if (rest.startsWith('&')) {
          pos += 1;
          tokenType = 'operator';
        } else {
          const numMatch = rest.match(/^\d+/);
          if (numMatch) {
            pos += numMatch[0].length;
            tokenType = 'number';
          } else {
            pos += 1;
            tokenType = state.inMath ? 'string' : null;
          }
        }
      }

      // Collect plain text ranges (null token, not in math) only in visible area
      if (tokenType === null && lineNum >= fromLine) {
        const from = line.from + startPos;
        const to = line.from + pos;
        // Merge with previous range if adjacent
        if (ranges.length > 0 && ranges[ranges.length - 1].to === from) {
          ranges[ranges.length - 1].to = to;
        } else {
          ranges.push({ from, to });
        }
      }
    }
  }

  return ranges;
}

/**
 * Create a CodeMirror linter that spell-checks only plain text in LaTeX documents.
 */
function createSpellLinter(parser) {
  // Start loading dictionary immediately
  loadDictionary();

  return (view) => {
    if (!speller) return [];

    const { doc } = view.state;
    const diagnostics = [];

    for (const { from, to } of view.visibleRanges) {
      const fromLine = doc.lineAt(from).number;
      const toLine = doc.lineAt(to).number;
      const plainRanges = getPlainTextRanges(doc, parser, fromLine, toLine);

      for (const range of plainRanges) {
        const text = doc.sliceString(range.from, range.to);
        // Split into words
        const wordRegex = /[a-zA-Z']+/g;
        let match;
        while ((match = wordRegex.exec(text)) !== null) {
          const word = match[0];
          // Skip short words, all-caps (acronyms), custom list
          if (word.length < 3) continue;
          if (word === word.toUpperCase()) continue;
          if (CUSTOM_WORDS.has(word.toLowerCase())) continue;
          // Strip leading/trailing apostrophes
          const clean = word.replace(/^'+|'+$/g, '');
          if (clean.length < 3) continue;

          if (!speller.correct(clean)) {
            const wordFrom = range.from + match.index;
            const wordTo = wordFrom + word.length;
            const suggestions = speller.suggest(clean).slice(0, 5);

            diagnostics.push({
              from: wordFrom,
              to: wordTo,
              severity: 'info',
              message: `"${clean}" — possible misspelling`,
              actions: suggestions.map((s) => ({
                name: s,
                apply(view, from, to) {
                  view.dispatch({ changes: { from, to, insert: s } });
                },
              })),
            });
          }
        }
      }
    }

    return diagnostics;
  };
}

/**
 * Returns CodeMirror extensions for LaTeX-aware spell checking.
 * @param {object} parser - The LaTeX stream parser object (with startState/token)
 */
export function spellCheckExtension(parser) {
  return [
    linter(createSpellLinter(parser), { delay: 750 }),
    lintGutter(),
  ];
}
