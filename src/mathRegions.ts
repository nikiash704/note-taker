// Find where the $...$ and $$...$$ math is in a document. Both the editor
// highlighting and the equation shortcuts need to know "am I inside math?".

export interface MathRegion {
  /** Position of the first character after the opening $ or $$. */
  from: number;
  /** Position of the closing $ or $$ (or the end of the doc if unclosed). */
  to: number;
  display: boolean;
  closed: boolean;
}

/** Scan `text` and list every math region. Figure lines (starting with "/") are skipped. */
export function findMathRegions(text: string): MathRegion[] {
  const regions: MathRegion[] = [];
  let i = 0;
  let lineStart = true;
  while (i < text.length) {
    const c = text[i];
    if (lineStart && c === '/' && /[A-Za-z]/.test(text[i + 1] ?? '')) {
      // Figure command line: skip to the end of it.
      const nl = text.indexOf('\n', i);
      i = nl === -1 ? text.length : nl;
      continue;
    }
    lineStart = c === '\n';
    if (c === '\\') { i += 2; continue; }
    if (c === '`') {
      // Inline code: dollars inside it are not math.
      const end = text.indexOf('`', i + 1);
      const nl = text.indexOf('\n', i + 1);
      if (end !== -1 && (nl === -1 || end < nl)) { i = end + 1; continue; }
    }
    if (c !== '$') { i++; continue; }

    const display = text[i + 1] === '$';
    const from = i + (display ? 2 : 1);
    let j = from;
    let closed = false;
    while (j < text.length) {
      if (text[j] === '\\') { j += 2; continue; }
      // Inline math never spans a blank line.
      if (!display && text[j] === '\n' && text[j + 1] === '\n') break;
      if (text[j] === '$' && (!display || text[j + 1] === '$')) { closed = true; break; }
      j++;
    }
    regions.push({ from, to: Math.min(j, text.length), display, closed });
    i = closed ? j + (display ? 2 : 1) : j;
  }
  return regions;
}

/** The math region containing `pos`, if any. The cursor right after "$" counts as inside. */
export function mathAt(text: string, pos: number): MathRegion | null {
  for (const r of findMathRegions(text)) {
    if (pos >= r.from && pos <= r.to) return r;
    if (r.from > pos) break;
  }
  return null;
}
