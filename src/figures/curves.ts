// Curves that aren't y = f(x), and pictures from limits and trigonometry:
//   /parametric /polar /implicit /conic /sequence /series /epsdelta /unitcircle

import { parseExpression, parseNumber } from './expr';
import { splitRange, readRange } from './range';
import { splitClauses, splitTopLevel, findPairs, numParam, hasWord, stripParams, equationToZero, fmt } from './args';
import {
  svg, makeFrame, drawAxes, path, line, text, el, circle, COLORS, INK, clipToBox, polyline,
  autoRange, legend, dot, DASHED, contourSegments, segmentsPath, directionArrows, formatPi, niceStep, type Frame,
} from './svg';
import { fail, firstLine, type ArgTools, type FigureCommand, type FigureOutput } from './types';
import { prettyLabel, subscript } from './graphs';

type Pt = [number, number];

/** Bounds of some points, padded, as [x-range, y-range]. */
function boundsOf(pts: Pt[], pad = 0.1, includeOrigin = true): [Pt, Pt] {
  const xs = pts.map((p) => p[0]).filter(Number.isFinite);
  const ys = pts.map((p) => p[1]).filter(Number.isFinite);
  if (includeOrigin) { xs.push(0); ys.push(0); }
  const xr = autoRange(xs, false) ?? [-1, 1];
  const yr = autoRange(ys, false) ?? [-1, 1];
  const px = (xr[1] - xr[0]) * pad, py = (yr[1] - yr[0]) * pad;
  return [[xr[0] - px, xr[1] + px], [yr[0] - py, yr[1] + py]];
}

/** Draw curves given as lists of points on equal-scale axes. */
function drawPointCurves(curves: { pts: Pt[]; label: string; arrows?: boolean }[], view: [Pt, Pt] | null, label: string, extra?: (f: Frame) => string): FigureOutput {
  const [xr, yr] = view ?? boundsOf(curves.flatMap((c) => c.pts));
  const frame = makeFrame(xr, yr, { equal: true, width: 440, height: 360 });
  const clip = clipToBox(frame);
  let inner = '';
  curves.forEach((c, k) => {
    const color = COLORS[k % COLORS.length];
    inner += path(polyline(frame, c.pts), { stroke: color, 'stroke-width': 2.2, 'stroke-linejoin': 'round' });
    if (c.arrows) inner += directionArrows(frame, c.pts, 3, color);
  });
  let body = clip.defs + drawAxes(frame) + `<g clip-path="${clip.attr}">${inner}</g>`;
  if (extra) body += extra(frame);
  const named = curves.map((c, k) => ({ label: c.label, color: COLORS[k % COLORS.length] })).filter((c) => c.label);
  if (named.length) body += legend(frame, named);
  return { ok: true, svg: svg(frame.width, frame.height, body, label), notes: [] };
}

/** Split "cos t, sin t for t from 0 to 2pi" into the body and the t-range. */
function bodyAndRange(clause: string, tools: ArgTools, v: string, fallback: [number, number]): { body: string; range: [number, number] } | string {
  const split = splitRange(clause, tools, v);
  if (split.error) return split.error;
  // "… for t" or "…, t" before the range belongs to the range, not the formula.
  const body = split.body
    .replace(new RegExp(`(\\s*,\\s*|\\s+for\\s+)${v}\\s*(=|∈|in|:)?\\s*$`, 'i'), '')
    .replace(new RegExp(`\\s+${v}\\s*(=|∈|:)\\s*$`, 'i'), '')
    .trim();
  return { body, range: split.range ?? fallback };
}

