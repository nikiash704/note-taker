// Shaded regions from inequalities:
//   /region 0<=x<=1, x^2<=y<=x          (also |z - 1| < 2 for complex z)
//   /polarregion 1<=r<=2, 0<=θ<=pi/2
//   /feasible x+y<=4, x<=3, x,y>=0 max 3x+2y
//   /ball (0,0) r=1 open

import { parseExpression, compileComplex, type C } from './expr';
import { readRange } from './range';
import { splitClauses, splitTopLevel, findPairs, numParam, hasWord, fmt } from './args';
import {
  svg, makeFrame, drawAxes, path, line, text, circle, arrow, COLORS, INK, clipToBox, fillWhere,
  contourSegments, segmentsPath, dot, DASHED, type Frame,
} from './svg';
import { fail, firstLine, type ArgTools, type FigureCommand } from './types';

type Pred = (x: number, y: number) => boolean;
interface Condition { test: Pred; g: (x: number, y: number) => number; strict: boolean; text: string }

const OPS = /(<=|>=|≤|≥|<|>)/;

/** Read "a <= x <= b", "y > x^2", "|z-1| < 2" into conditions g(x,y) ≤ 0 (or < 0). */
function readConditions(clause: string, tools: ArgTools, mode: 'xy' | 'polar'): Condition[] | string {
  const parts = clause.replace(/≤/g, '<=').replace(/≥/g, '>=').split(OPS).map((s) => s.trim());
  if (parts.length < 3) return `“${clause}” isn't an inequality`;
  const complex = mode === 'xy' && /\bz\b/.test(clause);
  const exprs: ((x: number, y: number) => number)[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    const src = parts[i].replace(/θ/g, 'theta');
    if (complex) {
      const r = parseExpression(src, { vars: ['z'], complex: true, fixName: tools.fixName });
      if (!r.ok) return `${r.message} in “${src}”`;
      const f = compileComplex(r.ast, ['z']);
      exprs.push((x, y) => { const v: C = f([x, y]); return Math.abs(v[1]) < 1e-9 ? v[0] : NaN; });
    } else if (mode === 'polar') {
      const r = parseExpression(src, { vars: ['r', 'theta', 't'], fixName: tools.fixName });
      if (!r.ok) return `${r.message} in “${src}”`;
      // Polar maths at the point (x, y): r and θ. θ is tried in a few turns so ranges like -pi/2..pi/2 work.
      exprs.push((x, y) => r.fn(Math.hypot(x, y), Math.atan2(y, x), Math.atan2(y, x)));
    } else {
      const r = parseExpression(src, { vars: ['x', 'y'], fixName: tools.fixName });
      if (!r.ok) return `${r.message} in “${src}”`;
      exprs.push((x, y) => r.fn(x, y));
    }
  }
  const out: Condition[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    const op = parts[i];
    const a = exprs[(i - 1) / 2], b = exprs[(i + 1) / 2];
    // Normalise to g ≤ 0.
    const g = op.startsWith('<') ? (x: number, y: number) => a(x, y) - b(x, y) : (x: number, y: number) => b(x, y) - a(x, y);
    const strict = !op.endsWith('=');
    out.push({ g, strict, test: strict ? (x, y) => g(x, y) < 0 : (x, y) => g(x, y) <= 1e-12, text: `${parts[i - 1]} ${op} ${parts[i + 1]}` });
  }
  return out;
}

/** Polar inequalities hold at a point if they hold for θ, θ + 2π or θ − 2π (so -pi/2..pi/2 works). */
function polarPredicate(clauses: string[], tools: ArgTools): Pred | string {
  const tests: Pred[] = [];
  for (const shift of [0, 2 * Math.PI, -2 * Math.PI]) {
    const conds: Condition[] = [];
    for (const clause of clauses) {
      const c = readConditions(shift ? clause.replace(/θ|theta|\bt\b/g, `(theta + ${shift})`) : clause, tools, 'polar');
      if (typeof c === 'string') return c;
      conds.push(...c);
    }
    tests.push((x, y) => conds.every((c) => c.test(x, y)));
  }
  return (x, y) => tests.some((t) => t(x, y));
}

