// Differential equations:
//   /slopefield y' = y - x  (+ through (0,1))
//   /phase x' = y, y' = -x   or   /phase 0 1; -1 0
//   /phaseline y' = y(1 - y)
//   /euler y' = y from (0,1) h=0.5 n=4
//   /fourier square n=1,3,9
//   /spring damping

import { parseExpression } from './expr';
import { readRange } from './range';
import { splitClauses, splitTopLevel, findPairs, numParam, param, hasWord, fmt } from './args';
import {
  svg, makeFrame, drawAxes, path, line, text, circle, el, COLORS, INK, clipToBox, polyline, arrowHead,
  legend, dot, DASHED, directionArrows, looksLikePi, functionPath, autoRange, type Frame,
} from './svg';
import { fail, firstLine, type ArgTools, type FigureCommand } from './types';
import { zerosOf } from './signchart';
import { parseMatrix } from './linalg';
import { subscript } from './graphs';

type F2 = (x: number, y: number) => number;
type Pt = [number, number];

/** "y' = y - x", "dy/dx = x*y", "y' = f(t, y)" → f(x, y). */
function readODE(src: string, tools: ArgTools): F2 | string {
  const rhs = src.includes('=') ? src.slice(src.indexOf('=') + 1) : src;
  const r = parseExpression(rhs, { vars: ['x', 'y', 't'], fixName: tools.fixName });
  if (!r.ok) return `${r.message} in “${rhs.trim()}”`;
  return (x, y) => r.fn(x, y, x);
}

/** One RK4 step for y' = f(x, y). */
function rk4(f: F2, x: number, y: number, h: number): number {
  const k1 = f(x, y), k2 = f(x + h / 2, y + (h * k1) / 2), k3 = f(x + h / 2, y + (h * k2) / 2), k4 = f(x + h, y + h * k3);
  return y + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
}

/** Solution of y' = f through (x0, y0), across [a, b]. */
function solutionCurve(f: F2, x0: number, y0: number, a: number, b: number, yLimit: number): Pt[] {
  const steps = 500;
  const h = (b - a) / steps;
  const forward: Pt[] = [[x0, y0]];
  let [x, y] = [x0, y0];
  while (x < b && Math.abs(y) < yLimit) { y = rk4(f, x, y, h); x += h; if (!Number.isFinite(y)) break; forward.push([x, y]); }
  const backward: Pt[] = [];
  [x, y] = [x0, y0];
  while (x > a && Math.abs(y) < yLimit) { y = rk4(f, x, y, -h); x -= h; if (!Number.isFinite(y)) break; backward.unshift([x, y]); }
  return [...backward, ...forward];
}

function viewClauses(clauses: string[], tools: ArgTools) {
  let x: [number, number] | null = null, y: [number, number] | null = null;
  const rest: string[] = [];
  for (const c of clauses) {
    const m = c.match(/^([xyt])\s*(?:from|in|:)?\s*([^=]+)$/i);
    const r = m ? readRange(m[2], tools) : null;
    if (m && r) { if (m[1].toLowerCase() === 'y') y = r; else x = r; } else rest.push(c);
  }
  return { x, y, rest };
}

/** Short slope segments on a grid. */
function slopeSegments(frame: Frame, f: F2, nx = 21, ny = 15): string {
  let d = '';
  const cell = Math.min((frame.box.right - frame.box.left) / nx, (frame.box.bottom - frame.box.top) / ny);
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    const x = frame.x[0] + ((i + 0.5) * (frame.x[1] - frame.x[0])) / nx;
    const y = frame.y[0] + ((j + 0.5) * (frame.y[1] - frame.y[0])) / ny;
    const m = f(x, y);
    if (!Number.isFinite(m)) continue;
    // Direction in pixels (y flips), normalised to a fixed length.
    const dx = frame.sx(x + 1) - frame.sx(x), dy = frame.sy(y + m) - frame.sy(y);
    const len = Math.hypot(dx, dy) || 1;
    const L = cell * 0.36;
    const [cx, cy] = [frame.sx(x), frame.sy(y)];
    d += `M${(cx - (dx / len) * L).toFixed(1)},${(cy - (dy / len) * L).toFixed(1)}L${(cx + (dx / len) * L).toFixed(1)},${(cy + (dy / len) * L).toFixed(1)}`;
  }
  return path(d, { 'stroke-width': 1.2, 'stroke-opacity': 0.55 });
}