export const parametric: FigureCommand = {
  name: 'parametric',
  area: 'Graphs of functions',
  example: '/parametric cos t, sin 2t\n  + t from 0 to 2pi',
  description: 'A curve (x(t), y(t)) with arrows showing its direction. Several curves: one per line.',
  draw(args, tools) {
    const clauses = splitClauses(args);
    let range: [number, number] = [0, 2 * Math.PI];
    const curves: { pts: Pt[]; label: string; arrows: boolean }[] = [];
    const bodies: string[] = [];
    for (const clause of clauses) {
      const onlyRange = clause.match(/^t\s*(from|in|=|:)?\s*(.+)$/i);
      if (onlyRange) {
        const r = readRange(onlyRange[2], tools);
        if (r) { range = r; continue; }
      }
      const br = bodyAndRange(clause, tools, 't', range);
      if (typeof br === 'string') return fail(br);
      if (br.range !== range) range = br.range;
      if (br.body) bodies.push(br.body);
    }
    for (const body of bodies) {
      const parts = splitTopLevel(body, ',').map((p) => p.replace(/^\s*[xy]\s*(\(t\))?\s*=\s*/i, ''));
      if (parts.length !== 2) return fail(`Give x(t) and y(t) separated by a comma, e.g. ${firstLine(parametric.example)}`);
      const fx = parseExpression(parts[0], { vars: ['t'], fixName: tools.fixName });
      const fy = parseExpression(parts[1], { vars: ['t'], fixName: tools.fixName });
      if (!fx.ok) return fail(`${fx.message} in “${parts[0]}”`);
      if (!fy.ok) return fail(`${fy.message} in “${parts[1]}”`);
      const pts: Pt[] = [];
      for (let i = 0; i <= 800; i++) { const t = range[0] + ((range[1] - range[0]) * i) / 800; pts.push([fx.fn(t), fy.fn(t)]); }
      curves.push({ pts, label: `(${prettyLabel(parts[0], '')}, ${prettyLabel(parts[1], '')})`, arrows: true });
    }
    if (!curves.length) return fail(`Which curve? e.g. ${firstLine(parametric.example)}`);
    return drawPointCurves(curves, null, 'Parametric curve');
  },
};

export const polar: FigureCommand = {
  name: 'polar',
  area: 'Graphs of functions',
  example: '/polar r = 1 + cos θ\n  + r = 1',
  description: 'Polar curves r = f(θ) on a polar grid (write θ, theta or t).',
  draw(args, tools) {
    let range: [number, number] = [0, 2 * Math.PI];
    const curves: { pts: Pt[]; label: string }[] = [];
    for (const clause of splitClauses(args)) {
      const onlyRange = clause.match(/^(θ|theta|t)\s*(from|in|=|:)?\s*(.+)$/i);
      if (onlyRange) {
        const r = readRange(onlyRange[3], tools);
        if (r) { range = r; continue; }
      }
      const normalised = clause.replace(/θ/g, 'theta');
      const br = bodyAndRange(normalised, tools, 'theta', range);
      if (typeof br === 'string') return fail(br);
      range = br.range;
      const src = br.body.replace(/^\s*r\s*(\(\s*(theta|t)\s*\))?\s*=\s*/i, '');
      const parsed = parseExpression(src, { vars: ['theta', 't'], fixName: tools.fixName });
      if (!parsed.ok) return fail(`${parsed.message} in “${src}”`);
      const pts: Pt[] = [];
      for (let i = 0; i <= 900; i++) {
        const th = range[0] + ((range[1] - range[0]) * i) / 900;
        const r = parsed.fn(th, th);
        pts.push([r * Math.cos(th), r * Math.sin(th)]);
      }
      curves.push({ pts, label: prettyLabel(src, 'r') });
    }
    if (!curves.length) return fail(`Which curve? e.g. ${firstLine(polar.example)}`);
    const rMax = Math.max(0.5, ...curves.flatMap((c) => c.pts.map(([x, y]) => Math.hypot(x, y))).filter(Number.isFinite));
    const R = rMax * 1.1;
    return drawPointCurves(curves, [[-R, R], [-R, R]], 'Polar curve', (f) => polarGrid(f, rMax));
  },
};

function polarGrid(f: Frame, rMax: number): string {
  let out = '';
  const step = niceStep(rMax, 4);
  const faint = { stroke: INK, 'stroke-opacity': 0.13, 'stroke-width': 1, fill: 'none' };
  for (let r = step; r <= rMax * 1.05; r += step) {
    out += circle(f.sx(0), f.sy(0), f.sx(r) - f.sx(0), faint);
  }
  for (let k = 0; k < 12; k++) {
    const a = (k * Math.PI) / 6;
    const R = rMax * 1.08;
    out += line(f.sx(0), f.sy(0), f.sx(R * Math.cos(a)), f.sy(R * Math.sin(a)), faint);
  }
  return out;
}