/** Find where the region is, by sampling a big square. */
function regionBounds(pred: Pred): [[number, number], [number, number]] | null {
  const R = 12, N = 120;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const x = -R + (2 * R * i) / N, y = -R + (2 * R * j) / N;
    if (pred(x, y)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  }
  if (x0 === Infinity) return null;
  const clampTo = (lo: number, hi: number): [number, number] => {
    if (lo <= -R + 0.01 && hi >= R - 0.01) return [-5, 5];
    if (lo <= -R + 0.01) lo = Math.min(hi - 4, -1);
    if (hi >= R - 0.01) hi = Math.max(lo + 4, 1);
    const pad = Math.max((hi - lo) * 0.25, 0.5);
    return [Math.min(lo - pad, -0.5), Math.max(hi + pad, 0.5)];
  };
  return [clampTo(x0, x1), clampTo(y0, y1)];
}

interface RegionPicture { frame: Frame; body: string; pred: Pred }

function drawRegion(conds: Condition[], view: [[number, number], [number, number]] | null, opts: { equal?: boolean } = {}): RegionPicture | string {
  const pred: Pred = (x, y) => conds.every((c) => c.test(x, y));
  const bounds = view ?? regionBounds(pred);
  if (!bounds) return 'Nothing satisfies all of these inequalities: the region is empty';
  const frame = makeFrame(bounds[0], bounds[1], { equal: opts.equal ?? true, width: 440, height: 360 });
  const clip = clipToBox(frame);
  let inner = path(fillWhere(frame, pred), { fill: COLORS[0], 'fill-opacity': 0.22, stroke: 'none' });
  // Each boundary, only where it actually borders the region.
  for (const c of conds) {
    if (!c.text) continue;
    const others = conds.filter((o) => o !== c);
    const segs = contourSegments(c.g, bounds[0], bounds[1], 0, 140, 140).filter(([x1, y1, x2, y2]) => {
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      return others.every((o) => o.g(mx, my) <= 1e-6 * (1 + Math.abs(o.g(mx, my))) || o.test(mx, my));
    });
    inner += path(segmentsPath(frame, segs), { stroke: COLORS[0], 'stroke-width': 2, ...(c.strict ? DASHED : {}) });
  }
  return { frame, pred, body: clip.defs + drawAxes(frame) + `<g clip-path="${clip.attr}">${inner}</g>` };
}

/** "x -2..4", "y from -1 to 3" view clauses. */
function viewClause(clause: string, tools: ArgTools): ['x' | 'y', [number, number]] | null {
  const m = clause.match(/^([xy])\s*(?:from|in|:)?\s*([^<>≤≥]+)$/i);
  if (!m) return null;
  const r = readRange(m[2], tools);
  return r ? [m[1].toLowerCase() as 'x' | 'y', r] : null;
}

function readRegion(args: string, tools: ArgTools, mode: 'xy' | 'polar') {
  const conds: Condition[] = [];
  const clauses: string[] = [];
  let x: [number, number] | null = null, y: [number, number] | null = null;
  for (const clause of splitClauses(args).flatMap((c) => splitTopLevel(c, ','))) {
    const v = viewClause(clause, tools);
    if (v) { if (v[0] === 'x') x = v[1]; else y = v[1]; continue; }
    // "x, y >= 0" shorthand (after the comma split this arrives as "x" then "y >= 0").
    const c = readConditions(clause, tools, mode);
    if (typeof c === 'string') return c;
    conds.push(...c);
    clauses.push(clause);
  }
  return { conds, clauses, view: x || y ? ([x ?? y!, y ?? x!] as [[number, number], [number, number]]) : null };
}

