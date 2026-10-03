// /signchart (x-1)(x+2)^2/(x-3)
// A sign table: one row per factor and one for the whole function, with the
// zeros and the points where it is undefined.

import { parseExpression } from './expr';
import { splitRange } from './range';
import { splitClauses } from './args';
import { svg, line, text, COLORS, INK } from './svg';
import { fail, firstLine, type FigureCommand } from './types';

type Fn1 = (x: number) => number;

/** Split "x(x-1)^2" into ["x", "(x-1)^2"], at the top level only. */
function factorsOf(src: string): string[] {
  const s = src.replace(/\s+/g, '');
  const out: string[] = [];
  const skipGroup = (j: number) => {
    let depth = 0;
    for (; j < s.length; j++) {
      if (s[j] === '(') depth++;
      else if (s[j] === ')' && --depth === 0) return j + 1;
    }
    return j;
  };
  let i = 0;
  while (i < s.length) {
    if (s[i] === '*') { i++; continue; }
    let j = i;
    if (s[i] === '(') {
      j = skipGroup(i);
    } else {
      while (j < s.length && s[j] !== '*' && s[j] !== '(') j++;
      // A function call such as sin(x) keeps its argument.
      if (s[j] === '(' && /(sin|cos|tan|sec|csc|cot|ln|log|exp|sqrt|abs)$/i.test(s.slice(i, j))) j = skipGroup(j);
    }
    const pow = s.slice(j).match(/^\^(\d+|\([^()]*\))/);
    if (pow) j += pow[0].length;
    out.push(s.slice(i, j));
    i = j;
  }
  return out;
}

/** Zeros of g in [a, b]: sign changes plus touching zeros (like (x-1)^2). */
function zerosOf(g: Fn1, a: number, b: number): number[] {
  const N = 2000;
  const xs = Array.from({ length: N + 1 }, (_, i) => a + ((b - a) * i) / N);
  const ys = xs.map(g);
  const roots: number[] = [];
  const add = (r: number) => { if (!roots.some((q) => Math.abs(q - r) < 1e-6)) roots.push(r); };
  for (let i = 0; i < N; i++) {
    const [y0, y1] = [ys[i], ys[i + 1]];
    if (!Number.isFinite(y0) || !Number.isFinite(y1)) continue;
    if (y0 === 0) { add(xs[i]); continue; }
    if ((y0 < 0) !== (y1 < 0)) {
      let lo = xs[i], hi = xs[i + 1];
      for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if ((g(m) < 0) === (y0 < 0)) lo = m; else hi = m; }
      // A jump through infinity is not a zero.
      if (Math.abs(g((lo + hi) / 2)) < 1e-6 * (1 + Math.abs(y0) + Math.abs(y1))) add(snap((lo + hi) / 2));
    }
  }
  // Touching zeros: local minima of |g| that reach zero.
  for (let i = 1; i < N; i++) {
    const [p, c, n] = [Math.abs(ys[i - 1]), Math.abs(ys[i]), Math.abs(ys[i + 1])];
    if (c <= p && c <= n && c < 1e-9) add(snap(xs[i]));
  }
  return roots.sort((p, q) => p - q);
}

const snap = (v: number) => (Math.abs(v - Math.round(v * 1e6) / 1e6) < 1e-7 ? Math.round(v * 1e6) / 1e6 : v);

/** 0.5 → "1/2", 1.414… → "1.414". */
function niceValue(v: number): string {
  for (let q = 1; q <= 12; q++) {
    const p = Math.round(v * q);
    if (Math.abs(p / q - v) < 1e-7) return q === 1 ? String(p).replace('-', '−') : `${p < 0 ? '−' : ''}${Math.abs(p)}/${q}`;
  }
  const r2 = v * v;
  if (Math.abs(r2 - Math.round(r2)) < 1e-7) return `${v < 0 ? '−' : ''}√${Math.round(r2)}`;
  return String(parseFloat(v.toPrecision(4))).replace('-', '−');
}

