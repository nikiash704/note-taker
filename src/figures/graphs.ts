// Graphs of functions of x, and everything built on them:
//   /plot /area /tangent /secant /riemann /piecewise /taylor
// All of them understand the same extra clauses, on one line after ";" or
// on "+ …" lines:
//   tangent at 1 · secant 1 to 2 · shade 0..1 · mark (1,1) · hole (2,3)
//   asymptote x=1 · y -2..2 · x -3..3 · riemann n=4 left · no legend

import { parseExpression, compileComplex, parseNumber, type C } from './expr';
import { splitRange, readRange } from './range';
import { splitClauses, splitTopLevel, leadingKeyword, findPairs, param, stripParams, fmt } from './args';
import {
  svg, makeFrame, drawAxes, path, line, el, COLORS, looksLikePi, round, clipToBox, functionPath,
  autoRange, legend, dot, DASHED, type Frame,
} from './svg';
import { fail, firstLine, type ArgTools, type FigureCommand, type FigureOutput } from './types';
import { readInequality } from './interval';

type Fn1 = (x: number) => number;

// ---- The graph engine -------------------------------------------------------------

interface Curve {
  fn: Fn1;
  label: string;
  color?: string;
  dashed?: boolean;
  /** Only drawn between x0 and x1. */
  x0?: number;
  x1?: number;
  /** A tangent or secant: doesn't decide the y-range. */
  helper?: boolean;
}

export interface Graph {
  curves: Curve[];
  x: [number, number] | null;
  y: [number, number] | null;
  shades: { a: number; b: number; f: Fn1; g?: Fn1 }[];
  marks: { x: number; y: number; label?: string; open?: boolean; color?: string }[];
  vlines: number[];
  hlines: number[];
  rects: { x0: number; x1: number; h: number }[];
  trapezoids: [number, number, number, number][];
  /** Tangent lines asked for, drawn once the view is known. */
  tangents: number[];
  secants: [number, number][];
  riemann: { n: number; method: string } | null;
  notes: string[];
  legend: boolean;
  equal: boolean;
}

export const emptyGraph = (): Graph => ({
  curves: [], x: null, y: null, shades: [], marks: [], vlines: [], hlines: [], rects: [], trapezoids: [],
  tangents: [], secants: [], riemann: null, notes: [], legend: true, equal: false,
});

const derivative = (f: Fn1, a: number) => (f(a + 1e-5) - f(a - 1e-5)) / 2e-5;