export const region: FigureCommand = {
  name: 'region',
  area: 'Regions',
  example: '/region 0 <= x <= 1\n  + x^2 <= y <= x',
  description: 'Shade where all the inequalities hold (dashed edge = strict). Use z for complex numbers: |z - 1| < 2. Optional view: x -2..2.',
  draw(args, tools) {
    const r = readRegion(fixShorthand(args), tools, 'xy');
    if (typeof r === 'string') return fail(`${r}. Try: ${firstLine(region.example)}`);
    if (!r.conds.length) return fail(`Which inequalities? e.g. ${firstLine(region.example)}`);
    const pic = drawRegion(r.conds, r.view);
    if (typeof pic === 'string') return fail(pic);
    return { ok: true, svg: svg(pic.frame.width, pic.frame.height, pic.body, 'Region'), notes: [] };
  },
};

export const polarregion: FigureCommand = {
  name: 'polarregion',
  area: 'Regions',
  example: '/polarregion 1 <= r <= 2\n  + 0 <= θ <= pi/2',
  description: 'A region described with r and θ (theta), for polar double integrals.',
  draw(args, tools) {
    const r = readRegion(args, tools, 'polar');
    if (typeof r === 'string') return fail(`${r}. Try: ${firstLine(polarregion.example)}`);
    if (!r.conds.length) return fail(`Which inequalities? e.g. ${firstLine(polarregion.example)}`);
    const pred = polarPredicate(r.clauses, tools);
    if (typeof pred === 'string') return fail(pred);
    const bounds = r.view ?? regionBounds(pred);
    if (!bounds) return fail('Nothing satisfies all of these inequalities: the region is empty');
    const R = Math.max(...bounds.flat().map(Math.abs));
    const frame = makeFrame([-R, R], [-R, R], { equal: true, width: 400, height: 380 });
    const clip = clipToBox(frame);
    let inner = path(fillWhere(frame, pred), { fill: COLORS[0], 'fill-opacity': 0.25, stroke: 'none' });
    // Outline: the edge of the shaded set.
    const g = (x: number, y: number) => (pred(x, y) ? -1 : 1);
    inner += path(segmentsPath(frame, contourSegments(g, [-R, R], [-R, R], 0, 160, 160)), { stroke: COLORS[0], 'stroke-width': 1.6 });
    let grid = '';
    const faint = { stroke: INK, 'stroke-opacity': 0.12, 'stroke-width': 1, fill: 'none' };
    for (let k = 1; k <= 4; k++) grid += circle(frame.sx(0), frame.sy(0), ((frame.sx(R) - frame.sx(0)) * k) / 4, faint);
    for (let k = 0; k < 12; k++) {
      const a = (k * Math.PI) / 6;
      grid += line(frame.sx(0), frame.sy(0), frame.sx(R * Math.cos(a)), frame.sy(R * Math.sin(a)), faint);
    }
    const body = clip.defs + drawAxes(frame, { grid: false }) + grid + `<g clip-path="${clip.attr}">${inner}</g>`;
    return { ok: true, svg: svg(frame.width, frame.height, body, 'Polar region'), notes: [] };
  },
};

/** "x, y >= 0" → "x >= 0, y >= 0". */
function fixShorthand(args: string): string {
  return args.replace(/\b([xy])\s*,\s*([xy])\s*(<=|>=|<|>|≤|≥)\s*([^,;\n]+)/g, '$1 $3 $4, $2 $3 $4');
}

// ---- Linear programming ---------------------------------------------------------------

interface Linear { a: number; b: number; c: number }

/** g(x, y) = a·x + b·y + c, if g really is linear. */
function linearOf(g: (x: number, y: number) => number): Linear | null {
  const c = g(0, 0), a = g(1, 0) - c, b = g(0, 1) - c;
  for (const [x, y] of [[2, 3], [-1.5, 4], [7, -2]]) if (Math.abs(g(x, y) - (a * x + b * y + c)) > 1e-7 * (1 + Math.abs(g(x, y)))) return null;
  return { a, b, c };
}