export const implicit: FigureCommand = {
  name: 'implicit',
  area: 'Graphs of functions',
  example: '/implicit x^2 + y^2 = 4\n  + y = x^2 - 1\n  + x -3..3',
  description: 'Curves given by an equation in x and y. Optional: x -3..3, y -2..2.',
  draw(args, tools) {
    let x: [number, number] | null = null, y: [number, number] | null = null;
    const eqs: { fn: (x: number, y: number) => number; label: string }[] = [];
    const notes: string[] = [];
    for (const clause of splitClauses(args)) {
      const r = clause.match(/^([xy])\s*(?:from|in|:)?\s*(-?[^=<>]*\.\.[^=]*|\[.*\]|.*\bto\b.*)$/i);
      if (r && !/[=]/.test(clause)) {
        const rr = readRange(r[2], tools);
        if (rr) { if (r[1].toLowerCase() === 'x') x = rr; else y = rr; continue; }
      }
      const split = splitRange(clause, tools);
      if (split.range && !x) x = split.range;
      const fn = equationToZero(split.body, ['x', 'y'], tools, notes);
      if (typeof fn === 'string') return fail(`${fn}. Try: ${firstLine(implicit.example)}`);
      eqs.push({ fn: (a, b) => fn(a, b), label: prettyLabel(split.body, '') });
    }
    if (!eqs.length) return fail(`Which equation? e.g. ${firstLine(implicit.example)}`);
    x ??= y ?? [-5, 5];
    y ??= x;
    const frame = makeFrame(x, y, { equal: true, width: 440, height: 360 });
    const clip = clipToBox(frame);
    let inner = '';
    eqs.forEach((e, k) => {
      inner += path(segmentsPath(frame, contourSegments(e.fn, x!, y!, 0, 160, 160)), { stroke: COLORS[k % COLORS.length], 'stroke-width': 2.2, 'stroke-linecap': 'round' });
    });
    const body = clip.defs + drawAxes(frame) + `<g clip-path="${clip.attr}">${inner}</g>` +
      legend(frame, eqs.map((e, k) => ({ label: e.label, color: COLORS[k % COLORS.length] })));
    return { ok: true, svg: svg(frame.width, frame.height, body, 'Implicit curve'), notes };
  },
};