/** Turn a graph description into SVG. */
export function renderGraph(g: Graph, label: string, defaultX: [number, number] = [-5, 5]): FigureOutput {
  const x = g.x ?? defaultX;
  const main = g.curves[0]?.fn;

  // Things that need the view first: tangents, secants, Riemann rectangles.
  for (const a of g.tangents) {
    if (!main) break;
    const y0 = main(a), m = derivative(main, a);
    if (!Number.isFinite(y0) || !Number.isFinite(m)) return fail(`The function has no tangent at x = ${fmt(a)}.`);
    g.curves.push({ fn: (t) => y0 + m * (t - a), label: `tangent at x = ${fmt(a)}`, color: COLORS[4], helper: true });
    g.marks.push({ x: a, y: y0 });
  }
  for (const [a, b] of g.secants) {
    if (!main) break;
    const ya = main(a), yb = main(b);
    g.curves.push({ fn: (t) => ya + ((yb - ya) / (b - a)) * (t - a), label: `secant ${fmt(a)} to ${fmt(b)}`, color: COLORS[2], helper: true });
    g.marks.push({ x: a, y: ya }, { x: b, y: yb });
  }
  if (g.riemann && main) {
    const [a, b] = g.shades[0] ? [g.shades[0].a, g.shades[0].b] : x;
    const { n, method } = g.riemann;
    const w = (b - a) / n;
    for (let i = 0; i < n; i++) {
      const l = a + i * w, r = l + w;
      if (method === 'trap') { g.trapezoids.push([l, r, main(l), main(r)]); continue; }
      let h: number;
      if (method === 'left') h = main(l);
      else if (method === 'right') h = main(r);
      else if (method === 'mid') h = main((l + r) / 2);
      else {
        const samples = Array.from({ length: 21 }, (_, k) => main(l + (w * k) / 20)).filter(Number.isFinite);
        h = method === 'upper' ? Math.max(...samples) : Math.min(...samples);
      }
      g.rects.push({ x0: l, x1: r, h });
    }
    g.shades = [];
  }

  // y-range: from the curves, unless given.
  const values: number[] = [];
  for (const c of g.curves.filter((c) => !c.dashed && !c.helper)) {
    const lo = Math.max(x[0], c.x0 ?? -Infinity), hi = Math.min(x[1], c.x1 ?? Infinity);
    for (let i = 0; i <= 200; i++) values.push(c.fn(lo + ((hi - lo) * i) / 200));
  }
  values.push(...g.marks.map((m) => m.y), ...g.hlines, ...g.rects.map((r) => r.h), ...g.trapezoids.flatMap((t) => [t[2], t[3]]));
  const y = g.y ?? autoRange(values);
  if (!y) return fail(`The function isn't defined anywhere between ${fmt(x[0])} and ${fmt(x[1])}.`);

  const frame = makeFrame(x, y, { equal: g.equal });
  const clip = clipToBox(frame);
  let body = clip.defs + drawAxes(frame, { piX: looksLikePi(x[0], x[1]) });
  let inner = '';
  const { sx, sy } = frame;

  for (const s of g.shades) {
    const pts: string[] = [];
    const N = 120;
    for (let i = 0; i <= N; i++) { const t = s.a + ((s.b - s.a) * i) / N; pts.push(`${round(sx(t))},${round(sy(clampY(s.f(t), y)))}`); }
    for (let i = N; i >= 0; i--) { const t = s.a + ((s.b - s.a) * i) / N; pts.push(`${round(sx(t))},${round(sy(clampY(s.g ? s.g(t) : 0, y)))}`); }
    inner += el('path', { d: `M${pts.join('L')}Z`, fill: COLORS[0], 'fill-opacity': 0.18, stroke: 'none' });
  }
  for (const r of g.rects) {
    if (!Number.isFinite(r.h)) continue;
    const top = sy(Math.max(0, r.h)), bottom = sy(Math.min(0, r.h));
    inner += el('rect', { x: sx(r.x0), y: top, width: sx(r.x1) - sx(r.x0), height: bottom - top, fill: COLORS[3], 'fill-opacity': 0.22, stroke: COLORS[3], 'stroke-width': 1.2 });
  }
  for (const [l, r, hl, hr] of g.trapezoids) {
    inner += el('path', { d: `M${round(sx(l))},${round(sy(0))}L${round(sx(l))},${round(sy(hl))}L${round(sx(r))},${round(sy(hr))}L${round(sx(r))},${round(sy(0))}Z`, fill: COLORS[3], 'fill-opacity': 0.22, stroke: COLORS[3], 'stroke-width': 1.2 });
  }
  for (const v of g.vlines) inner += line(sx(v), frame.box.top, sx(v), frame.box.bottom, { ...DASHED, 'stroke-width': 1.2, 'stroke-opacity': 0.7 });
  for (const h of g.hlines) inner += line(frame.box.left, sy(h), frame.box.right, sy(h), { ...DASHED, 'stroke-width': 1.2, 'stroke-opacity': 0.7 });

  g.curves.forEach((c, k) => {
    const d = functionPath(frame, c.fn, Math.max(x[0], c.x0 ?? -Infinity), Math.min(x[1], c.x1 ?? Infinity));
    inner += path(d, { stroke: c.color ?? COLORS[k % COLORS.length], 'stroke-width': c.dashed ? 1.5 : 2.2, 'stroke-linejoin': 'round', ...(c.dashed ? DASHED : {}) });
  });
  body += `<g clip-path="${clip.attr}">${inner}</g>`;

  // Open circles first, so a filled one at the same place wins.
  for (const m of [...g.marks].sort((a, b) => Number(!!b.open) - Number(!!a.open))) {
    if (m.y >= y[0] && m.y <= y[1]) body += dot(frame, m.x, m.y, { label: m.label, open: m.open, color: m.color });
  }
  const named = g.curves.map((c, k) => ({ label: c.label, color: c.color ?? COLORS[k % COLORS.length], dashed: c.dashed })).filter((c) => c.label);
  if (g.legend && named.length) body += legend(frame, named);
  return { ok: true, svg: svg(frame.width, frame.height, body, label), notes: g.notes };
}