export const signchart: FigureCommand = {
  name: 'signchart',
  area: 'Graphs of functions',
  example: '/signchart (x - 1)(x + 2)^2 / (x - 3)',
  description: 'Sign table of a function: one row per factor and one for f, with zeros (0) and undefined points (‖).',
  draw(args, tools) {
    const [first] = splitClauses(args);
    const split = splitRange((first ?? '').replace(/^\s*(f\(x\)|y)\s*=\s*/i, ''), tools);
    const src = split.body.trim();
    if (!src) return fail(`Which function? e.g. ${firstLine(signchart.example)}`);
    const [a, b] = split.range ?? [-20, 20];

    // Numerator and denominator at the top level.
    let depth = 0, slash = -1;
    for (let i = 0; i < src.length; i++) {
      if (src[i] === '(') depth++;
      else if (src[i] === ')') depth--;
      else if (src[i] === '/' && depth === 0) { slash = i; break; }
    }
    const num = slash >= 0 ? src.slice(0, slash) : src;
    const den = slash >= 0 ? src.slice(slash + 1) : '';
    const parse = (s: string) => {
      const r = parseExpression(s || '1', { vars: ['x'], fixName: tools.fixName });
      return r.ok ? ((x: number) => r.fn(x)) : null;
    };
    const f = parse(slash >= 0 ? `(${num})/(${den})` : src);
    if (!f) return fail(`Couldn't read “${src}”. Try: ${firstLine(signchart.example)}`);

    const rows: { label: string; g: Fn1; den: boolean }[] = [];
    const add = (part: string, isDen: boolean) => {
      for (const factor of factorsOf(part.replace(/^\((.*)\)$/, (m, inner) => (factorsOf(inner).length > 1 ? inner : m)))) {
        if (/^[-+]?\d*\.?\d*$/.test(factor.replace(/\s/g, ''))) continue; // constants don't change sign
        const g = parse(factor);
        if (!g) return false;
        rows.push({ label: factor, g, den: isDen });
      }
      return true;
    };
    if (!add(num, false) || (den && !add(den, true))) return fail(`Couldn't split “${src}” into factors.`);
    const showFactors = rows.length > 1 || rows.some((r) => r.den);

    const crit = [...new Set(rows.flatMap((r) => zerosOf(r.g, a, b)).map((v) => Math.round(v * 1e9) / 1e9))].sort((p, q) => p - q);
    if (!showFactors) crit.push(...zerosOf(f, a, b).filter((z) => !crit.some((c) => Math.abs(c - z) < 1e-6)));
    crit.sort((p, q) => p - q);
    if (crit.length > 10) return fail('Too many sign changes to fit in a table; give a smaller range with “from a to b”.');

    // Test points inside each interval.
    const tests: number[] = [];
    for (let i = 0; i <= crit.length; i++) {
      const lo = i === 0 ? crit[0] - 1 : crit[i - 1];
      const hi = i === crit.length ? (crit.length ? crit[crit.length - 1] + 1 : 1) : crit[i];
      tests.push(crit.length === 0 ? 0 : i === 0 ? crit[0] - 1 : i === crit.length ? crit[crit.length - 1] + 1 : (lo + hi) / 2);
    }

    const allRows = [...(showFactors ? rows : []), { label: 'f(x)', g: f, den: false }];
    const labelW = Math.max(70, ...allRows.map((r) => r.label.length * 7.5 + 16));
    const cellW = 64, pointW = 30, rowH = 30;
    const cols = crit.length * 2 + 1;
    const width = labelW + (crit.length + 1) * cellW + crit.length * pointW + 12;
    const height = (allRows.length + 1) * rowH + 12;
    const colX = (k: number) => labelW + Math.floor((k + 1) / 2) * cellW + Math.floor(k / 2) * pointW + (k % 2 === 0 ? cellW / 2 : pointW / 2);

    let body = line(labelW, 6, labelW, height - 6, { 'stroke-width': 1.2 });
    body += line(6, rowH + 6, width - 6, rowH + 6, { 'stroke-width': 1.2 });
    body += text(labelW - 10, rowH - 4, 'x', { 'font-style': 'italic', 'text-anchor': 'end', 'font-size': 15 });
    body += text(labelW + 8, rowH - 4, '−∞', { 'font-size': 13 });
    body += text(width - 10, rowH - 4, '+∞', { 'font-size': 13, 'text-anchor': 'end' });
    crit.forEach((c, i) => {
      const x = colX(2 * i + 1);
      body += text(x, rowH - 4, niceValue(c), { 'font-size': 13, 'text-anchor': 'middle' });
      body += line(x, rowH + 6, x, height - 6, { 'stroke-width': 0.8, 'stroke-opacity': 0.3, 'stroke-dasharray': '3 3' });
    });
    const isZero = (g: Fn1, c: number) => Math.abs(g(c)) < 1e-6;
    allRows.forEach((row, r) => {
      const y = (r + 2) * rowH;
      if (r === allRows.length - 1 && showFactors) body += line(6, y - rowH + 6, width - 6, y - rowH + 6, { 'stroke-width': 0.8, 'stroke-opacity': 0.4 });
      body += text(labelW - 10, y - 4, row.label, { 'font-size': 13, 'text-anchor': 'end', 'font-style': 'italic' });
      for (let k = 0; k < cols; k++) {
        const x = colX(k);
        if (k % 2 === 0) {
          const v = row.g(tests[k / 2]);
          const plus = v > 0;
          body += text(x, y - 3, Number.isFinite(v) ? (plus ? '+' : '−') : '', { 'font-size': 18, 'text-anchor': 'middle', fill: plus ? COLORS[2] : COLORS[1], 'font-weight': 600 });
        } else {
          const c = crit[(k - 1) / 2];
          const undefinedHere = row === allRows[allRows.length - 1] ? rows.some((q) => q.den && isZero(q.g, c)) || !Number.isFinite(f(c)) : false;
          if (undefinedHere) {
            body += line(x - 2, y - rowH + 10, x - 2, y + 4, { stroke: INK, 'stroke-width': 1.3 }) + line(x + 2, y - rowH + 10, x + 2, y + 4, { stroke: INK, 'stroke-width': 1.3 });
          } else if (isZero(row.g, c)) {
            body += text(x, y - 4, '0', { 'font-size': 14, 'text-anchor': 'middle' });
          }
        }
      }
    });
    return { ok: true, svg: svg(width, height, body, `Sign chart of ${src}`), notes: [] };
  },
};
