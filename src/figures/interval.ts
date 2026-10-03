// /interval [0,1)
// /interval (-inf, 2] U (3, 5)
// /interval 0 <= x < 1        inequalities work too
// /interval x > 3

import { parseNumber } from './expr';
import { svg, line, circle, text, arrow, niceStep, ticks, COLORS, INK } from './svg';
import { fail, type ArgTools, type FigureCommand } from './types';

export interface Interval {
  lo: number;
  hi: number;
  loClosed: boolean;
  hiClosed: boolean;
  loText: string;
  hiText: string;
}

const INF = /^[+-]?\s*(inf|infty|infinity|oo|∞)$/i;

export const interval: FigureCommand = {
  name: 'interval',
  area: 'Graphs of functions',
  example: '/interval [0,1)',
  description: 'Intervals on a number line. Unions with U, and inequalities like 0 <= x < 1.',
  draw(args, tools) {
    const pieces = args.split(/\s*(?:∪|\bu\b|\bor\b|\bunion\b|\n)\s*/i).filter((p) => p.trim());
    if (pieces.length === 0) return fail(`Which interval? e.g. ${interval.example}`);
    const parts: Interval[] = [];
    for (const piece of pieces) {
      // A piece may still hold several intervals written side by side: "[0,1) (2,3]".
      const found = readIntervals(piece.trim(), tools);
      if (typeof found === 'string') return fail(found);
      parts.push(...found);
    }
    return { ok: true, svg: drawNumberLine(parts), notes: [] };
  },
};

function readIntervals(src: string, tools: ArgTools): Interval[] | string {
  const bracketed = [...src.matchAll(/([[(])\s*([^,;[\]()]+?)\s*[,;]\s*([^,;[\]()]+?)\s*([\])])/g)];
  if (bracketed.length) {
    const out: Interval[] = [];
    for (const m of bracketed) {
      const lo = endpoint(m[2], tools), hi = endpoint(m[3], tools);
      if (lo === null || hi === null) return `Couldn't read the endpoints of “${m[0]}”.`;
      if (lo > hi) return `In “${m[0]}” the left end should be the smaller one.`;
      out.push({ lo, hi, loClosed: m[1] === '[' && lo !== -Infinity, hiClosed: m[4] === ']' && hi !== Infinity, loText: m[2], hiText: m[3] });
    }
    return out;
  }

  // a..b means the closed interval [a, b].
  const dots = src.match(/^(.+?)\s*(?:\.\.+|…)\s*(.+)$/);
  if (dots) {
    const lo = endpoint(dots[1], tools), hi = endpoint(dots[2], tools);
    if (lo === null || hi === null || lo > hi) return `Couldn't read “${src}”. Try: ${interval.example}`;
    return [{ lo, hi, loClosed: true, hiClosed: true, loText: dots[1], hiText: dots[2] }];
  }

  const ineq = readInequality(src, tools);
  if (ineq) return [ineq];
  return `Couldn't read “${src}”. Try [0,1), (-inf, 2] or 0 <= x < 1.`;
}

function endpoint(s: string, tools: ArgTools): number | null {
  const t = s.trim();
  if (INF.test(t)) return t.startsWith('-') || t.startsWith('−') ? -Infinity : Infinity;
  return parseNumber(t, tools.fixName);
}

