import { describe, it, expect } from 'vitest';
import { latexCompletionSource } from './latexCompletions.js';

// Minimal mock of CodeMirror's CompletionContext
function mockContext(text, pos, explicit = false) {
  return {
    explicit,
    matchBefore(regex) {
      const line = text.slice(0, pos);
      const match = line.match(regex);
      if (!match) return null;
      return { from: pos - match[0].length, to: pos, text: match[0] };
    },
  };
}

describe('latexCompletionSource', () => {
  it('returns completions when typing a backslash command', () => {
    const result = latexCompletionSource(mockContext('\\sec', 4));
    expect(result).not.toBeNull();
    expect(result.from).toBe(0);
    expect(result.options.length).toBeGreaterThan(0);
    const labels = result.options.map((o) => o.label);
    expect(labels).toContain('\\section');
  });

  it('returns null when no backslash is present', () => {
    const result = latexCompletionSource(mockContext('hello', 5));
    expect(result).toBeNull();
  });

  it('returns null for empty backslash without explicit trigger', () => {
    const result = latexCompletionSource(mockContext('text ', 5));
    expect(result).toBeNull();
  });

  it('includes environment completions', () => {
    const result = latexCompletionSource(mockContext('\\begin', 6));
    expect(result).not.toBeNull();
    const labels = result.options.map((o) => o.label);
    expect(labels).toContain('\\begin{equation}');
    expect(labels).toContain('\\begin{figure}');
    expect(labels).toContain('\\begin{itemize}');
  });

  it('includes Greek letter completions', () => {
    const result = latexCompletionSource(mockContext('\\alp', 4));
    expect(result).not.toBeNull();
    const labels = result.options.map((o) => o.label);
    expect(labels).toContain('\\alpha');
  });

  it('includes math commands', () => {
    const result = latexCompletionSource(mockContext('\\fra', 4));
    expect(result).not.toBeNull();
    const labels = result.options.map((o) => o.label);
    expect(labels).toContain('\\frac');
  });

  it('includes package suggestions', () => {
    const result = latexCompletionSource(mockContext('\\usepackage', 11));
    expect(result).not.toBeNull();
    const labels = result.options.map((o) => o.label);
    expect(labels).toContain('\\usepackage{amsmath}');
    expect(labels).toContain('\\usepackage{graphicx}');
  });

  it('every completion has a label and type', () => {
    const result = latexCompletionSource(mockContext('\\', 1, true));
    expect(result).not.toBeNull();
    for (const opt of result.options) {
      expect(opt.label).toBeDefined();
      expect(opt.type).toBeDefined();
      expect(typeof opt.label).toBe('string');
      expect(opt.label.startsWith('\\')).toBe(true);
    }
  });
});