function readLP(args: string, tools: ArgTools) {
  let objective: { sense: 'max' | 'min'; f: (x: number, y: number) => number; text: string } | null = null;
  let answer: { x: number; y: number; label: string } | null = null;
  const rest: string[] = [];
  for (const clause of splitClauses(fixShorthand(args))) {
    const ans = clause.match(/^(max(?:imum)?|min(?:imum)?|optimum)\s+(?:at|is at)\s+(.*)$/i);
    if (ans) {
      const p = findPairs(ans[2], tools);
      if (typeof p !== 'string' && p.length) answer = { x: p[0].x, y: p[0].y, label: ans[0].replace(/^\w+\s+(is\s+)?at\s+/i, '') };
      continue;
    }
    const m = clause.match(/(?:^|,\s*|\s)(max(?:imise|imize)?|min(?:imise|imize)?)\s+(?:z\s*=\s*)?(.+)$/i);
    if (m) {
      const f = parseExpression(m[2], { vars: ['x', 'y'], fixName: tools.fixName });
      if (!f.ok) return `${f.message} in the objective “${m[2]}”`;
      objective = { sense: m[1].toLowerCase().startsWith('max') ? 'max' : 'min', f: (x, y) => f.fn(x, y), text: m[2].trim() };
      const before = clause.slice(0, m.index).trim();
      if (before) rest.push(before);
      continue;
    }
    rest.push(clause);
  }
  const r = readRegion(rest.join('\n'), tools, 'xy');
  if (typeof r === 'string') return r;
  return { ...r, objective, answer };
}

function corners(conds: Condition[]): [number, number][] {
  const lines = conds.map((c) => linearOf(c.g)).filter((l): l is Linear => !!l);
  const pts: [number, number][] = [];
  for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
    const p = lines[i], q = lines[j];
    const det = p.a * q.b - p.b * q.a;
    if (Math.abs(det) < 1e-12) continue;
    const x = (-p.c * q.b + p.b * q.c) / det;
    const y = (-p.a * q.c + p.c * q.a) / det;
    if (conds.every((c) => c.g(x, y) <= 1e-9 * (1 + Math.abs(x) + Math.abs(y)))) {
      if (!pts.some(([u, v]) => Math.abs(u - x) < 1e-9 && Math.abs(v - y) < 1e-9)) pts.push([x, y]);
    }
  }
  return pts;
}

export const feasible: FigureCommand = {
  name: 'feasible',
  area: 'Regions',
  example: '/feasible x + y <= 4, x <= 3, x, y >= 0\n  + max 3x + 2y',
  description: 'The feasible region of a linear program, its corner points and the direction of the objective. With Compute on, the optimum is suggested.',
  draw(args, tools) {
    const lp = readLP(args, tools);
    if (typeof lp === 'string') return fail(`${lp}. Try: ${firstLine(feasible.example)}`);
    if (!lp.conds.length) return fail(`Which constraints? e.g. ${firstLine(feasible.example)}`);
    const pic = drawRegion(lp.conds, lp.view);
    if (typeof pic === 'string') return fail(pic);
    const { frame } = pic;
    let body = pic.body;
    const pts = corners(lp.conds);
    for (const [x, y] of pts) body += dot(frame, x, y, { r: 3.5 });
    if (lp.objective && pts.length) {
      // Arrow in the direction the objective increases (or decreases for min), from the middle.
      const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      const lin = linearOf(lp.objective.f);
      if (lin) {
        const sign = lp.objective.sense === 'max' ? 1 : -1;
        const len = Math.hypot(lin.a, lin.b) || 1;
        const span = (frame.x[1] - frame.x[0]) * 0.18;
        const [dx, dy] = [(sign * lin.a * span) / len, (sign * lin.b * span) / len];
        body += line(frame.sx(cx - dy * 3), frame.sy(cy + dx * 3), frame.sx(cx + dy * 3), frame.sy(cy - dx * 3), { ...DASHED, stroke: COLORS[1], 'stroke-width': 1.3 });
        body += arrow(frame.sx(cx), frame.sy(cy), frame.sx(cx + dx), frame.sy(cy + dy), { stroke: COLORS[1], 'stroke-width': 2 });
        body += text(frame.sx(cx + dx) + 6, frame.sy(cy + dy) - 4, `${lp.objective.sense} ${lp.objective.text}`, { 'font-size': 12, fill: COLORS[1], 'font-style': 'italic' });
      }
    }
    if (lp.answer) body += dot(frame, lp.answer.x, lp.answer.y, { r: 6, color: COLORS[1], label: lp.answer.label });
    return { ok: true, svg: svg(frame.width, frame.height, body, 'Feasible region'), notes: [] };
  },
  suggest(args, tools) {
    const lp = readLP(args, tools);
    if (typeof lp === 'string' || !lp.objective || lp.answer) return null;
    const pts = corners(lp.conds);
    if (!pts.length) return null;
    const { f, sense } = lp.objective;
    // Unbounded? Check far along the objective direction.
    const lin = linearOf(f);
    if (lin) {
      const s = sense === 'max' ? 1 : -1;
      const far = [lin.a * s * 1e6, lin.b * s * 1e6];
      const base = pts[0];
      if (lp.conds.every((c) => c.test(base[0] + far[0], base[1] + far[1]))) return [`${sense} is unbounded`];
    }
    const best = pts.reduce((b, p) => ((sense === 'max' ? f(p[0], p[1]) > f(b[0], b[1]) : f(p[0], p[1]) < f(b[0], b[1])) ? p : b));
    return [`${sense} at (${fmt(best[0])}, ${fmt(best[1])}), value ${fmt(f(best[0], best[1]))}`];
  },
};