const clampY = (v: number, y: [number, number]) => (Number.isFinite(v) ? Math.max(y[0] - (y[1] - y[0]), Math.min(y[1] + (y[1] - y[0]), v)) : 0);

// ---- Reading functions and options --------------------------------------------------

/** "sin x, cos x" or "x^2 and 2x+1" → curves. */
export function readFunctions(text: string, tools: ArgTools, notes: string[]): Curve[] | string {
  const curves: Curve[] = [];
  for (const raw of splitTopLevel(text.replace(/\s+and\s+/gi, ','), ',')) {
    const src = raw.replace(/^\s*(y|[a-z]\s*\(\s*[a-z]\s*\))\s*=\s*/i, '').trim();
    if (!src) continue;
    let parsed = parseExpression(src, { vars: ['x'], fixName: tools.fixName });
    // Accept another single-letter variable, e.g. /plot t^2.
    const other = !parsed.ok && parsed.message.match(/Unknown name “([a-df-z])”/i);
    if (other) parsed = parseExpression(src, { vars: [other[1]], fixName: tools.fixName });
    if (!parsed.ok) return `${parsed.message} in “${src}”`;
    notes.push(...parsed.corrections);
    // Show the corrected spelling in the legend: "cso x" → "cos x".
    const fixed = parsed.corrections.reduce((s, c) => {
      const [from, to] = c.split(' → ');
      return s.replace(new RegExp(`\\b${from}\\b`, 'i'), to);
    }, src);
    const fn = parsed.fn;
    curves.push({ fn: (x) => fn(x), label: prettyLabel(fixed) });
  }
  return curves;
}

export function prettyLabel(src: string, lhs = 'y'): string {
  const pretty = src
    .replace(/\bpi\b/g, 'π').replace(/\bsqrt\b/g, '√').replace(/\*\*/g, '^').replace(/\btheta\b/g, 'θ')
    .replace(/\^2\b/g, '²').replace(/\^3\b/g, '³').replace(/\*/g, '·').replace(/-/g, '−')
    .trim();
  return lhs ? `${lhs} = ${pretty}` : pretty;
}

const OPTIONS = ['tangent', 'secant', 'shade', 'area', 'mark', 'point', 'points', 'hole', 'holes', 'open',
  'asymptote', 'asymptotes', 'riemann', 'nolegend', 'no', 'y', 'x', 'range', 'equal'] as const;

const at = (s: string) => s.replace(/^(at|x\s*=)\s*/i, '').trim();