export const slopefield: FigureCommand = {
  name: 'slopefield',
  area: 'Differential equations',
  example: "/slopefield y' = y - x\n  + through (0, 1)\n  + through (0, 0.5)",
  description: 'Direction field of y′ = f(x, y), with solution curves through the points you give.',
  draw(args, tools) {
    const { x, y, rest } = viewClauses(splitClauses(args), tools);
    const starts: Pt[] = [];
    let ode = '';
    for (const c of rest) {
      if (/^(through|thru|via|ic|initial|from|start)\b/i.test(c) || /^\(/.test(c)) {
        const p = findPairs(c, tools);
        if (typeof p === 'string') return fail(p);
        starts.push(...p.map((q) => [q.x, q.y] as Pt));
      } else {
        const m = c.match(/^(.*?)\s+(?:through|thru)\s+(.*)$/i);
        ode = m ? m[1] : c;
        if (m) { const p = findPairs(m[2], tools); if (typeof p !== 'string') starts.push(...p.map((q) => [q.x, q.y] as Pt)); }
      }
    }
    const f = readODE(ode, tools);
    if (typeof f === 'string') return fail(`${f}. Try: ${firstLine(slopefield.example)}`);
    const xr = x ?? [-3, 3], yr = y ?? [-3, 3];
    const frame = makeFrame(xr, yr, { width: 440, height: 340 });
    const clip = clipToBox(frame);
    let inner = slopeSegments(frame, f);
    starts.forEach((p, i) => {
      const curve = solutionCurve(f, p[0], p[1], xr[0], xr[1], (yr[1] - yr[0]) * 20);
      inner += path(polyline(frame, curve), { stroke: COLORS[i % COLORS.length], 'stroke-width': 2.3 });
    });
    let body = clip.defs + drawAxes(frame, { grid: false }) + `<g clip-path="${clip.attr}">${inner}</g>`;
    starts.forEach((p, i) => { body += dot(frame, p[0], p[1], { color: COLORS[i % COLORS.length] }); });
    body += text(frame.box.left + 6, frame.box.top + 14, ode.trim(), { 'font-size': 13, 'font-style': 'italic' });
    return { ok: true, svg: svg(frame.width, frame.height, body, 'Slope field'), notes: [] };
  },
};

// ---- Phase portraits -------------------------------------------------------------------------

function readSystem2(args: string, tools: ArgTools) {
  const clauses = splitClauses(args).flatMap((c) => (c.includes("'") || /d[xy]\/dt/.test(c) ? splitTopLevel(c, ',') : [c]));
  const { x, rest } = viewClauses(clauses, tools);
  const starts: Pt[] = [];
  const eqs: string[] = [];
  const matrixRows: string[] = [];
  for (const c of rest) {
    if (/^(through|thru|from|start)\b/i.test(c)) {
      const p = findPairs(c, tools);
      if (typeof p !== 'string') starts.push(...p.map((q) => [q.x, q.y] as Pt));
    } else if (/=/.test(c)) eqs.push(c);
    else matrixRows.push(c);
  }
  let F: (x: number, y: number) => Pt;
  let linear = false;
  if (eqs.length >= 2) {
    const get = (name: string) => eqs.find((e) => new RegExp(`^\\s*(${name}'|d${name}/dt|${name}\\s*dot|\\\\dot\\{?${name}\\}?)\\s*=`, 'i').test(e));
    const ex = get('x'), ey = get('y');
    if (!ex || !ey) return `Write the system as x' = …, y' = … (try: ${firstLine(phase.example)})`;
    const P = parseExpression(ex.slice(ex.indexOf('=') + 1), { vars: ['x', 'y'], fixName: tools.fixName });
    const Q = parseExpression(ey.slice(ey.indexOf('=') + 1), { vars: ['x', 'y'], fixName: tools.fixName });
    if (!P.ok) return P.message;
    if (!Q.ok) return Q.message;
    F = (a, b) => [P.fn(a, b), Q.fn(a, b)];
  } else {
    const m = parseMatrix(matrixRows.join('; '));
    if (typeof m === 'string' || m.rows.length !== 2 || m.rows[0].length !== 2) return `Give x' = …, y' = … or a 2×2 matrix. Try: ${firstLine(phase.example)}`;
    const A = m.rows.map((r) => r.map((e) => Number(eval1(e))));
    if (A.flat().some((v) => !Number.isFinite(v))) return 'The matrix entries need to be numbers';
    F = (a, b) => [A[0][0] * a + A[0][1] * b, A[1][0] * a + A[1][1] * b];
    linear = true;
  }
  return { F, starts, R: x ? Math.max(Math.abs(x[0]), Math.abs(x[1])) : 3, linear };
}

function eval1(e: string): number {
  const r = parseExpression(e);
  return r.ok ? r.fn() : NaN;
}

function trajectory(F: (x: number, y: number) => Pt, p: Pt, dt: number, R: number): Pt[] {
  const pts: Pt[] = [p];
  let [x, y] = p;
  for (let i = 0; i < 450; i++) {
    const k1 = F(x, y), k2 = F(x + (dt * k1[0]) / 2, y + (dt * k1[1]) / 2), k3 = F(x + (dt * k2[0]) / 2, y + (dt * k2[1]) / 2), k4 = F(x + dt * k3[0], y + dt * k3[1]);
    x += (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
    y += (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > R * 1.6 || Math.abs(y) > R * 1.6) break;
    pts.push([x, y]);
    if (i > 50 && Math.hypot(x - p[0], y - p[1]) < R * 0.004) break; // closed orbit
    if (Math.hypot(x, y) < R * 0.03) break; // reached the equilibrium
  }
  return pts;
}

export const phase: FigureCommand = {
  name: 'phase',
  area: 'Differential equations',
  example: "/phase x' = y, y' = -x - 0.3y",
  description: 'Phase portrait of a 2D system (or of the matrix A in x′ = Ax): arrows and trajectories. Add “through (1,0)” for your own starting points.',
  draw(args, tools) {
    const s = readSystem2(args, tools);
    if (typeof s === 'string') return fail(s);
    const { F, R } = s;
    const frame = makeFrame([-R, R], [-R, R], { equal: true, width: 400, height: 380 });
    const clip = clipToBox(frame);
    // Faint normalised arrows.
    let inner = '';
    const n = 13;
    const cell = (frame.box.right - frame.box.left) / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x = -R + ((i + 0.5) * 2 * R) / n, y = -R + ((j + 0.5) * 2 * R) / n;
      const [u, v] = F(x, y);
      const len = Math.hypot(u, v);
      if (!len || !Number.isFinite(len)) continue;
      const [cx, cy] = [frame.sx(x), frame.sy(y)];
      const [ux, uy] = [(u / len) * cell * 0.35, (-v / len) * cell * 0.35];
      inner += path(`M${cx - ux},${cy - uy}L${cx + ux},${cy + uy}`, { 'stroke-width': 1, 'stroke-opacity': 0.4 }) + arrowHead(cx - ux, cy - uy, cx + ux, cy + uy, 'currentColor', 4);
    }
    const starts: Pt[] = s.starts.length ? s.starts : Array.from({ length: 8 }, (_, k) => {
      const a = (2 * Math.PI * k) / 8 + 0.3;
      const r = R * (k % 2 ? 0.5 : 0.9);
      return [r * Math.cos(a), r * Math.sin(a)];
    });
    const dt = (R / 3) * 0.02;
    starts.forEach((p, i) => {
      const fwd = trajectory(F, p, dt, R);
      const back = trajectory(F, p, -dt, R).slice(0, 120).reverse();
      const curve = [...back, ...fwd.slice(1)];
      const color = s.starts.length ? COLORS[i % COLORS.length] : COLORS[0];
      inner += path(polyline(frame, curve), { stroke: color, 'stroke-width': 1.8 });
      inner += directionArrows(frame, fwd.length > 10 ? fwd : curve, 2, color);
    });
    let body = clip.defs + drawAxes(frame, { grid: false }) + `<g clip-path="${clip.attr}">${inner}</g>`;
    if (s.linear) body += dot(frame, 0, 0, { r: 3.5 });
    for (const p of s.starts) body += dot(frame, p[0], p[1], { r: 3 });
    return { ok: true, svg: svg(frame.width, frame.height, body, 'Phase portrait'), notes: [] };
  },
};

export const phaseline: FigureCommand = {
  name: 'phaseline',
  area: 'Differential equations',
  example: "/phaseline y' = y(1 - y)",
  description: 'Phase line of y′ = f(y): equilibria (filled = stable, hollow = unstable) and arrows, with some solution curves beside it.',
  draw(args, tools) {
    const { y, rest } = viewClauses(splitClauses(args), tools);
    const src = rest.join(' ');
    const rhs = src.includes('=') ? src.slice(src.indexOf('=') + 1) : src;
    const parsed = parseExpression(rhs, { vars: ['y', 't', 'x'], fixName: tools.fixName });
    if (!parsed.ok) return fail(`${parsed.message}. Try: ${phaseline.example}`);
    const f = (v: number) => parsed.fn(v, 0, 0);
    const eqAll = zerosOf(f, -50, 50);
    const span = eqAll.length ? [Math.min(...eqAll), Math.max(...eqAll)] : [-1, 1];
    const pad = Math.max(1, (span[1] - span[0]) * 0.5);
    const yr: [number, number] = y ?? [span[0] - pad, span[1] + pad];
    const eqs = eqAll.filter((e) => e >= yr[0] && e <= yr[1]);
    // Solutions y(t) on the right, the phase line on the left.
    const frame = makeFrame([-1.4, 5], yr, { width: 440, height: 340 });
    const clip = clipToBox(frame);
    const lineX = frame.sx(-0.8);
    let body = clip.defs;
    body += line(lineX, frame.box.top, lineX, frame.box.bottom, { 'stroke-width': 2 });
    body += line(frame.sx(0), frame.box.top, frame.sx(0), frame.box.bottom, { 'stroke-width': 1.2 });
    body += line(frame.sx(0), frame.box.bottom, frame.box.right, frame.box.bottom, { 'stroke-width': 1.2 });
    body += text(frame.box.right, frame.box.bottom + 16, 't', { 'font-style': 'italic', 'text-anchor': 'end' });
    body += text(lineX, frame.box.top - 4, 'y', { 'font-style': 'italic', 'text-anchor': 'middle' });
    const cuts = [yr[0], ...eqs, yr[1]];
    for (let i = 0; i < cuts.length - 1; i++) {
      const mid = (cuts[i] + cuts[i + 1]) / 2;
      const up = f(mid) > 0;
      const [y0, y1] = up ? [frame.sy(mid) + 8, frame.sy(mid) - 8] : [frame.sy(mid) - 8, frame.sy(mid) + 8];
      body += arrowHead(lineX, y0, lineX, y1, COLORS[0], 11);
    }
    let inner = '';
    const h = 0.02;
    for (let k = 0; k <= 12; k++) {
      let v = yr[0] + ((yr[1] - yr[0]) * (k + 0.5)) / 13;
      const pts: Pt[] = [[0, v]];
      for (let t = 0; t < 5; t += h) {
        const k1 = f(v), k2 = f(v + (h * k1) / 2), k3 = f(v + (h * k2) / 2), k4 = f(v + h * k3);
        v += (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
        if (!Number.isFinite(v) || Math.abs(v) > 1e3) break;
        pts.push([t + h, v]);
      }
      inner += path(polyline(frame, pts), { stroke: COLORS[0], 'stroke-width': 1.4, 'stroke-opacity': 0.7 });
    }
    for (const e of eqs) {
      inner += line(frame.sx(0), frame.sy(e), frame.box.right, frame.sy(e), { ...DASHED, stroke: COLORS[1], 'stroke-width': 1.2 });
    }
    body += `<g clip-path="${clip.attr}">${inner}</g>`;
    for (const e of eqs) {
      const below = f(e - 1e-4), above = f(e + 1e-4);
      const stable = below > 0 && above < 0, unstable = below < 0 && above > 0;
      body += circle(lineX, frame.sy(e), 5.5, stable ? { fill: COLORS[1] } : { stroke: COLORS[1], 'stroke-width': 2, style: unstable ? 'fill: var(--paper, #fff)' : `fill: ${COLORS[1]}; fill-opacity: 0.4` });
      body += text(lineX - 10, frame.sy(e) + 4, fmt(e, 3), { 'font-size': 12, 'text-anchor': 'end' });
    }
    return { ok: true, svg: svg(frame.width, frame.height, body, 'Phase line'), notes: [] };
  },
};

export const euler: FigureCommand = {
  name: 'euler',
  area: 'Differential equations',
  example: "/euler y' = y from (0, 1)\n  + h=0.5 n=4",
  description: 'Euler’s method: the steps (dots) against the true solution (dashed).',
  draw(args, tools) {
    const input = args.replace(/[\n;]+/g, ' ');
    const h = numParam(input, tools, 'h', 'step') ?? 0.5;
    const n = Math.min(200, Math.round(numParam(input, tools, 'n', 'steps') ?? 4));
    const start = findPairs(input, tools);
    if (typeof start === 'string') return fail(start);
    const [x0, y0] = start.length ? [start[0].x, start[0].y] : [0, 1];
    const odeText = input.replace(/\b(from|at|with|starting)\b.*$/i, '').replace(/\b(h|n|step|steps)\s*=\s*\S+/gi, '');
    const f = readODE(odeText, tools);
    if (typeof f === 'string') return fail(`${f}. Try: ${firstLine(euler.example)}`);
    const steps: Pt[] = [[x0, y0]];
    let [x, y] = [x0, y0];
    for (let i = 0; i < n; i++) { y += h * f(x, y); x += h; steps.push([x, y]); }
    const xEnd = x0 + n * h;
    const exact = solutionCurve(f, x0, y0, Math.min(x0, xEnd) - Math.abs(h) * 0.3, Math.max(x0, xEnd) + Math.abs(h) * 0.3, 1e6);
    const yr = autoRange([...steps.map((p) => p[1]), ...exact.map((p) => p[1])]) ?? [-1, 1];
    const frame = makeFrame([Math.min(x0, xEnd) - Math.abs(h) * 0.5, Math.max(x0, xEnd) + Math.abs(h) * 0.5], yr);
    const clip = clipToBox(frame);
    let inner = path(polyline(frame, exact), { stroke: INK, 'stroke-width': 1.6, ...DASHED });
    inner += path(polyline(frame, steps), { stroke: COLORS[1], 'stroke-width': 2.2 });
    let body = clip.defs + drawAxes(frame) + `<g clip-path="${clip.attr}">${inner}</g>`;
    steps.forEach(([px, py], i) => { body += dot(frame, px, py, { color: COLORS[1], r: 3.5, label: i <= 6 ? `y${subscript(i)}` : undefined }); });
    body += legend(frame, [{ label: `Euler, h = ${fmt(h)}`, color: COLORS[1] }, { label: 'true solution', color: '#888', dashed: true }]);
    return { ok: true, svg: svg(frame.width, frame.height, body, 'Euler’s method'), notes: [] };
  },
};

// ---- Fourier series -----------------------------------------------------------------------------

const WAVES: Record<string, (x: number) => number> = {
  square: (x) => (Math.sin(x) >= 0 ? 1 : -1),
  sawtooth: (x) => x - 2 * Math.PI * Math.floor((x + Math.PI) / (2 * Math.PI)),
  triangle: (x) => Math.abs(x - 2 * Math.PI * Math.floor((x + Math.PI) / (2 * Math.PI))),
};

export const fourier: FigureCommand = {
  name: 'fourier',
  area: 'Differential equations',
  example: '/fourier square\n  + n=1, 3, 9',
  description: 'Fourier partial sums Sₙ of a 2π-periodic function: square, sawtooth, triangle, or any f(x) given on (−π, π).',
  draw(args, tools) {
    const input = args.replace(/[\n;]+/g, ' ');
    const nText = param(input.replace(/\s*,\s*/g, ','), 'n', 'terms') ?? '1,3,9';
    const ns = nText.split(',').map(Number).filter((v) => Number.isInteger(v) && v >= 0 && v <= 200);
    const body0 = input.replace(/\b(n|terms)\s*=\s*[\d,\s]+/i, '').trim();
    const wave = Object.keys(WAVES).find((w) => hasWord(body0, w, tools));
    let f: (x: number) => number;
    let label: string;
    if (wave) { f = WAVES[wave]; label = `${wave} wave`; } else {
      const parsed = parseExpression(body0.replace(/^\s*(f\(x\)|y)\s*=\s*/i, ''), { vars: ['x'], fixName: tools.fixName });
      if (!parsed.ok) return fail(`${parsed.message}. Try: ${firstLine(fourier.example)}`);
      // Extend periodically from (−π, π).
      f = (x) => parsed.fn(x - 2 * Math.PI * Math.floor((x + Math.PI) / (2 * Math.PI)));
      label = `f(x) = ${body0}`;
    }
    // Coefficients by numerical integration over one period.
    const N = 4000;
    const maxN = Math.max(...ns, 1);
    const a: number[] = [], b: number[] = [];
    for (let k = 0; k <= maxN; k++) {
      let sa = 0, sb = 0;
      for (let i = 0; i < N; i++) {
        const x = -Math.PI + ((i + 0.5) * 2 * Math.PI) / N;
        const v = f(x);
        sa += v * Math.cos(k * x);
        sb += v * Math.sin(k * x);
      }
      a.push((sa * 2) / N);
      b.push((sb * 2) / N);
    }
    const S = (n: number) => (x: number) => {
      let s = a[0] / 2;
      for (let k = 1; k <= n; k++) s += a[k] * Math.cos(k * x) + b[k] * Math.sin(k * x);
      return s;
    };
    const xr: [number, number] = [-2 * Math.PI, 2 * Math.PI];
    const vals = Array.from({ length: 400 }, (_, i) => f(xr[0] + ((xr[1] - xr[0]) * i) / 400));
    const frame = makeFrame(xr, autoRange(vals) ?? [-1.5, 1.5]);
    const clip = clipToBox(frame);
    let inner = path(functionPath(frame, f), { stroke: INK, 'stroke-width': 1.4, 'stroke-opacity': 0.5 });
    ns.forEach((n, i) => { inner += path(functionPath(frame, S(n)), { stroke: COLORS[i % COLORS.length], 'stroke-width': 2 }); });
    let body = clip.defs + drawAxes(frame, { piX: looksLikePi(xr[0], xr[1]) }) + `<g clip-path="${clip.attr}">${inner}</g>`;
    body += legend(frame, [{ label, color: '#999' }, ...ns.map((n, i) => ({ label: `S${subscript(n)}`, color: COLORS[i % COLORS.length] }))]);
    return { ok: true, svg: svg(frame.width, frame.height, body, 'Fourier series'), notes: [] };
  },
};

// ---- A mass on a spring --------------------------------------------------------------------------

export const spring: FigureCommand = {
  name: 'spring',
  area: 'Differential equations',
  example: '/spring damping\n  + force',
  description: 'Mass–spring sketch for mx″ + cx′ + kx = F(t); options damping, force.',
  draw(args, tools) {
    const input = args.replace(/[\n;]+/g, ' ');
    const damped = hasWord(input, 'damping', tools) || hasWord(input, 'damper', tools) || hasWord(input, 'damped', tools);
    const forced = hasWord(input, 'force', tools) || hasWord(input, 'forced', tools);
    const W = 440, H = 170;
    let body = '';
    // Wall and floor.
    body += line(30, 20, 30, 140, { 'stroke-width': 2.5 }) + line(30, 140, 420, 140, { 'stroke-width': 2 });
    for (let y = 26; y < 140; y += 12) body += line(30, y, 20, y + 10, { 'stroke-width': 1 });
    const springY = damped ? 62 : 85;
    // Zigzag spring from the wall to the mass.
    const [x0, x1] = [30, 230];
    let d = `M${x0},${springY}L${x0 + 20},${springY}`;
    const coils = 9;
    for (let i = 0; i < coils; i++) {
      const x = x0 + 20 + ((x1 - x0 - 40) * (i + 0.5)) / coils;
      d += `L${x},${springY + (i % 2 ? 12 : -12)}`;
    }
    d += `L${x1 - 20},${springY}L${x1},${springY}`;
    body += path(d, { 'stroke-width': 1.8 });
    body += text(130, springY - 18, 'k', { 'font-style': 'italic', 'text-anchor': 'middle' });
    if (damped) {
      const y = 110;
      body += line(30, y, 110, y, { 'stroke-width': 1.8 }) + el('rect', { x: 110, y: y - 12, width: 50, height: 24, fill: 'none', stroke: INK, 'stroke-width': 1.8 });
      body += line(130, y - 8, 130, y + 8, { 'stroke-width': 2.5 }) + line(130, y, 230, y, { 'stroke-width': 1.8 });
      body += text(135, y + 30, 'c', { 'font-style': 'italic', 'text-anchor': 'middle' });
    }
    // The mass.
    body += el('rect', { x: 230, y: 45, width: 90, height: 95, fill: COLORS[0], 'fill-opacity': 0.15, stroke: INK, 'stroke-width': 2, rx: 4 });
    body += text(275, 100, 'm', { 'font-style': 'italic', 'text-anchor': 'middle', 'font-size': 20 });
    body += arrowHead(275, 30, 330, 30, INK, 8) + line(275, 30, 326, 30, { 'stroke-width': 1.3 });
    body += text(340, 34, 'x', { 'font-style': 'italic' });
    if (forced) {
      body += line(320, 92, 395, 92, { stroke: COLORS[1], 'stroke-width': 2.2 }) + arrowHead(320, 92, 405, 92, COLORS[1], 10);
      body += text(400, 80, 'F(t)', { 'font-style': 'italic', fill: COLORS[1], 'text-anchor': 'end' });
    }
    const eq = `m x″ ${damped ? '+ c x′ ' : ''}+ k x = ${forced ? 'F(t)' : '0'}`;
    body += text(W / 2, H - 6, eq, { 'font-style': 'italic', 'text-anchor': 'middle', 'font-size': 14 });
    return { ok: true, svg: svg(W, H, body, 'Mass on a spring'), notes: [] };
  },
};

export const DIFFEQ_COMMANDS: FigureCommand[] = [slopefield, phase, phaseline, euler, fourier, spring];