// ---- Balls ------------------------------------------------------------------------------

export const ball: FigureCommand = {
  name: 'ball',
  area: 'Regions',
  example: '/ball (1, 1) r=2 open',
  description: 'An open (dashed edge) or closed disk around a point, with its radius.',
  draw(args, tools) {
    const input = args.replace(/[\n;]+/g, ' ');
    const centres = findPairs(input, tools);
    if (typeof centres === 'string') return fail(centres);
    const c = centres[0] ?? { x: 0, y: 0, name: null };
    const r = numParam(input, tools, 'r', 'radius', 'eps', 'ε', 'delta', 'δ') ?? 1;
    const open = hasWord(input, 'open', tools) || !hasWord(input, 'closed', tools);
    const pad = r * 0.6 + 0.5;
    const frame = makeFrame([Math.min(-0.5, c.x - r - pad), Math.max(0.5, c.x + r + pad)], [Math.min(-0.5, c.y - r - pad), Math.max(0.5, c.y + r + pad)], { equal: true, width: 400, height: 360 });
    let body = drawAxes(frame);
    const R = frame.sx(c.x + r) - frame.sx(c.x);
    body += circle(frame.sx(c.x), frame.sy(c.y), R, { fill: COLORS[0], 'fill-opacity': 0.15, stroke: COLORS[0], 'stroke-width': 2, ...(open ? DASHED : {}) });
    body += line(frame.sx(c.x), frame.sy(c.y), frame.sx(c.x + r * Math.cos(0.6)), frame.sy(c.y + r * Math.sin(0.6)), { stroke: COLORS[0], 'stroke-width': 1.5 });
    body += text(frame.sx(c.x + (r / 2) * Math.cos(0.6)) - 4, frame.sy(c.y + (r / 2) * Math.sin(0.6)) - 6, /eps|ε/.test(input) ? 'ε' : /delta|δ/.test(input) ? 'δ' : 'r', { 'font-style': 'italic', fill: COLORS[0] });
    body += dot(frame, c.x, c.y, { label: c.name ?? '' });
    return { ok: true, svg: svg(frame.width, frame.height, body, `${open ? 'Open' : 'Closed'} ball`), notes: [`${open ? 'open' : 'closed'} ball of radius ${fmt(r)}`] };
  },
};

export const REGION_COMMANDS: FigureCommand[] = [region, polarregion, feasible, ball];