/** Try to read one option clause into the graph. Returns false if it isn't an option. */
export function applyOption(g: Graph, clause: string, tools: ArgTools): boolean | string {
  const kw = leadingKeyword(clause, OPTIONS, tools);
  if (!kw) return false;
  const { word, rest } = kw;
  const main = g.curves[0]?.fn;
  switch (word) {
    case 'tangent': {
      const a = parseNumber(at(rest), tools.fixName);
      if (a === null) return `Where should the tangent touch? e.g. tangent at 1`;
      g.tangents.push(a);
      return true;
    }
    case 'secant': {
      const r = readRange(rest.replace(/^(from|between)\s+/i, ''), tools);
      if (!r) return `Which two x-values for the secant? e.g. secant 1 to 2`;
      g.secants.push(r);
      return true;
    }
    case 'shade':
    case 'area': {
      const r = readRange(rest.replace(/^(from|between|over|on|x\s*=)\s*/i, ''), tools);
      if (!r || !main) return `Shade between which x-values? e.g. shade 0..1`;
      const second = g.curves[1]?.fn;
      g.shades.push({ a: r[0], b: r[1], f: main, g: second });
      return true;
    }
    case 'mark':
    case 'point':
    case 'points':
    case 'hole':
    case 'holes':
    case 'open': {
      const open = word.startsWith('hole') || word === 'open';
      const pairs = findPairs(rest, tools);
      if (typeof pairs === 'string') return pairs;
      if (pairs.length) {
        for (const p of pairs) g.marks.push({ x: p.x, y: p.y, label: p.name ?? undefined, open });
        return true;
      }
      // "mark at 1": the point on the curve above x = 1.
      if (!main) return false;
      for (const part of at(rest).split(/[\s,]+/).filter(Boolean)) {
        const a = parseNumber(part, tools.fixName);
        if (a === null) return `Which point? e.g. mark (1, 1) or mark at 1`;
        const v = Number.isFinite(main(a)) ? main(a) : (main(a - 1e-7) + main(a + 1e-7)) / 2;
        g.marks.push({ x: a, y: v, open });
      }
      return true;
    }
    case 'asymptote':
    case 'asymptotes': {
      for (const part of rest.split(/[,;]|\band\b/)) {
        const m = part.trim().match(/^([xy])\s*=\s*(.+)$/i);
        const v = m ? parseNumber(m[2], tools.fixName) : null;
        if (!m || v === null) return `Write asymptotes like “asymptote x = 1” or “asymptote y = 0”`;
        (m[1].toLowerCase() === 'x' ? g.vlines : g.hlines).push(v);
      }
      return true;
    }
    case 'riemann': {
      const n = Number(param(rest, 'n') ?? rest.match(/\b(\d+)\b/)?.[1] ?? 4);
      g.riemann = { n: Math.min(200, Math.max(1, n)), method: riemannMethod(rest) };
      const r = readRange(stripParams(rest, 'n').replace(/\b(left|right|mid(point)?|trap(ezoid)?|upper|lower)\b/gi, '').trim(), tools);
      if (r && main) g.shades = [{ a: r[0], b: r[1], f: main }];
      return true;
    }
    case 'y':
    case 'x':
    case 'range': {
      const r = readRange(rest.replace(/^(from|in|=|:)\s*/i, ''), tools);
      if (!r) return false; // "y = x^2" is a function, not a range
      if (word === 'y') g.y = r; else g.x = r;
      return true;
    }
    case 'nolegend':
      g.legend = false;
      return true;
    case 'no':
      if (/legend/i.test(rest)) { g.legend = false; return true; }
      return false;
    case 'equal':
      g.equal = true;
      return true;
  }
  return false;
}

function riemannMethod(text: string): string {
  const m = text.toLowerCase().match(/\b(left|right|mid|midpoint|trap|trapezoid|trapezoidal|upper|lower)\b/);
  const w = m?.[1] ?? 'left';
  return w.startsWith('mid') ? 'mid' : w.startsWith('trap') ? 'trap' : w;
}

/**
 * Read a whole /plot-style command: the first clause holds the functions
 * (and maybe "from a to b"), the rest are options or more functions.
 */
export function readGraph(args: string, tools: ArgTools): Graph | string {
  const g = emptyGraph();
  for (const clause of splitClauses(args)) {
    if (g.curves.length) {
      const opt = applyOption(g, clause, tools);
      if (typeof opt === 'string') return opt;
      if (opt) continue;
    }
    const split = splitRange(clause, tools);
    if (split.error) return split.error;
    g.notes.push(...split.corrections);
    if (split.range) g.x = split.range;
    if (!split.body.trim()) continue;
    const curves = readFunctions(split.body, tools, g.notes);
    if (typeof curves === 'string') return curves;
    g.curves.push(...curves);
  }
  return g;
}

function padded([a, b]: [number, number], k = 0.35): [number, number] {
  const w = (b - a) * k || 1;
  return [a - w, b + w];
}

// ---- Commands --------------------------------------------------------------------------

export const plot: FigureCommand = {
  name: 'plot',
  area: 'Graphs of functions',
  example: '/plot x^2, 2x+1 from -3 to 3\n  + tangent at 1\n  + shade 0..2\n  + mark (2, 4)',
  description: 'Graphs of y = f(x). Extra lines: tangent at a, secant a to b, shade a..b, mark (x,y), hole (x,y), asymptote x=c, y -2..2, riemann n=4 left.',
  draw(args, tools) {
    if (!args.trim()) return fail('What should I plot? e.g. /plot x^2 from -2 to 2');
    const g = readGraph(args, tools);
    if (typeof g === 'string') return fail(`${g}. Try: ${firstLine(plot.example)}`);
    if (!g.curves.length) return fail(`What should I plot? e.g. ${firstLine(plot.example)}`);
    if (!g.x) g.notes.push('range −5 to 5 (add “from a to b” to change it)');
    return renderGraph(g, `Graph of ${g.curves.map((c) => c.label).join(', ')}`);
  },
};