export const conic: FigureCommand = {
  name: 'conic',
  area: 'Graphs of functions',
  example: '/conic ellipse a=3 b=2\n  + foci',
  description: 'Ellipse (a, b), hyperbola (a, b, asymptotes) or parabola (p, focus, directrix); options foci, center (h,k), vertical. Or give an equation.',
  draw(args, tools) {
    let text = args.replace(/[\n;]+/g, ' ');
    const kinds = ['ellipse', 'hyperbola', 'parabola', 'circle'];
    let kind = kinds.find((k) => tools.invokedAs === k) ?? kinds.find((k) => hasWord(text, k, tools));
    if (!kind) {
      if (/=/.test(text)) return implicit.draw(args, tools);
      return fail(`Which conic: ellipse, hyperbola or parabola? e.g. ${firstLine(conic.example)}`);
    }
    text = text.replace(new RegExp(`\\b${kind}\\b`, 'i'), '');
    const centre = findPairs(text, tools);
    const [h, k] = typeof centre !== 'string' && centre.length ? [centre[0].x, centre[0].y] : [0, 0];
    const vertical = hasWord(text, 'vertical', tools);
    const want = (w: string) => hasWord(text, w, tools);
    const extras: string[] = [];
    let pts: Pt[] = [];
    const branches: Pt[][] = [];
    const marks: { p: Pt; label: string }[] = [];
    const dashed: [Pt, Pt][] = [];

    if (kind === 'ellipse' || kind === 'circle') {
      const a = numParam(text, tools, 'a', 'r') ?? 3;
      const b = kind === 'circle' ? a : numParam(text, tools, 'b') ?? 2;
      for (let i = 0; i <= 360; i++) { const t = (i * Math.PI) / 180; pts.push([h + a * Math.cos(t), k + b * Math.sin(t)]); }
      branches.push(pts);
      const c = Math.sqrt(Math.abs(a * a - b * b));
      if (want('foci') || want('focus')) {
        const along = a >= b ? [[c, 0], [-c, 0]] : [[0, c], [0, -c]];
        along.forEach(([dx, dy], i) => marks.push({ p: [h + dx, k + dy], label: `F${subscript(i + 1)}` }));
      }
      dashed.push([[h - a, k], [h + a, k]], [[h, k - b], [h, k + b]]);
      extras.push(`x²/${fmt(a * a)} + y²/${fmt(b * b)} = 1`);
    } else if (kind === 'hyperbola') {
      const a = numParam(text, tools, 'a') ?? 2;
      const b = numParam(text, tools, 'b') ?? 1;
      const span = 2.2;
      for (const s of [1, -1]) {
        const branch: Pt[] = [];
        for (let i = -100; i <= 100; i++) {
          const t = (i / 100) * span;
          const [u, v] = [s * a * Math.cosh(t), b * Math.sinh(t)];
          branch.push(vertical ? [h + v, k + u] : [h + u, k + v]);
        }
        branches.push(branch);
      }
      const c = Math.sqrt(a * a + b * b);
      if (want('foci') || want('focus')) {
        (vertical ? [[0, c], [0, -c]] : [[c, 0], [-c, 0]]).forEach(([dx, dy], i) => marks.push({ p: [h + dx, k + dy], label: `F${subscript(i + 1)}` }));
      }
      if (!hasWord(text, 'noasymptotes')) {
        const L = a * span * 1.6;
        const m = vertical ? a / b : b / a;
        for (const s of [1, -1]) dashed.push([[h - L, k - s * m * L], [h + L, k + s * m * L]]);
      }
      extras.push(vertical ? `y²/${fmt(a * a)} − x²/${fmt(b * b)} = 1` : `x²/${fmt(a * a)} − y²/${fmt(b * b)} = 1`);
    } else {
      const p = numParam(text, tools, 'p') ?? 1;
      const horizontal = hasWord(text, 'horizontal', tools) || hasWord(text, 'sideways', tools);
      for (let i = -100; i <= 100; i++) {
        const u = (i / 100) * 4 * Math.sqrt(Math.abs(p)) * 1.5;
        const v = (u * u) / (4 * p);
        pts.push(horizontal ? [h + v, k + u] : [h + u, k + v]);
      }
      branches.push(pts);
      if (want('focus') || want('foci')) marks.push({ p: horizontal ? [h + p, k] : [h, k + p], label: 'F' });
      if (want('directrix')) {
        const L = 6 * Math.sqrt(Math.abs(p));
        dashed.push(horizontal ? [[h - p, k - L], [h - p, k + L]] : [[h - L, k - p], [h + L, k - p]]);
      }
      extras.push(horizontal ? `y² = ${fmt(4 * p)}x` : `x² = ${fmt(4 * p)}y`);
    }
    pts = branches.flat();
    const view = boundsOf([...pts, ...marks.map((m) => m.p)], 0.12);
    return drawPointCurves(branches.map((b, i) => ({ pts: b, label: i === 0 ? extras[0] : '' })), view, `Conic: ${kind}`, (f) => {
      let out = '';
      for (const [p, q] of dashed) out += line(f.sx(p[0]), f.sy(p[1]), f.sx(q[0]), f.sy(q[1]), { ...DASHED, 'stroke-width': 1.2, 'stroke-opacity': 0.6 });
      for (const m of marks) out += dot(f, m.p[0], m.p[1], { label: m.label, color: COLORS[1] });
      return out;
    });
  },
};

// ---- Sequences, series, ε-δ -------------------------------------------------------------

