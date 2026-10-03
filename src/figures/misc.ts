// Topology, number theory and numerical methods:
//   /glue a b a^-1 b^-1 · torus · klein · rp2 · mobius
//   /euclid 252 198     (steps are yours to write, or suggested with Compute on)
//   /clock 12 + mark 7 + add 7 8 + multiples 3
//   /newton x^2 - 2 from 1 steps 3 · /cobweb cos x from 1 steps 6
//   /bisection x^3 - x - 2 on [1, 2] steps 4 · /interpolate (0,1) (1,3) (2,2)

import { parseExpression, parseNumber } from './expr';
import { readRange } from './range';
import { splitClauses, findPairs, numParam, fmt } from './args';
import {
  svg, makeFrame, drawAxes, path, line, text, circle, el, COLORS, INK, clipToBox, polyline, functionPath,
  autoRange, dot, DASHED, arrowHead, round,
} from './svg';
import { fail, type ArgTools, type FigureCommand } from './types';
import { subscript } from './graphs';

type Pt = [number, number];

// ---- Gluing diagrams ---------------------------------------------------------------------------

const NAMED_WORDS: Record<string, string> = {
  torus: 'a b a^-1 b^-1', klein: 'a b a^-1 b', kleinbottle: 'a b a^-1 b', rp2: 'a b a b', projective: 'a b a b',
  projectiveplane: 'a b a b', sphere: 'a a^-1', cylinder: 'a b a^-1', mobius: 'mobius', möbius: 'mobius',
};