export const area: FigureCommand = {
  name: 'area',
  area: 'Graphs of functions',
  example: '/area x, x^2 from 0 to 1',
  description: 'Shaded area under a curve, or between two curves, from a to b.',
  draw(args, tools) {
    const g = readGraph(args, tools);
    if (typeof g === 'string') return fail(`${g}. Try: ${area.example}`);
    if (!g.curves.length || !g.x) return fail(`Which function and which x-values? e.g. ${area.example}`);
    if (!g.shades.length) g.shades.push({ a: g.x[0], b: g.x[1], f: g.curves[0].fn, g: g.curves[1]?.fn });
    g.x = padded(g.x);
    return renderGraph(g, 'Area under a curve');
  },
};

export const tangent: FigureCommand = {
  name: 'tangent',
  area: 'Graphs of functions',
  example: '/tangent x^2 at 1',
  description: 'A curve with its tangent line at a point.',
  draw(args, tools) {
    const [first, ...rest] = splitClauses(args);
    const m = first?.match(/^(.*?)\s+at\s+(.+)$/i);
    if (!m) return fail(`Where should the tangent touch? e.g. ${tangent.example}`);
    const a = parseNumber(m[2], tools.fixName);
    if (a === null) return fail(`Couldn't read the point “${m[2]}”. Try: ${tangent.example}`);
    const g = readGraph([m[1], ...rest].join('\n'), tools);
    if (typeof g === 'string') return fail(g);
    g.tangents.push(a);
    g.x ??= [a - 3, a + 3];
    return renderGraph(g, 'Tangent line');
  },
};

export const secant: FigureCommand = {
  name: 'secant',
  area: 'Graphs of functions',
  example: '/secant x^2 from 1 to 2',
  description: 'A curve with the secant line through two of its points.',
  draw(args, tools) {
    const [first, ...rest] = splitClauses(args);
    const split = splitRange(first ?? '', tools);
    if (!split.range) return fail(`Between which two x-values? e.g. ${secant.example}`);
    const g = readGraph([split.body, ...rest].join('\n'), tools);
    if (typeof g === 'string') return fail(g);
    g.secants.push(split.range);
    g.x ??= padded(split.range, 0.8);
    return renderGraph(g, 'Secant line');
  },
};

export const riemann: FigureCommand = {
  name: 'riemann',
  area: 'Graphs of functions',
  example: '/riemann x^2 from 0 to 2 n=4 left',
  description: 'Riemann sum rectangles: left, right, mid, trap, upper or lower; n rectangles.',
  draw(args, tools) {
    const [first, ...rest] = splitClauses(args);
    const options = first ?? '';
    const n = Number(param(options, 'n') ?? 4);
    const method = riemannMethod(options);
    const cleaned = stripParams(options, 'n').replace(/\b(left|right|mid(point)?|trap(ezoid(al)?)?|upper|lower)\b/gi, '').trim();
    const split = splitRange(cleaned, tools);
    if (!split.range) return fail(`Over which interval? e.g. ${riemann.example}`);
    const g = readGraph([split.body, ...rest].join('\n'), tools);
    if (typeof g === 'string') return fail(g);
    if (!g.curves.length) return fail(`Which function? e.g. ${riemann.example}`);
    g.shades = [{ a: split.range[0], b: split.range[1], f: g.curves[0].fn }];
    g.riemann = { n: Math.min(200, Math.max(1, n || 4)), method };
    g.x ??= padded(split.range, 0.2);
    g.notes.push(`${g.riemann.n} ${method === 'trap' ? 'trapezoids' : `${method} rectangles`}`);
    return renderGraph(g, 'Riemann sum');
  },
};