function readSequence(args: string, tools: ArgTools) {
  const text = args.replace(/[\n;]+/g, ' ');
  const eps = numParam(text, tools, 'eps', 'epsilon', 'ε');
  const limit = numParam(text, tools, 'limit', 'L');
  const cleaned = stripParams(text, 'eps', 'epsilon', 'ε', 'limit', 'L');
  const v = /\bk\b/.test(cleaned) && !/\bn\b/.test(cleaned) ? 'k' : 'n';
  const br = bodyAndRange(cleaned, tools, v, [1, 20]);
  if (typeof br === 'string') return br;
  const src = br.body.replace(/^\s*a_?[nk]?\s*=\s*/i, '');
  const parsed = parseExpression(src, { vars: [v], fixName: tools.fixName });
  if (!parsed.ok) return `${parsed.message} in “${src}”`;
  const [n0, n1] = [Math.ceil(br.range[0]), Math.min(Math.floor(br.range[1]), Math.ceil(br.range[0]) + 400)];
  return { f: (n: number) => parsed.fn(n), n0, n1, eps, limit, src, v };
}

export const sequence: FigureCommand = {
  name: 'sequence',
  area: 'Graphs of functions',
  example: '/sequence (-1)^n / n for n from 1 to 30\n  + eps=0.1 limit=0',
  description: 'The terms aₙ as dots. With eps= (and limit=), the ε-band and the N after which every term stays inside it.',
  draw(args, tools) {
    const s = readSequence(args, tools);
    if (typeof s === 'string') return fail(`${s}. Try: ${firstLine(sequence.example)}`);
    const pts: Pt[] = [];
    for (let n = s.n0; n <= s.n1; n++) pts.push([n, s.f(n)]);
    const L = s.limit ?? (s.eps !== null ? pts[pts.length - 1][1] : null);
    const ys = pts.map((p) => p[1]);
    if (L !== null) ys.push(L + (s.eps ?? 0), L - (s.eps ?? 0));
    const yr = autoRange(ys) ?? [-1, 1];
    const frame = makeFrame([s.n0 - 1, s.n1 + 1], yr);
    let body = drawAxes(frame, { xLabel: s.v });
    if (L !== null && s.eps !== null) {
      const top = frame.sy(L + s.eps), bottom = frame.sy(L - s.eps);
      body += el('rect', { x: frame.box.left, y: top, width: frame.box.right - frame.box.left, height: bottom - top, fill: COLORS[2], 'fill-opacity': 0.12 });
      body += line(frame.box.left, frame.sy(L), frame.box.right, frame.sy(L), { ...DASHED, stroke: COLORS[2], 'stroke-width': 1.2 });
      body += text(frame.box.right - 4, top - 4, `L + ε`, { 'font-size': 12, 'text-anchor': 'end', fill: COLORS[2] });
      body += text(frame.box.right - 4, bottom + 13, `L − ε`, { 'font-size': 12, 'text-anchor': 'end', fill: COLORS[2] });
      // N: from here on, every term is inside the band.
      let N = s.n1;
      for (let i = pts.length - 1; i >= 0; i--) { if (Math.abs(pts[i][1] - L) >= s.eps) break; N = pts[i][0]; }
      if (N < s.n1) {
        body += line(frame.sx(N), frame.box.top, frame.sx(N), frame.box.bottom, { ...DASHED, 'stroke-width': 1.2 });
        body += text(frame.sx(N) + 4, frame.box.top + 12, 'N', { 'font-size': 13, 'font-style': 'italic' });
      }
    } else if (L !== null) {
      body += line(frame.box.left, frame.sy(L), frame.box.right, frame.sy(L), { ...DASHED, stroke: COLORS[2], 'stroke-width': 1.2 });
    }
    for (const [n, a] of pts) {
      if (!Number.isFinite(a)) continue;
      const inside = L === null || s.eps === null || Math.abs(a - L) < s.eps;
      body += circle(frame.sx(n), frame.sy(a), 3.3, { fill: inside ? COLORS[0] : COLORS[1] });
    }
    body += legend(frame, [{ label: `a${s.v === 'n' ? 'ₙ' : 'ₖ'} = ${prettyLabel(s.src, '')}`, color: COLORS[0] }]);
    return { ok: true, svg: svg(frame.width, frame.height, body, 'Sequence'), notes: [] };
  },
};