export const glue: FigureCommand = {
  name: 'glue',
  area: 'Topology, number theory, numerics',
  example: '/glue a b a^-1 b^-1',
  description: 'A gluing (identification) diagram from a word: a b a^-1 b^-1 (torus). Named: torus, klein, rp2, sphere, mobius. Edges with the same letter get the same number of arrowheads.',
  draw(args, tools) {
    let input = args.replace(/[\n;]+/g, ' ').trim();
    const named = NAMED_WORDS[tools.invokedAs] ?? NAMED_WORDS[input.toLowerCase().replace(/[\s-]/g, '')];
    const title = named ? (NAMED_WORDS[tools.invokedAs] ? tools.invokedAs : input) : '';
    if (named) input = named;
    const W = 320, H = 300, c: Pt = [W / 2, H / 2 + 6];
    let body = '';
    const arrowsOn = (a: Pt, b: Pt, count: number, color: string) => {
      const d: Pt = [b[0] - a[0], b[1] - a[1]];
      for (let i = 0; i < count; i++) {
        const t = 0.5 + (i - (count - 1) / 2) * 0.07;
        const p: Pt = [a[0] + d[0] * t, a[1] + d[1] * t];
        body += arrowHead(p[0] - d[0] * 0.01, p[1] - d[1] * 0.01, p[0] + d[0] * 0.04, p[1] + d[1] * 0.04, color, 11);
      }
    };
    if (input === 'mobius') {
      const [x0, x1, y0, y1] = [70, 250, 80, 230];
      body += el('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0, fill: COLORS[0], 'fill-opacity': 0.08, stroke: 'none' });
      body += line(x0, y0, x1, y0, { 'stroke-width': 1.5, ...DASHED }) + line(x0, y1, x1, y1, { 'stroke-width': 1.5, ...DASHED });
      body += line(x0, y1, x0, y0, { stroke: COLORS[0], 'stroke-width': 2.5 }) + line(x1, y0, x1, y1, { stroke: COLORS[0], 'stroke-width': 2.5 });
      arrowsOn([x0, y1], [x0, y0], 1, COLORS[0]);
      arrowsOn([x1, y0], [x1, y1], 1, COLORS[0]);
      body += text(x0 - 14, (y0 + y1) / 2 + 5, 'a', { 'font-style': 'italic', 'text-anchor': 'end', fill: COLORS[0], 'font-size': 16 });
      body += text(x1 + 14, (y0 + y1) / 2 + 5, 'a', { 'font-style': 'italic', fill: COLORS[0], 'font-size': 16 });
      body += text(W / 2, 40, 'Möbius band', { 'text-anchor': 'middle', 'font-size': 14 });
      return { ok: true, svg: svg(W, H, body, 'Möbius band'), notes: [] };
    }
    // Letters with ^-1, ⁻¹, ' or a capital (when both cases appear) are inverses.
    const tokens = [...input.matchAll(/([A-Za-z])\s*(\^\s*\{?\s*-\s*1\s*\}?|⁻¹|')?/g)];
    const both = (ch: string) => input.includes(ch.toLowerCase()) && input.includes(ch.toUpperCase());
    const edges = tokens.map((m) => {
      const letter = m[1];
      const capInverse = letter === letter.toUpperCase() && both(letter);
      return { letter: letter.toLowerCase(), inverse: !!m[2] || capInverse };
    });
    if (edges.length < 2) return fail(`Give a word like ${glue.example}, or a name: torus, klein, rp2, sphere, mobius`);
    const letters = [...new Set(edges.map((e) => e.letter))];
    const n = edges.length;
    const R = 105;
    const verts: Pt[] = n === 2
      ? [[c[0], c[1] - R], [c[0], c[1] + R]]
      : Array.from({ length: n }, (_, i) => { const t = Math.PI / 2 + Math.PI / n + (2 * Math.PI * i) / n; return [c[0] + R * Math.cos(t), c[1] - R * Math.sin(t)]; });
    if (n === 2) {
      // A 2-gon: two arcs.
      edges.forEach((e, i) => {
        const side = i === 0 ? -1 : 1;
        const color = COLORS[letters.indexOf(e.letter) % COLORS.length];
        const [a, b] = i === 0 ? [verts[0], verts[1]] : [verts[1], verts[0]];
        const ctrl: Pt = [c[0] + side * R * 1.1, c[1]];
        body += el('path', { d: `M${a[0]},${a[1]} Q${ctrl[0]},${ctrl[1]} ${b[0]},${b[1]}`, fill: COLORS[0], 'fill-opacity': 0.05, stroke: color, 'stroke-width': 2.5 });
        const p: Pt = [c[0] + side * R * 0.55, c[1]];
        const dir = (i === 0 ? 1 : -1) * (e.inverse ? -1 : 1);
        for (let k = 0; k < letters.indexOf(e.letter) + 1; k++) body += arrowHead(p[0], p[1] - dir * (6 - k * 8), p[0], p[1] + dir * (6 + k * 8), color, 11);
        body += text(c[0] + side * R * 0.75, c[1] + 5, e.letter, { 'font-style': 'italic', 'text-anchor': 'middle', fill: color, 'font-size': 16 });
      });
    } else {
      body += el('path', { d: `M${verts.map((v) => `${round(v[0])},${round(v[1])}`).join('L')}Z`, fill: COLORS[0], 'fill-opacity': 0.06, stroke: 'none' });
      edges.forEach((e, i) => {
        const [a, b] = [verts[i], verts[(i + 1) % n]];
        const color = COLORS[letters.indexOf(e.letter) % COLORS.length];
        body += line(a[0], a[1], b[0], b[1], { stroke: color, 'stroke-width': 2.5 });
        const [from, to] = e.inverse ? [b, a] : [a, b];
        arrowsOn(from, to, letters.indexOf(e.letter) + 1, color);
        const m: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const out: Pt = [m[0] - c[0], m[1] - c[1]];
        const L = Math.hypot(...out) || 1;
        body += text(m[0] + (out[0] / L) * 18, m[1] + (out[1] / L) * 18 + 5, e.letter, { 'font-style': 'italic', 'text-anchor': 'middle', fill: color, 'font-size': 16 });
      });
      for (const v of verts) body += circle(v[0], v[1], 3, { fill: INK });
    }
    if (title) body += text(W / 2, 22, title, { 'text-anchor': 'middle', 'font-size': 14 });
    return { ok: true, svg: svg(W, H, body, `Gluing diagram ${input}`), notes: [] };
  },
};

// ---- Euclid's algorithm ------------------------------------------------------------------------

function euclidSteps(a: number, b: number) {
  const steps: { a: number; q: number; b: number; r: number }[] = [];
  let [x, y] = [a, b];
  while (y !== 0) { steps.push({ a: x, q: Math.floor(x / y), b: y, r: x % y }); [x, y] = [y, x % y]; }
  // Bézout: s·a + t·b = gcd (extended Euclid).
  let [r0, r1, s0, s1, t0, t1] = [a, b, 1, 0, 0, 1];
  while (r1 !== 0) { const q = Math.floor(r0 / r1); [r0, r1] = [r1, r0 - q * r1]; [s0, s1] = [s1, s0 - q * s1]; [t0, t1] = [t1, t0 - q * t1]; }
  return { steps, g: x, s: s0, t: t0 };
}

function euclidParts(args: string) {
  const [head, ...lines] = splitClauses(args);
  const nums = (head ?? '').match(/-?\d+/g)?.map(Number) ?? [];
  return { nums, lines };
}

export const euclid: FigureCommand = {
  name: 'euclid',
  area: 'Topology, number theory, numerics',
  example: '/euclid 252 198',
  description: 'Euclid’s algorithm for gcd(a, b): write each step “252 = 1·198 + 54” on a “+” line (or let Compute suggest them, with the gcd and Bézout’s identity).',
  draw(args) {
    const { nums, lines } = euclidParts(args);
    if (nums.length < 2 || nums.some((n) => n <= 0 || n > 1e12)) return fail(`Give two positive whole numbers, e.g. ${euclid.example}`);
    const [a, b] = nums;
    const rows = lines.map((l) => {
      const m = l.match(/^(\d+)\s*=\s*(\d+)\s*[·*×x.]\s*(\d+)\s*\+\s*(\d+)$/);
      if (m) return `${m[1]} &= ${m[2]} \\cdot ${m[3]} + ${m[4]}`;
      const g = l.match(/^gcd\s*=\s*(.+)$/i);
      if (g) return `\\gcd(${a}, ${b}) &= ${g[1]}`;
      const parts = l.split('=');
      return parts.length >= 2 ? `${parts[0].trim()} &= ${parts.slice(1).join('=').replace(/[·*]/g, '\\cdot ').trim()}` : `& \\text{${l.replace(/[{}\\]/g, '')}}`;
    });
    const latex = `\\begin{aligned} &\\gcd(${a}, ${b}) \\\\ ${rows.join(' \\\\ ')} \\end{aligned}`;
    return { ok: true, latex, notes: [] };
  },
  suggest(args) {
    const { nums, lines } = euclidParts(args);
    if (nums.length < 2 || nums.some((n) => n <= 0 || n > 1e12) || lines.length) return null;
    const { steps, g, s, t } = euclidSteps(Math.max(nums[0], nums[1]), Math.min(nums[0], nums[1]));
    const [A, B] = [Math.max(nums[0], nums[1]), Math.min(nums[0], nums[1])];
    return [
      ...steps.map((st) => `${st.a} = ${st.q}·${st.b} + ${st.r}`),
      `gcd = ${g}`,
      `${g} = ${s}·${A} ${t < 0 ? '−' : '+'} ${Math.abs(t)}·${B}`,
    ];
  },
};

// ---- Modular clock -----------------------------------------------------------------------------

export const clock: FigureCommand = {
  name: 'clock',
  area: 'Topology, number theory, numerics',
  example: '/clock 12\n  + add 7 8\n  + multiples 3',
  description: 'Arithmetic mod n on a clock. Options: mark a, b · add a b (start at a, step b) · multiples k (joins 0, k, 2k, … — a cyclic subgroup).',
  draw(args, tools) {
    const clauses = splitClauses(args);
    const n = Math.round(parseNumber(clauses[0] ?? '12', tools.fixName) ?? 12);
    if (n < 2 || n > 60) return fail('Use a modulus from 2 to 60');
    const W = 320, H = 320, c: Pt = [160, 160], R = 115;
    const pos = (k: number): Pt => { const t = Math.PI / 2 - (2 * Math.PI * k) / n; return [c[0] + R * Math.cos(t), c[1] - R * Math.sin(t)]; };
    let body = circle(c[0], c[1], R, { fill: COLORS[0], 'fill-opacity': 0.05, stroke: INK, 'stroke-width': 1.8 });
    const marked = new Set<number>();
    let extra = '';
    for (const cl of clauses.slice(1)) {
      let m: RegExpMatchArray | null;
      if ((m = cl.match(/^mark\s+(.+)$/i))) m[1].split(/[\s,]+/).map(Number).filter(Number.isFinite).forEach((k) => marked.add(((k % n) + n) % n));
      else if ((m = cl.match(/^add\s+(-?\d+)\s*(?:\+|by|,)?\s*(-?\d+)$/i))) {
        const [a, b] = [Number(m[1]), Number(m[2])];
        const steps = Math.abs(b), dir = Math.sign(b) || 1;
        let k = ((a % n) + n) % n;
        marked.add(k);
        for (let i = 0; i < steps; i++) {
          const [p, q] = [pos(k), pos(k + dir)];
          const mx = c[0] + ((p[0] + q[0]) / 2 - c[0]) * 1.12, my = c[1] + ((p[1] + q[1]) / 2 - c[1]) * 1.12;
          extra += el('path', { d: `M${round(p[0])},${round(p[1])} Q${round(mx)},${round(my)} ${round(q[0])},${round(q[1])}`, fill: 'none', stroke: COLORS[1], 'stroke-width': 1.8 });
          if (i === steps - 1) extra += arrowHead(mx, my, q[0], q[1], COLORS[1], 9);
          k = (((k + dir) % n) + n) % n;
        }
        marked.add(k);
      } else if ((m = cl.match(/^multiples?\s+(?:of\s+)?(\d+)$/i))) {
        const step = Number(m[1]);
        let k = 0;
        const seen: number[] = [];
        do { seen.push(k); k = (k + step) % n; } while (!seen.includes(k) && seen.length <= n);
        extra += el('path', { d: `M${seen.map((s) => pos(s).map(round).join(',')).join('L')}Z`, fill: COLORS[2], 'fill-opacity': 0.12, stroke: COLORS[2], 'stroke-width': 1.8 });
        seen.forEach((s) => marked.add(s));
      }
    }
    body += extra;
    for (let k = 0; k < n; k++) {
      const [x, y] = pos(k);
      body += circle(x, y, marked.has(k) ? 6 : 3.5, { fill: marked.has(k) ? COLORS[1] : INK });
      const [lx, ly] = [c[0] + (x - c[0]) * 1.16, c[1] + (y - c[1]) * 1.16];
      body += text(lx, ly + 5, String(k), { 'text-anchor': 'middle', 'font-size': n > 24 ? 10 : 14, 'font-weight': marked.has(k) ? 700 : 400 });
    }
    body += text(c[0], c[1] + 6, `mod ${n}`, { 'text-anchor': 'middle', 'font-size': 15, 'font-style': 'italic' });
    return { ok: true, svg: svg(W, H, body, `Clock mod ${n}`), notes: [] };
  },
};

// ---- Numerical methods ---------------------------------------------------------------------------

function readIteration(args: string, tools: ArgTools) {
  const input = args.replace(/[\n;]+/g, ' ');
  const steps = Math.max(1, Math.min(30, Math.round(numParam(input, tools, 'steps', 'n', 'iterations') ?? Number(input.match(/\bsteps?\s+(\d+)/i)?.[1] ?? 3))));
  const m = input.match(/^(.*?)\s+(?:from|x0\s*=|start(?:ing)?\s+at|at)\s+([^\s]+)/i);
  const start = m ? parseNumber(m[2], tools.fixName) : null;
  const src = (m ? m[1] : input.replace(/\bsteps?\b.*$/i, '')).replace(/^\s*(f\(x\)|g\(x\)|y)\s*=\s*/i, '').trim();
  const parsed = parseExpression(src, { vars: ['x'], fixName: tools.fixName });
  if (!parsed.ok) return parsed.message;
  return { f: (x: number) => parsed.fn(x), start, steps, src, input };
}

export const newton: FigureCommand = {
  name: 'newton',
  area: 'Topology, number theory, numerics',
  example: '/newton x^2 - 2 from 3 steps 3',
  description: 'Newton’s method: tangent lines from xₖ down to the x-axis give xₖ₊₁.',
  draw(args, tools) {
    const it = readIteration(args, tools);
    if (typeof it === 'string') return fail(`${it}. Try: ${newton.example}`);
    const { f, steps } = it;
    let x = it.start ?? 1;
    const xs = [x];
    for (let k = 0; k < steps; k++) {
      const d = (f(x + 1e-6) - f(x - 1e-6)) / 2e-6;
      if (!d || !Number.isFinite(d)) break;
      x = x - f(x) / d;
      if (!Number.isFinite(x)) break;
      xs.push(x);
    }
    const lo = Math.min(...xs), hi = Math.max(...xs);
    const pad = Math.max(0.6, (hi - lo) * 0.35);
    const xr: [number, number] = [lo - pad, hi + pad];
    const vals = Array.from({ length: 201 }, (_, i) => f(xr[0] + ((xr[1] - xr[0]) * i) / 200));
    const frame = makeFrame(xr, autoRange(vals) ?? [-1, 1]);
    const clip = clipToBox(frame);
    let inner = path(functionPath(frame, f), { stroke: INK, 'stroke-width': 2 });
    xs.slice(0, -1).forEach((xk, k) => {
      const next = xs[k + 1];
      inner += line(frame.sx(xk), frame.sy(0), frame.sx(xk), frame.sy(f(xk)), { ...DASHED, 'stroke-width': 1, 'stroke-opacity': 0.6 });
      inner += line(frame.sx(xk), frame.sy(f(xk)), frame.sx(next), frame.sy(0), { stroke: COLORS[1], 'stroke-width': 1.8 });
    });
    let body = clip.defs + drawAxes(frame) + `<g clip-path="${clip.attr}">${inner}</g>`;
    xs.forEach((xk, k) => {
      body += dot(frame, xk, 0, { color: COLORS[1], r: 3.5 });
      if (k < 5) body += text(frame.sx(xk), frame.sy(0) + 16 + (k % 2) * 12, `x${subscript(k)}`, { 'text-anchor': 'middle', 'font-size': 12, fill: COLORS[1], 'font-style': 'italic' });
    });
    return { ok: true, svg: svg(frame.width, frame.height, body, 'Newton’s method'), notes: [] };
  },
};

export const cobweb: FigureCommand = {
  name: 'cobweb',
  area: 'Topology, number theory, numerics',
  example: '/cobweb cos x from 0.2 steps 8',
  description: 'Cobweb diagram for the iteration xₙ₊₁ = g(xₙ): the curve, the line y = x and the staircase/spiral between them.',
  draw(args, tools) {
    const it = readIteration(args, tools);
    if (typeof it === 'string') return fail(`${it}. Try: ${cobweb.example}`);
    const { f, steps } = it;
    let x = it.start ?? 0.5;
    const pts: Pt[] = [[x, 0]];
    for (let k = 0; k < steps; k++) {
      const y = f(x);
      if (!Number.isFinite(y)) break;
      pts.push([x, y], [y, y]);
      x = y;
    }
    const all = pts.flat();
    const lo = Math.min(...all, 0), hi = Math.max(...all, 1);
    const pad = (hi - lo) * 0.2 + 0.2;
    const r: [number, number] = [lo - pad, hi + pad];
    const frame = makeFrame(r, r, { equal: true, width: 380, height: 360 });
    const clip = clipToBox(frame);
    let inner = path(functionPath(frame, f), { stroke: INK, 'stroke-width': 2 });
    inner += line(frame.sx(r[0]), frame.sy(r[0]), frame.sx(r[1]), frame.sy(r[1]), { ...DASHED, 'stroke-width': 1.2 });
    inner += path(polyline(frame, pts), { stroke: COLORS[1], 'stroke-width': 1.6 });
    const body = clip.defs + drawAxes(frame) + `<g clip-path="${clip.attr}">${inner}</g>` + dot(frame, pts[0][0], 0, { color: COLORS[1], label: 'x₀' });
    return { ok: true, svg: svg(frame.width, frame.height, body, 'Cobweb diagram'), notes: [] };
  },
};

export const bisection: FigureCommand = {
  name: 'bisection',
  area: 'Topology, number theory, numerics',
  example: '/bisection x^3 - x - 2 on [1, 2] steps 4',
  description: 'The bisection method: the function and, underneath, the interval halving at each step.',
  draw(args, tools) {
    const input = args.replace(/[\n;]+/g, ' ');
    const steps = Math.max(1, Math.min(12, Math.round(numParam(input, tools, 'steps', 'n') ?? Number(input.match(/\bsteps?\s+(\d+)/i)?.[1] ?? 4))));
    const m = input.match(/^(.*?)\s+(?:on|over|in|from|between)\s+(\[[^\]]*\]|\S+\s*(?:\.\.|to|and)\s*\S+)/i);
    if (!m) return fail(`Give an interval, e.g. ${bisection.example}`);
    const range = readRange(m[2], tools);
    const parsed = parseExpression(m[1].replace(/^\s*(f\(x\)|y)\s*=\s*/i, ''), { vars: ['x'], fixName: tools.fixName });
    if (!range || !parsed.ok) return fail(`Couldn't read that. Try: ${bisection.example}`);
    const f = (x: number) => parsed.fn(x);
    let [a, b] = range;
    if (f(a) * f(b) > 0) return fail(`f(${fmt(a)}) and f(${fmt(b)}) have the same sign, so bisection can't start`);
    const intervals: [number, number][] = [[a, b]];
    for (let k = 0; k < steps; k++) {
      const c = (a + b) / 2;
      if (f(a) * f(c) <= 0) b = c; else a = c;
      intervals.push([a, b]);
    }
    const pad = (range[1] - range[0]) * 0.25;
    const xr: [number, number] = [range[0] - pad, range[1] + pad];
    const vals = Array.from({ length: 201 }, (_, i) => f(xr[0] + ((xr[1] - xr[0]) * i) / 200));
    const frame = makeFrame(xr, autoRange(vals) ?? [-1, 1], { height: 240 });
    const clip = clipToBox(frame);
    let body = clip.defs + drawAxes(frame) + `<g clip-path="${clip.attr}">${path(functionPath(frame, f), { stroke: INK, 'stroke-width': 2 })}</g>`;
    const extraH = intervals.length * 16 + 16;
    intervals.forEach(([l, r], k) => {
      const y = frame.height + 8 + k * 16;
      body += line(frame.sx(l), y, frame.sx(r), y, { stroke: COLORS[k === intervals.length - 1 ? 1 : 0], 'stroke-width': 3 });
      body += line(frame.sx(l), y - 4, frame.sx(l), y + 4, { stroke: COLORS[0], 'stroke-width': 1.3 }) + line(frame.sx(r), y - 4, frame.sx(r), y + 4, { stroke: COLORS[0], 'stroke-width': 1.3 });
      body += text(frame.box.left - 4, y + 4, String(k), { 'font-size': 11, 'text-anchor': 'end', 'fill-opacity': 0.7 });
    });
    return { ok: true, svg: svg(frame.width, frame.height + extraH, body, 'Bisection method'), notes: [] };
  },
};

export const interpolate: FigureCommand = {
  name: 'interpolate',
  area: 'Topology, number theory, numerics',
  example: '/interpolate (0, 1) (1, 3) (2, 2) (3, 5)',
  description: 'The polynomial of lowest degree through the given points (Lagrange interpolation).',
  draw(args, tools) {
    const p = findPairs(args, tools);
    if (typeof p === 'string') return fail(p);
    if (p.length < 2) return fail(`Give at least two points, e.g. ${interpolate.example}`);
    const xs = p.map((q) => q.x), ys = p.map((q) => q.y);
    if (new Set(xs).size !== xs.length) return fail('Two points share the same x-value');
    const L = (x: number) => ys.reduce((s, y, i) => s + y * xs.reduce((prod, xj, j) => (j === i ? prod : (prod * (x - xj)) / (xs[i] - xj)), 1), 0);
    const [lo, hi] = [Math.min(...xs), Math.max(...xs)];
    const pad = (hi - lo) * 0.25 || 1;
    const xr: [number, number] = [lo - pad, hi + pad];
    const vals = Array.from({ length: 201 }, (_, i) => L(xr[0] + ((xr[1] - xr[0]) * i) / 200));
    const frame = makeFrame(xr, autoRange([...vals, ...ys]) ?? [-1, 1]);
    const clip = clipToBox(frame);
    let body = clip.defs + drawAxes(frame) + `<g clip-path="${clip.attr}">${path(functionPath(frame, L), { stroke: COLORS[0], 'stroke-width': 2.2 })}</g>`;
    for (const q of p) body += dot(frame, q.x, q.y, { color: COLORS[1], r: 4.5 });
    return { ok: true, svg: svg(frame.width, frame.height, body, 'Interpolating polynomial'), notes: [`degree ≤ ${p.length - 1}`] };
  },
};

export const MISC_COMMANDS: FigureCommand[] = [glue, euclid, clock, newton, cobweb, bisection, interpolate];