export const piecewise: FigureCommand = {
  name: 'piecewise',
  area: 'Graphs of functions',
  example: '/piecewise x^2 if x < 1\n  + 2 - x if x >= 1',
  description: 'A function defined in pieces; open and closed endpoints are drawn for you. Use “otherwise” for the rest.',
  draw(args, tools) {
    const g = emptyGraph();
    type Piece = { fn: Fn1; lo: number; hi: number; loIn: boolean; hiIn: boolean; otherwise: boolean; label: string };
    const pieces: Piece[] = [];
    for (const clause of splitClauses(args)) {
      const opt = applyOption(g, clause, tools);
      if (typeof opt === 'string') return fail(opt);
      if (opt) continue;
      const m = clause.match(/^(.*?)(?:,\s*|\s+)(?:if|for|when|where)\s+(.+)$/i) ?? clause.match(/^(.*?)\s*,\s*(.*[<>≤≥].*)$/);
      const other = clause.match(/^(.*?)[,\s]+(otherwise|else|elsewhere)\s*$/i);
      const exprText = (other?.[1] ?? m?.[1] ?? '').replace(/^\s*(y|f\(x\))\s*=\s*/i, '');
      if (!exprText) return fail(`Write each piece as “formula if condition”, e.g. ${firstLine(piecewise.example)}`);
      const parsed = parseExpression(exprText, { vars: ['x'], fixName: tools.fixName });
      if (!parsed.ok) return fail(`${parsed.message} in “${exprText}”`);
      if (other) {
        pieces.push({ fn: (x) => parsed.fn(x), lo: -Infinity, hi: Infinity, loIn: true, hiIn: true, otherwise: true, label: exprText });
        continue;
      }
      const cond = readInequality(m![2].replace(/\s+/g, ' '), tools);
      if (!cond) return fail(`Couldn't read the condition “${m![2]}”. Try x < 1 or 0 <= x < 2.`);
      pieces.push({ fn: (x) => parsed.fn(x), lo: cond.lo, hi: cond.hi, loIn: cond.loClosed, hiIn: cond.hiClosed, otherwise: false, label: exprText });
    }
    if (!pieces.length) return fail(`Which pieces? e.g. ${firstLine(piecewise.example)}`);

    const inPiece = (p: Piece, x: number) =>
      (x > p.lo || (p.loIn && x === p.lo)) && (x < p.hi || (p.hiIn && x === p.hi));
    const explicit = pieces.filter((p) => !p.otherwise);
    const ends = explicit.flatMap((p) => [p.lo, p.hi]).filter(Number.isFinite);
    g.x ??= ends.length ? [Math.min(...ends) - 2, Math.max(...ends) + 2] : [-5, 5];

    const color = COLORS[0];
    for (const p of pieces) {
      const fn: Fn1 = p.otherwise ? (x) => (explicit.some((q) => inPiece(q, x)) ? NaN : p.fn(x)) : p.fn;
      g.curves.push({ fn, label: '', color, x0: Number.isFinite(p.lo) ? p.lo : undefined, x1: Number.isFinite(p.hi) ? p.hi : undefined });
    }
    // Endpoint dots: filled if the point belongs to the piece, hollow if not.
    for (const p of explicit) {
      for (const [e, included] of [[p.lo, p.loIn], [p.hi, p.hiIn]] as const) {
        if (!Number.isFinite(e)) continue;
        const v = Number.isFinite(p.fn(e)) ? p.fn(e) : p.fn(e + (e === p.lo ? 1e-7 : -1e-7));
        if (Number.isFinite(v)) g.marks.push({ x: e, y: v, open: !included, color });
      }
    }
    const rest = pieces.find((p) => p.otherwise);
    if (rest) {
      for (const e of new Set(ends)) {
        const covered = explicit.some((q) => inPiece(q, e));
        const v = rest.fn(e);
        if (Number.isFinite(v)) g.marks.push({ x: e, y: v, open: covered, color });
      }
    }
    g.legend = false;
    return renderGraph(g, 'Piecewise function');
  },
};