export const series: FigureCommand = {
  name: 'series',
  area: 'Graphs of functions',
  example: '/series 1/n^2 for n from 1 to 30\n  + limit=pi^2/6',
  description: 'Partial sums Sₙ of a series as dots, with an optional limit line.',
  draw(args, tools) {
    const s = readSequence(args, tools);
    if (typeof s === 'string') return fail(`${s}. Try: ${firstLine(series.example)}`);
    const pts: Pt[] = [];
    let sum = 0;
    for (let n = s.n0; n <= s.n1; n++) { sum += s.f(n); pts.push([n, sum]); }
    const ys = pts.map((p) => p[1]);
    if (s.limit !== null) ys.push(s.limit);
    const frame = makeFrame([s.n0 - 1, s.n1 + 1], autoRange(ys) ?? [-1, 1]);
    let body = drawAxes(frame, { xLabel: s.v });
    if (s.limit !== null) body += line(frame.box.left, frame.sy(s.limit), frame.box.right, frame.sy(s.limit), { ...DASHED, stroke: COLORS[2], 'stroke-width': 1.4 });
    body += path(polyline(frame, pts), { stroke: COLORS[0], 'stroke-width': 1, 'stroke-opacity': 0.4 });
    for (const [n, v] of pts) if (Number.isFinite(v)) body += circle(frame.sx(n), frame.sy(v), 3.3, { fill: COLORS[0] });
    const items = [{ label: `Sₙ = Σ ${prettyLabel(s.src, '')}`, color: COLORS[0] }];
    if (s.limit !== null) items.push({ label: 'limit', color: COLORS[2] });
    body += legend(frame, items);
    return { ok: true, svg: svg(frame.width, frame.height, body, 'Partial sums'), notes: [] };
  },
};

export const epsdelta: FigureCommand = {
  name: 'epsdelta',
  area: 'Graphs of functions',
  example: '/epsdelta x^2 at 1\n  + eps=0.5',
  description: 'The ε-δ picture of a limit: the ε-band around L and a δ that works.',
  draw(args, tools) {
    const input = args.replace(/[\n;]+/g, ' ');
    const eps = numParam(input, tools, 'eps', 'epsilon', 'ε') ?? 0.5;
    const given = numParam(input, tools, 'limit', 'L');
    const cleaned = stripParams(input, 'eps', 'epsilon', 'ε', 'limit', 'L');
    const m = cleaned.match(/^(.*?)\s+(?:at|as\s+x\s*->|x\s*->)\s*(.+)$/i);
    if (!m) return fail(`Which function and point? e.g. ${firstLine(epsdelta.example)}`);
    const a = parseNumber(m[2], tools.fixName);
    const parsed = parseExpression(m[1].replace(/^\s*(y|f\(x\))\s*=\s*/i, ''), { vars: ['x'], fixName: tools.fixName });
    if (a === null || !parsed.ok) return fail(`Couldn't read that. Try: ${firstLine(epsdelta.example)}`);
    const f = (x: number) => parsed.fn(x);
    const L = given ?? (Number.isFinite(f(a)) ? f(a) : (f(a - 1e-6) + f(a + 1e-6)) / 2);
    // The largest δ (checked on a fine grid) that keeps f within ε of L.
    const works = (d: number) => {
      for (let i = 1; i <= 400; i++) {
        const t: number = a - d + (2 * d * i) / 401;
        if (t !== a && !(Math.abs(f(t) - L) < eps)) return false;
      }
      return true;
    };
    let lo = 0, hi = 10;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (works(mid)) lo = mid; else hi = mid; }
    const delta = lo * 0.95;
    if (delta <= 0) return fail(`No δ works for ε = ${fmt(eps)} with L = ${fmt(L)}: is that the right limit?`);
    const w = Math.max(delta * 3, 1.2);
    const x: [number, number] = [a - w, a + w];
    const vals = Array.from({ length: 201 }, (_, i) => f(x[0] + ((x[1] - x[0]) * i) / 200));
    const yr = autoRange([...vals, L + 2 * eps, L - 2 * eps], true) ?? [L - 1, L + 1];
    const frame = makeFrame(x, yr);
    const clip = clipToBox(frame);
    const { box, sx, sy } = frame;
    let body = clip.defs + drawAxes(frame);
    body += el('rect', { x: box.left, y: sy(L + eps), width: box.right - box.left, height: sy(L - eps) - sy(L + eps), fill: COLORS[2], 'fill-opacity': 0.13 });
    body += el('rect', { x: sx(a - delta), y: box.top, width: sx(a + delta) - sx(a - delta), height: box.bottom - box.top, fill: COLORS[0], 'fill-opacity': 0.1 });
    for (const v of [L + eps, L - eps]) body += line(box.left, sy(v), box.right, sy(v), { ...DASHED, stroke: COLORS[2], 'stroke-width': 1.1 });
    for (const v of [a - delta, a + delta]) body += line(sx(v), box.top, sx(v), box.bottom, { ...DASHED, stroke: COLORS[0], 'stroke-width': 1.1 });
    const curve = Array.from({ length: 401 }, (_, i) => { const t = x[0] + ((x[1] - x[0]) * i) / 400; return [t, f(t)] as Pt; });
    body += `<g clip-path="${clip.attr}">${path(polyline(frame, curve), { stroke: INK, 'stroke-width': 2.2 })}</g>`;
    body += dot(frame, a, L, { open: !Number.isFinite(f(a)) || Math.abs(f(a) - L) > 1e-9 });
    const small = { 'font-size': 12 };
    body += text(box.right - 4, sy(L + eps) - 4, 'L + ε', { ...small, 'text-anchor': 'end', fill: COLORS[2] });
    body += text(box.right - 4, sy(L - eps) + 13, 'L − ε', { ...small, 'text-anchor': 'end', fill: COLORS[2] });
    body += text(sx(a - delta), box.top + 11, 'a − δ', { ...small, 'text-anchor': 'middle', fill: COLORS[0] });
    body += text(sx(a + delta), box.top + 11, 'a + δ', { ...small, 'text-anchor': 'middle', fill: COLORS[0] });
    return { ok: true, svg: svg(frame.width, frame.height, body, 'Epsilon-delta picture'), notes: [`ε = ${fmt(eps)}, a δ that works ≈ ${fmt(delta, 3)}`] };
  },
};