/** "0 <= x < 1", "x > 3", "-2 < x", "x ≥ 1" */
export function readInequality(src: string, tools: ArgTools): Interval | null {
  const s = src.replace(/≤|=</g, '<=').replace(/≥|=>/g, '>=');
  const parts = s.split(/\s*(<=|>=|<|>)\s*/);
  // parts alternate: value, op, value, op, value
  const varIndex = parts.findIndex((p, i) => i % 2 === 0 && /^[a-z]$/i.test(p.trim()));
  if (varIndex < 0 || (parts.length !== 3 && parts.length !== 5)) return null;

  const result: Interval = { lo: -Infinity, hi: Infinity, loClosed: false, hiClosed: false, loText: '−∞', hiText: '∞' };
  const apply = (value: string, op: string, valueOnLeft: boolean): boolean => {
    const v = endpoint(value, tools);
    if (v === null) return false;
    // Normalise to "x OP v".
    const flipped = valueOnLeft ? ({ '<': '>', '<=': '>=', '>': '<', '>=': '<=' } as Record<string, string>)[op] : op;
    const closed = flipped.endsWith('=');
    if (flipped.startsWith('>')) Object.assign(result, { lo: v, loClosed: closed, loText: value });
    else Object.assign(result, { hi: v, hiClosed: closed, hiText: value });
    return true;
  };
  if (varIndex > 0 && !apply(parts[varIndex - 2], parts[varIndex - 1], true)) return null;
  if (varIndex < parts.length - 1 && !apply(parts[varIndex + 2], parts[varIndex + 1], false)) return null;
  return result.lo <= result.hi ? result : null;
}

// ---- Drawing ------------------------------------------------------------------------

function drawNumberLine(parts: Interval[]): string {
  const width = 460, height = 74, left = 22, right = width - 22, y = 34;
  const finite = parts.flatMap((p) => [p.lo, p.hi]).filter(Number.isFinite);
  let lo = finite.length ? Math.min(...finite) : -1;
  let hi = finite.length ? Math.max(...finite) : 1;
  const pad = Math.max(1, (hi - lo) * 0.25);
  lo -= pad;
  hi += pad;
  const sx = (v: number) => left + ((v - lo) / (hi - lo)) * (right - left);
  const color = COLORS[0];

  let body = arrow(left - 8, y, right + 12, y, { 'stroke-width': 1.3, head: 7 });
  body += arrow(right + 12, y, left - 10, y, { 'stroke-width': 1.3, head: 7 });

  // Light ticks, labelled only at 0 (endpoints get their own labels).
  const endpoints = new Set(finite.map((v) => Math.round(v * 1e6)));
  for (const t of ticks(lo, hi, niceStep(hi - lo, 8))) {
    body += line(sx(t), y - 4, sx(t), y + 4, { 'stroke-width': 1, 'stroke-opacity': 0.5 });
    if (t === 0 && !endpoints.has(0)) body += text(sx(0), y + 22, '0', { 'font-size': 12, 'text-anchor': 'middle', 'fill-opacity': 0.7 });
  }

  for (const p of parts) {
    const x1 = Number.isFinite(p.lo) ? sx(p.lo) : left - 6;
    const x2 = Number.isFinite(p.hi) ? sx(p.hi) : right + 8;
    body += line(x1, y, x2, y, { stroke: color, 'stroke-width': 5, 'stroke-linecap': 'butt' });
    if (!Number.isFinite(p.lo)) body += arrow(x1 + 20, y, x1 - 4, y, { stroke: color, 'stroke-width': 5, head: 13 });
    if (!Number.isFinite(p.hi)) body += arrow(x2 - 20, y, x2 + 4, y, { stroke: color, 'stroke-width': 5, head: 13 });
    for (const [v, closed, label] of [[p.lo, p.loClosed, p.loText], [p.hi, p.hiClosed, p.hiText]] as const) {
      if (!Number.isFinite(v)) continue;
      body += circle(sx(v), y, 6, {
        stroke: color, 'stroke-width': 2.2,
        fill: closed ? color : undefined,
        style: closed ? undefined : 'fill: var(--paper, #fff)',
      });
      body += text(sx(v), y + 24, pretty(label), { 'font-size': 14, 'text-anchor': 'middle', fill: INK });
    }
  }
  const label = parts.map((p) => `${p.loClosed ? '[' : '('}${p.loText}, ${p.hiText}${p.hiClosed ? ']' : ')'}`).join(' ∪ ');
  return svg(width, height, body, `Interval ${label}`);
}

function pretty(s: string): string {
  return s.trim().replace(/\bpi\b/g, 'π').replace(/\bsqrt\s*/g, '√').replace(/^-/, '−');
}