export const taylor: FigureCommand = {
  name: 'taylor',
  area: 'Graphs of functions',
  example: '/taylor sin x at 0 order 1, 3, 5',
  description: 'A function with its Taylor polynomials around a point.',
  draw(args, tools) {
    const [first, ...rest] = splitClauses(args);
    let text = first ?? '';
    const orderMatch = text.match(/\b(?:order|orders|degree|degrees|n)\s*[=:]?\s*([\d,\s]+)$/i);
    const orders = orderMatch ? orderMatch[1].split(/[\s,]+/).filter(Boolean).map(Number).filter((n) => n >= 0 && n <= 25) : [1, 2, 3];
    if (orderMatch) text = text.slice(0, orderMatch.index).trim();
    const atMatch = text.match(/\s+(?:at|about|around)\s+(?:x\s*=\s*)?(.+)$/i);
    const a = atMatch ? parseNumber(atMatch[1], tools.fixName) : 0;
    if (a === null) return fail(`Couldn't read the centre point. Try: ${taylor.example}`);
    if (atMatch) text = text.slice(0, atMatch.index).trim();
    const split = splitRange(text, tools);
    const src = split.body.replace(/^\s*(y|f\(x\))\s*=\s*/i, '');
    const parsed = parseExpression(src, { vars: ['x'], fixName: tools.fixName });
    if (!parsed.ok) return fail(`${parsed.message}. Try: ${taylor.example}`);

    // Taylor coefficients from a contour integral (exact enough, no symbolic maths needed).
    const fz = compileComplex(parsed.ast, ['x']);
    const N = 64, r = 0.5, maxOrder = Math.max(...orders);
    const coeffs: number[] = [];
    for (let k = 0; k <= maxOrder; k++) {
      let sum = 0;
      for (let j = 0; j < N; j++) {
        const t = (2 * Math.PI * j) / N;
        const v: C = fz([a + r * Math.cos(t), r * Math.sin(t)]);
        sum += v[0] * Math.cos(k * t) + v[1] * Math.sin(k * t);
      }
      coeffs.push(sum / N / Math.pow(r, k));
    }
    if (coeffs.some((c) => !Number.isFinite(c))) return fail(`The function isn't smooth at x = ${fmt(a)}, so it has no Taylor polynomial there.`);

    const g = readGraph([src, ...rest].join('\n'), tools);
    if (typeof g === 'string') return fail(g);
    g.x = split.range ?? g.x ?? [a - 4, a + 4];
    const f = g.curves[0].fn;
    const fv = Array.from({ length: 201 }, (_, i) => f(g.x![0] + ((g.x![1] - g.x![0]) * i) / 200));
    g.y ??= autoRange(fv);
    orders.forEach((n, k) => {
      g.curves.push({
        fn: (x) => coeffs.slice(0, n + 1).reduce((s, c, i) => s + c * Math.pow(x - a, i), 0),
        label: `T${subscript(n)}`, color: COLORS[(k + 1) % COLORS.length], dashed: true,
      });
    });
    g.marks.push({ x: a, y: f(a) });
    return renderGraph(g, 'Taylor polynomials');
  },
};

export function subscript(n: number): string {
  return String(n).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)]);
}

/** f, its inverse and the mirror line y = x. (Used by /inverse when it's given a function.) */
export function drawInverseFunction(args: string, tools: ArgTools): FigureOutput {
  const g = readGraph(args, tools);
  if (typeof g === 'string') return fail(g);
  if (!g.curves.length) return fail('Which function? e.g. /inverse e^x');
  const x = g.x ?? [-4, 4];
  const f = g.curves[0].fn;
  const pts: [number, number][] = [];
  for (let i = 0; i <= 400; i++) { const t = x[0] + ((x[1] - x[0]) * i) / 400; pts.push([f(t), t]); }
  const ext = [...pts.flat()].filter(Number.isFinite);
  const lo = Math.max(-10, Math.min(x[0], ...ext)), hi = Math.min(10, Math.max(x[1], ...ext));
  g.x = [lo, hi];
  g.y = [lo, hi];
  g.equal = true;
  g.curves.push({ fn: (t) => t, label: 'y = x', color: '#888', dashed: true });
  const out = renderGraph(g, 'A function and its inverse');
  if (!out.ok) return out;
  // Add the inverse as a reflected curve.
  const frame = makeFrame([lo, hi], [lo, hi], { equal: true });
  const d = pts
    .filter(([px, py]) => Number.isFinite(px) && px >= lo && px <= hi && py >= lo && py <= hi)
    .map(([px, py], i) => `${i ? 'L' : 'M'}${round(frame.sx(px))},${round(frame.sy(py))}`).join('');
  const extra = path(d, { stroke: COLORS[1], 'stroke-width': 2.2 }) +
    legendLine(frame, 2, 'inverse', COLORS[1]);
  return { ...out, svg: out.svg!.replace('</svg>', extra + '</svg>') };
}

function legendLine(f: Frame, row: number, label: string, color: string): string {
  return legend({ ...f, box: { ...f.box, top: f.box.top + row * 18 } }, [{ label, color }]);
}

export const GRAPH_COMMANDS = [plot, area, tangent, secant, riemann, piecewise, taylor];