// ---- The unit circle ----------------------------------------------------------------

const EXACT: Record<number, [string, string]> = {
  0: ['1', '0'], 30: ['√3/2', '1/2'], 45: ['√2/2', '√2/2'], 60: ['1/2', '√3/2'], 90: ['0', '1'],
};

function exactCoords(deg: number): string {
  const d = ((deg % 360) + 360) % 360;
  const q = Math.floor(d / 90), r = d % 90;
  const base = EXACT[r] ?? null;
  if (!base) return '';
  let [c, s] = base;
  if (q === 1 || q === 3) [c, s] = [s, c];
  const neg = (v: string, on: boolean) => (on && v !== '0' ? `−${v}` : v);
  return `(${neg(c, q === 1 || q === 2)}, ${neg(s, q === 2 || q === 3)})`;
}

export const unitcircle: FigureCommand = {
  name: 'unitcircle',
  area: 'Graphs of functions',
  example: '/unitcircle 2pi/3\n  + tan',
  description: 'The unit circle. With an angle: the point, cos θ and sin θ (and tan with “tan”). Alone: the standard angles; add “coords” or “degrees”.',
  draw(args, tools) {
    const input = args.replace(/[\n;]+/g, ' ').trim();
    const degrees = hasWord(input, 'degrees', tools) || hasWord(input, 'deg');
    const showTan = hasWord(input, 'tan');
    const coords = hasWord(input, 'coords', tools) || hasWord(input, 'coordinates', tools);
    const angleText = input.replace(/\b(tan|degrees|deg|coords|coordinates)\b/gi, '').trim();
    const frame = makeFrame([-1.5, 1.5], [-1.4, 1.4], { equal: true, width: 440, height: 420 });
    const { sx, sy } = frame;
    let body = drawAxes(frame, { grid: false });
    body += circle(sx(0), sy(0), sx(1) - sx(0), { fill: 'none', stroke: INK, 'stroke-width': 1.8 });

    if (!angleText) {
      for (let deg = 0; deg < 360; deg += 15) {
        if (deg % 30 !== 0 && deg % 45 !== 0) continue;
        const t = (deg * Math.PI) / 180;
        const [c, s] = [Math.cos(t), Math.sin(t)];
        body += line(sx(0), sy(0), sx(c), sy(s), { 'stroke-width': 0.8, 'stroke-opacity': 0.25 });
        body += circle(sx(c), sy(s), 3.5, { fill: COLORS[0] });
        const label = degrees ? `${deg}°` : formatPi(t);
        body += text(sx(1.17 * c), sy(1.17 * s) + 4, label, { 'font-size': 12, 'text-anchor': 'middle' });
        if (coords) body += text(sx(0.78 * c), sy(0.78 * s) + 4, exactCoords(deg), { 'font-size': 9.5, 'text-anchor': 'middle', 'fill-opacity': 0.75 });
      }
      return { ok: true, svg: svg(frame.width, frame.height, body, 'Unit circle'), notes: [] };
    }

    let theta = parseNumber(angleText.replace(/°|deg$/, ''), tools.fixName);
    if (theta === null) return fail(`Couldn't read the angle “${angleText}”. Try: ${firstLine(unitcircle.example)}`);
    if (/°/.test(angleText) || degrees) theta = (theta * Math.PI) / 180;
    const [c, s] = [Math.cos(theta), Math.sin(theta)];
    body += line(sx(0), sy(0), sx(c), sy(s), { 'stroke-width': 2 });
    body += line(sx(c), sy(s), sx(c), sy(0), { ...DASHED, stroke: COLORS[1], 'stroke-width': 1.6 });
    body += line(sx(0), sy(0), sx(c), sy(0), { stroke: COLORS[0], 'stroke-width': 3 });
    body += line(sx(c), sy(0), sx(c), sy(s), { stroke: COLORS[1], 'stroke-width': 3 });
    body += text(sx(c / 2), sy(0) + (s >= 0 ? 16 : -8), 'cos θ', { 'font-size': 13, 'text-anchor': 'middle', fill: COLORS[0], 'font-style': 'italic' });
    body += text(sx(c) + (c >= 0 ? 6 : -6), sy(s / 2) + 4, 'sin θ', { 'font-size': 13, 'text-anchor': c >= 0 ? 'start' : 'end', fill: COLORS[1], 'font-style': 'italic' });
    // Angle arc.
    const r = 0.25;
    const steps = 40;
    const arc: Pt[] = Array.from({ length: steps + 1 }, (_, i) => { const t = (theta! * i) / steps; return [r * Math.cos(t), r * Math.sin(t)]; });
    body += path(polyline(frame, arc), { 'stroke-width': 1.3 });
    body += text(sx(0.38 * Math.cos(theta / 2)), sy(0.38 * Math.sin(theta / 2)) + 4, 'θ', { 'font-size': 14, 'font-style': 'italic', 'text-anchor': 'middle' });
    if (showTan && Math.abs(c) > 1e-6) {
      const t = s / c;
      if (Math.abs(t) < 1.4) {
        body += line(sx(1), sy(0), sx(1), sy(t), { stroke: COLORS[2], 'stroke-width': 3 });
        body += line(sx(0), sy(0), sx(1), sy(t), { ...DASHED, 'stroke-width': 1 });
        body += text(sx(1) + 6, sy(t / 2) + 4, 'tan θ', { 'font-size': 13, fill: COLORS[2], 'font-style': 'italic' });
      }
    }
    const deg = Math.round((theta * 180) / Math.PI);
    const exact = Math.abs((theta * 180) / Math.PI - deg) < 1e-6 ? exactCoords(deg) : '';
    body += circle(sx(c), sy(s), 4.5, { fill: INK });
    body += text(sx(c) + (c >= 0 ? 8 : -8), sy(s) - 8, exact ? `P ${exact}` : 'P', { 'font-size': 13, 'text-anchor': c >= 0 ? 'start' : 'end' });
    return { ok: true, svg: svg(frame.width, frame.height, body, 'Unit circle'), notes: [] };
  },
};

export const CURVE_COMMANDS = [parametric, polar, implicit, conic, sequence, series, epsdelta, unitcircle];

export { boundsOf, drawPointCurves };
