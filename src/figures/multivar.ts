// Multivariable calculus and 3D:
//   /axes3 /vec3 /surface /plane /line3 /curve3 /solid      (3D, cabinet projection)
//   /contour /field /gradient /loop                         (2D pictures of 3D ideas)

import { parseExpression, parseNumber } from './expr';
import { readRange } from './range';
import { splitClauses, splitTopLevel, findTriples, numParam, hasWord, fmt } from './args';
import {
  svg, makeFrame, drawAxes, path, text, circle, COLORS, INK, clipToBox, contourSegments, segmentsPath,
  arrowHead, polyline, directionArrows, autoRange, type Frame,
} from './svg';
import { fail, firstLine, type ArgTools, type FigureCommand } from './types';
import { Scene3, cross, sub, add, scale, dot3, unit3, shade, VIEW, type V3 } from './three';
import { prettyLabel } from './graphs';

/** "x -2..2", "y from 0 to 3", "t 0..2pi" clauses. */
function rangeClause(clause: string, names: string[], tools: ArgTools): [string, [number, number]] | null {
  const m = clause.match(/^([a-zθ]+)\s*(?:from|in|:|=)?\s*(.+)$/i);
  if (!m || !names.includes(m[1].toLowerCase())) return null;
  const r = readRange(m[2], tools);
  return r ? [m[1].toLowerCase(), r] : null;
}

/** Axis lengths that fit some points, with a little room. */
function axisLengths(pts: V3[], min = 1.5): [V3, V3] {
  const len: V3 = [min, min, min], neg: V3 = [0, 0, 0];
  for (const p of pts) for (let i = 0; i < 3; i++) {
    len[i] = Math.max(len[i], p[i] * 1.25 + 0.3);
    neg[i] = Math.max(neg[i], -p[i] * 1.25 + 0.3);
  }
  return [len, neg];
}

// ---- 3D axes, vectors, points ----------------------------------------------------------

export const axes3: FigureCommand = {
  name: 'axes3',
  area: '3D and multivariable',
  example: '/axes3 P(1, 2, 3)\n  + Q(2, -1, 1)',
  description: 'Axes in space with labelled points; dashed lines show how to reach each point.',
  draw(args, tools) {
    const found = findTriples(args, tools);
    if (typeof found === 'string') return fail(found);
    const scene = new Scene3();
    const [len, neg] = axisLengths(found.map((f) => f.v), 2);
    scene.axes(len, neg);
    found.forEach(({ v, name }, i) => {
      const color = COLORS[i % COLORS.length];
      const [x, y, z] = v;
      const foot: V3 = [x, y, 0];
      const dash = { dashed: true, width: 1, opacity: 0.6, color };
      scene.line([[x, 0, 0], foot, [0, y, 0]], dash);
      scene.segment(foot, v, dash);
      scene.dot(v, { color });
      scene.text(v, `${name ?? ''}(${fmt(x)}, ${fmt(y)}, ${fmt(z)})`, { color, italic: true });
    });
    return { ok: true, svg: scene.render('Points in space'), notes: [] };
  },
};

export const vec3: FigureCommand = {
  name: 'vec3',
  area: '3D and multivariable',
  example: '/vec3 u=(2, 0, 0) v=(0, 2, 1)\n  + cross\n  + sum',
  description: 'Vectors in space from the origin. Options: cross (u × v), sum (u + v and the parallelogram).',
  draw(args, tools) {
    const found = findTriples(args, tools);
    if (typeof found === 'string') return fail(found);
    if (!found.length) return fail(`Give vectors like (1, 2, 3). Try: ${firstLine(vec3.example)}`);
    const vs = found.map((f, i) => ({ v: f.v, name: f.name ?? (found.length > 1 ? 'uvw'[i] ?? `v${i + 1}` : '') }));
    const extra: { v: V3; name: string; dashed?: boolean }[] = [];
    const scene = new Scene3();
    if (vs.length >= 2 && hasWord(args, 'cross', tools)) extra.push({ v: cross(vs[0].v, vs[1].v), name: `${vs[0].name || 'u'} × ${vs[1].name || 'v'}` });
    if (vs.length >= 2 && hasWord(args, 'sum', tools)) {
      const s = add(vs[0].v, vs[1].v);
      extra.push({ v: s, name: `${vs[0].name || 'u'} + ${vs[1].name || 'v'}` });
      scene.face([[0, 0, 0], vs[0].v, s, vs[1].v], { color: COLORS[0], fillOpacity: 0.1, width: 0 });
      scene.segment(vs[0].v, s, { dashed: true, width: 1, opacity: 0.6 });
      scene.segment(vs[1].v, s, { dashed: true, width: 1, opacity: 0.6 });
    }
    const all = [...vs, ...extra];
    const [len, neg] = axisLengths(all.map((a) => a.v));
    scene.axes(len, neg);
    all.forEach(({ v, name }, i) => {
      const color = COLORS[i % COLORS.length];
      scene.arrow([0, 0, 0], v, { color, width: 2.4 });
      scene.text(v, name || `(${v.map((c) => fmt(c)).join(', ')})`, { color, italic: true, size: 14 });
    });
    return { ok: true, svg: scene.render('Vectors in space'), notes: [] };
  },
};

// ---- Surfaces ----------------------------------------------------------------------------

export const surface: FigureCommand = {
  name: 'surface',
  area: '3D and multivariable',
  example: '/surface z = x^2 - y^2\n  + x -2..2\n  + y -2..2',
  description: 'The graph z = f(x, y), shaded so nearer parts hide farther ones. Optional ranges for x and y.',
  draw(args, tools) {
    let xr: [number, number] = [-2, 2], yr: [number, number] = [-2, 2];
    let src = '';
    for (const clause of splitClauses(args)) {
      const r = rangeClause(clause, ['x', 'y'], tools);
      if (r) { if (r[0] === 'x') xr = r[1]; else yr = r[1]; continue; }
      src = clause.replace(/^\s*(z|f\(x,\s*y\))\s*=\s*/i, '');
    }
    const parsed = parseExpression(src, { vars: ['x', 'y'], fixName: tools.fixName });
    if (!parsed.ok) return fail(`${parsed.message}. Try: ${firstLine(surface.example)}`);
    const f = (x: number, y: number) => parsed.fn(x, y);
    const N = 22;
    const grid: V3[][] = [];
    const zs: number[] = [];
    for (let i = 0; i <= N; i++) {
      grid.push([]);
      for (let j = 0; j <= N; j++) {
        const x = xr[0] + ((xr[1] - xr[0]) * i) / N, y = yr[0] + ((yr[1] - yr[0]) * j) / N;
        const z = f(x, y);
        zs.push(z);
        grid[i].push([x, y, z]);
      }
    }
    const zr = autoRange(zs) ?? [-1, 1];
    const clampZ = (p: V3): V3 => [p[0], p[1], Math.max(zr[0], Math.min(zr[1], Number.isFinite(p[2]) ? p[2] : 0))];
    // Squash tall surfaces so the picture keeps a sensible shape.
    const span = Math.max(xr[1] - xr[0], yr[1] - yr[0]);
    const zScale = Math.min(1, (span * 0.9) / ((zr[1] - zr[0]) || 1));
    const S = (p: V3): V3 => { const c = clampZ(p); return [c[0], c[1], c[2] * zScale]; };
    const scene = new Scene3();
    const L = Math.max(Math.abs(xr[0]), Math.abs(xr[1]), Math.abs(yr[0]), Math.abs(yr[1])) * 1.25;
    scene.axes([L, L, Math.max(1, zr[1] * zScale * 1.2)], [L * 0.5, L * 0.5, Math.max(0, -zr[0] * zScale * 1.1)]);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const q = [grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]].map(S);
      const normal = cross(sub(q[1], q[0]), sub(q[3], q[0]));
      scene.face(q, { fill: shade(normal), fillOpacity: 0.92, color: '#1e3a8a', width: 0.35, opacity: 0.55 });
    }
    const notes = zScale < 1 ? [`z drawn ${fmt(zScale, 2)}× to fit`] : [];
    return { ok: true, svg: scene.render(`Surface ${prettyLabel(src, 'z')}`), notes };
  },
};

export const plane3: FigureCommand = {
  name: 'plane',
  area: '3D and multivariable',
  example: '/plane 2x + 3y + 6z = 6',
  description: 'A plane in space: an equation (intercepts are shown when it cuts all three axes), or “through (1,0,0) normal (1,1,1)”.',
  draw(args, tools) {
    const input = args.replace(/[\n;]+/g, ' ');
    let n: V3, p0: V3;
    const triples = findTriples(input, tools);
    if (typeof triples === 'string') return fail(triples);
    if (/normal/i.test(input) && triples.length >= 2) {
      [p0, n] = [triples[0].v, triples[1].v];
    } else {
      const sides = input.split('=');
      if (sides.length !== 2) return fail(`Give the plane as an equation, e.g. ${plane3.example}`);
      const l = parseExpression(sides[0], { vars: ['x', 'y', 'z'], fixName: tools.fixName });
      const r = parseExpression(sides[1], { vars: ['x', 'y', 'z'], fixName: tools.fixName });
      if (!l.ok || !r.ok) return fail(`Couldn't read the equation. Try: ${plane3.example}`);
      const g = (x: number, y: number, z: number) => l.fn(x, y, z) - r.fn(x, y, z);
      const c = g(0, 0, 0);
      n = [g(1, 0, 0) - c, g(0, 1, 0) - c, g(0, 0, 1) - c];
      if (Math.abs(g(2, -3, 5) - (2 * n[0] - 3 * n[1] + 5 * n[2] + c)) > 1e-7) return fail('That equation is not linear, so it is not a plane.');
      const nn = dot3(n, n);
      if (nn < 1e-12) return fail('That equation has no x, y or z in it.');
      p0 = scale(n, -c / nn);
    }
    const scene = new Scene3();
    const d = dot3(n, p0);
    const intercepts = [0, 1, 2].map((i) => (Math.abs(n[i]) > 1e-12 ? d / n[i] : Infinity));
    let corners: V3[];
    if (intercepts.every((v) => Number.isFinite(v) && Math.abs(v) > 1e-9 && Math.abs(v) < 50)) {
      corners = intercepts.map((v, i) => { const p: V3 = [0, 0, 0]; p[i] = v; return p; });
      corners.forEach((p, i) => scene.text(p, `${'xyz'[i]} = ${fmt(intercepts[i])}`, { size: 12, dx: 6, dy: i === 2 ? -4 : 14 }));
      corners.forEach((p) => scene.dot(p, { r: 3 }));
    } else {
      // A square patch of the plane around its point nearest the origin.
      const u = unit3(Math.abs(n[0]) < 0.9 ? cross(n, [1, 0, 0]) : cross(n, [0, 1, 0]));
      const w = unit3(cross(n, u));
      const s = 1.6;
      corners = [[-s, -s], [s, -s], [s, s], [-s, s]].map(([a, b]) => add(p0, add(scale(u, a), scale(w, b))));
    }
    const [len, neg] = axisLengths(corners);
    scene.axes(len, neg);
    scene.face(corners, { color: COLORS[0], fillOpacity: 0.22, width: 1.6, opacity: 1 });
    return { ok: true, svg: scene.render('Plane'), notes: [] };
  },
};

export const line3: FigureCommand = {
  name: 'line3',
  area: '3D and multivariable',
  example: '/line3 (1, 0, 0) + t(1, 2, 2)',
  description: 'A line in space: point + t·direction, or “through (0,0,0) and (1,2,3)”.',
  draw(args, tools) {
    const input = args.replace(/[\n;]+/g, ' ');
    const t = findTriples(input, tools);
    if (typeof t === 'string') return fail(t);
    if (t.length < 2) return fail(`Give a point and a direction, e.g. ${line3.example}`);
    const p = t[0].v;
    const dir = /\band\b|through|thru/i.test(input) ? sub(t[1].v, t[0].v) : t[1].v;
    const a = add(p, scale(dir, -1.2)), b = add(p, scale(dir, 1.6));
    const scene = new Scene3();
    const [len, neg] = axisLengths([a, b, p]);
    scene.axes(len, neg);
    scene.segment(a, b, { color: COLORS[0], width: 2.4 });
    scene.arrow(p, add(p, scale(dir, 0.6)), { color: COLORS[1], width: 2 });
    scene.dot(p, { color: COLORS[0] });
    scene.text(p, `(${p.map((c) => fmt(c)).join(', ')})`, { italic: true, size: 12 });
    return { ok: true, svg: scene.render('Line in space'), notes: [] };
  },
};

export const curve3: FigureCommand = {
  name: 'curve3',
  area: '3D and multivariable',
  example: '/curve3 cos t, sin t, t/4\n  + t from 0 to 4pi',
  description: 'A space curve (x(t), y(t), z(t)) with direction arrows.',
  draw(args, tools) {
    let range: [number, number] = [0, 2 * Math.PI];
    let body = '';
    for (const clause of splitClauses(args)) {
      const r = rangeClause(clause, ['t'], tools);
      if (r) { range = r[1]; continue; }
      const m = clause.match(/^(.*?)\s+(?:for\s+)?t\s+(?:from|in)\s+(.+)$/i);
      if (m) { const rr = readRange(m[2], tools); if (rr) range = rr; body = m[1]; } else body = clause;
    }
    const parts = splitTopLevel(body.replace(/^\(|\)$/g, ''), ',');
    if (parts.length !== 3) return fail(`Give x(t), y(t), z(t) separated by commas. Try: ${firstLine(curve3.example)}`);
    const fs = parts.map((p) => parseExpression(p, { vars: ['t'], fixName: tools.fixName }));
    for (const f of fs) if (!f.ok) return fail(f.message);
    const fn = fs.map((f) => (f.ok ? f.fn : () => NaN));
    const pts: V3[] = [];
    for (let i = 0; i <= 400; i++) {
      const t = range[0] + ((range[1] - range[0]) * i) / 400;
      pts.push([fn[0](t), fn[1](t), fn[2](t)]);
    }
    const good = pts.filter((p) => p.every(Number.isFinite));
    const scene = new Scene3();
    const [len, neg] = axisLengths(good);
    scene.axes(len, neg);
    scene.line(good, { color: COLORS[0], width: 2.2 });
    for (const k of [0.25, 0.5, 0.75]) {
      const i = Math.floor(good.length * k);
      if (i > 0) scene.arrow(good[i - 1], good[i], { color: COLORS[0], width: 0.1 });
    }
    return { ok: true, svg: scene.render('Space curve'), notes: [] };
  },
};

// ---- Solids --------------------------------------------------------------------------------

const SOLIDS = ['cube', 'box', 'cuboid', 'prism', 'pyramid', 'tetrahedron', 'cylinder', 'cone', 'sphere', 'paraboloid'] as const;

/** Polyhedron edges: solid if a neighbouring face looks at us, dashed if both look away. */
function drawPolyhedron(scene: Scene3, verts: V3[], faces: number[][]) {
  const centre = scale(verts.reduce((s, v) => add(s, v), [0, 0, 0] as V3), 1 / verts.length);
  const facing = faces.map((f) => {
    let n = cross(sub(verts[f[1]], verts[f[0]]), sub(verts[f[2]], verts[f[0]]));
    if (dot3(n, sub(verts[f[0]], centre)) < 0) n = scale(n, -1);
    return dot3(n, VIEW) > 1e-9;
  });
  const edges = new Map<string, boolean>();
  faces.forEach((f, k) => f.forEach((a, i) => {
    const b = f[(i + 1) % f.length];
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    edges.set(key, (edges.get(key) ?? false) || facing[k]);
  }));
  faces.forEach((f, k) => { if (facing[k]) scene.face(f.map((i) => verts[i]), { color: COLORS[0], fillOpacity: 0.08, width: 0 }); });
  for (const [key, visible] of edges) {
    const [a, b] = key.split('-').map(Number);
    scene.segment(verts[a], verts[b], { width: visible ? 1.8 : 1.1, dashed: !visible, opacity: visible ? 1 : 0.6 });
  }
}

/** A horizontal circle, solid where `visible(φ)` and dashed elsewhere. */
function rim(scene: Scene3, r: number, z: number, visible: (phi: number) => boolean, color: string = INK) {
  const N = 96;
  let run: V3[] = [];
  let runVisible: boolean | null = null;
  const flush = () => { if (run.length > 1) scene.line(run, { width: runVisible ? 1.8 : 1.1, dashed: !runVisible, opacity: runVisible ? 1 : 0.6, color }); };
  for (let i = 0; i <= N; i++) {
    const phi = (2 * Math.PI * i) / N;
    const p: V3 = [r * Math.cos(phi), r * Math.sin(phi), z];
    const vis = visible(phi);
    if (runVisible !== null && vis !== runVisible) { run.push(p); flush(); run = [p]; } else run.push(p);
    runVisible = vis;
  }
  flush();
}

/** Angles φ where a function of φ changes sign (the silhouette). */
function signChanges(g: (phi: number) => number): number[] {
  const out: number[] = [];
  const N = 720;
  for (let i = 0; i < N; i++) {
    let a = (2 * Math.PI * i) / N, b = (2 * Math.PI * (i + 1)) / N;
    if ((g(a) > 0) === (g(b) > 0)) continue;
    for (let k = 0; k < 40; k++) { const m = (a + b) / 2; if ((g(m) > 0) === (g(a) > 0)) a = m; else b = m; }
    out.push((a + b) / 2);
  }
  return out;
}

export const solid: FigureCommand = {
  name: 'solid',
  area: '3D and multivariable',
  example: '/solid cylinder r=1 h=2',
  description: 'cube, box (a b c), prism (n), pyramid (n), tetrahedron, cylinder (r h), cone (r h), sphere (r), paraboloid. Hidden edges dashed.',
  draw(args, tools) {
    const input = `${tools.invokedAs} ${args}`.replace(/[\n;]+/g, ' ');
    const kind = SOLIDS.find((s) => hasWord(input, s, tools)) ?? (hasWord(input, 'cuboid') ? 'box' : null);
    if (!kind) return fail(`Which solid? cube, box, prism, pyramid, tetrahedron, cylinder, cone, sphere or paraboloid. Try: ${solid.example}`);
    const r = numParam(input, tools, 'r', 'radius') ?? 1;
    const h = numParam(input, tools, 'h', 'height') ?? 2;
    const n = Math.max(3, Math.min(12, numParam(input, tools, 'n', 'sides') ?? (kind === 'prism' ? 3 : 4)));
    const scene = new Scene3();
    const labels = !hasWord(input, 'nolabels');

    if (kind === 'cube' || kind === 'box' || kind === 'cuboid') {
      const s = numParam(input, tools, 's', 'side') ?? 2;
      const [a, b, c] = kind === 'cube' ? [s, s, s] : [numParam(input, tools, 'a') ?? 3, numParam(input, tools, 'b') ?? 2, numParam(input, tools, 'c') ?? 1.5];
      const v: V3[] = [[0, 0, 0], [a, 0, 0], [a, b, 0], [0, b, 0], [0, 0, c], [a, 0, c], [a, b, c], [0, b, c]];
      drawPolyhedron(scene, v, [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]);
      if (labels && kind !== 'cube') {
        scene.text([a / 2, b, 0], 'a', { italic: true, dy: 16 });
        scene.text([a, b / 2, 0], 'b', { italic: true, dy: 16 });
        scene.text([a, b, c / 2], 'c', { italic: true });
      }
    } else if (kind === 'prism' || kind === 'pyramid' || kind === 'tetrahedron') {
      const sides = kind === 'tetrahedron' ? 3 : n;
      const base: V3[] = Array.from({ length: sides }, (_, i) => {
        // Turn the base a little so no edge lines up with the view.
        const t = (2 * Math.PI * i) / sides + Math.PI / sides + (kind === 'tetrahedron' ? 0.45 : 0);
        return [r * Math.cos(t), r * Math.sin(t), 0];
      });
      if (kind === 'prism') {
        const top = base.map((p) => [p[0], p[1], h] as V3);
        const faces = [base.map((_, i) => i), top.map((_, i) => i + sides), ...base.map((_, i) => [i, (i + 1) % sides, sides + ((i + 1) % sides), sides + i])];
        drawPolyhedron(scene, [...base, ...top], faces);
      } else {
        const apexH = kind === 'tetrahedron' ? r * Math.sqrt(2) * 1.15 : h;
        const verts = [...base, [0, 0, apexH] as V3];
        const faces = [base.map((_, i) => i), ...base.map((_, i) => [i, (i + 1) % sides, sides])];
        drawPolyhedron(scene, verts, faces);
        if (labels && kind === 'pyramid') {
          scene.segment([0, 0, 0], [0, 0, apexH], { dashed: true, width: 1, opacity: 0.6 });
          scene.text([0, 0, apexH / 2], 'h', { italic: true });
        }
      }
    } else if (kind === 'cylinder') {
      const side = (phi: number) => Math.cos(phi) * VIEW[0] + Math.sin(phi) * VIEW[1];
      rim(scene, r, h, () => true);
      rim(scene, r, 0, (phi) => side(phi) > 0);
      for (const phi of signChanges(side)) scene.segment([r * Math.cos(phi), r * Math.sin(phi), 0], [r * Math.cos(phi), r * Math.sin(phi), h], { width: 1.8 });
      if (labels) {
        scene.segment([0, 0, 0], [0, r, 0], { dashed: true, width: 1, opacity: 0.7 });
        scene.text([0, r / 2, 0], 'r', { italic: true, dy: 14 });
        const phi = signChanges(side).find((p) => Math.sin(p) > 0) ?? 0;
        scene.text([r * Math.cos(phi), r * Math.sin(phi), h / 2], 'h', { italic: true });
      }
    } else if (kind === 'cone') {
      // The side's outward normal at angle φ is (h cos φ, h sin φ, r).
      const side = (phi: number) => h * Math.cos(phi) * VIEW[0] + h * Math.sin(phi) * VIEW[1] + r * VIEW[2];
      rim(scene, r, 0, (phi) => side(phi) > 0);
      for (const phi of signChanges(side)) scene.segment([r * Math.cos(phi), r * Math.sin(phi), 0], [0, 0, h], { width: 1.8 });
      if (labels) {
        scene.segment([0, 0, 0], [0, 0, h], { dashed: true, width: 1, opacity: 0.6 });
        scene.segment([0, 0, 0], [0, r, 0], { dashed: true, width: 1, opacity: 0.6 });
        scene.text([0, 0, h / 2], 'h', { italic: true });
        scene.text([0, r / 2, 0], 'r', { italic: true, dy: 14 });
      }
    } else if (kind === 'sphere') {
      // Outline: the great circle at right angles to the viewing direction.
      const d = unit3(VIEW);
      const u = unit3(cross(d, [0, 0, 1])), w = unit3(cross(d, u));
      const outline: V3[] = Array.from({ length: 97 }, (_, i) => { const t = (2 * Math.PI * i) / 96; return add(scale(u, r * Math.cos(t)), scale(w, r * Math.sin(t))); });
      scene.face(outline, { color: COLORS[0], fillOpacity: 0.08, width: 0 });
      scene.line(outline, { width: 1.8 });
      rim(scene, r, 0, (phi) => Math.cos(phi) * VIEW[0] + Math.sin(phi) * VIEW[1] > 0);
      if (labels) {
        scene.segment([0, 0, 0], [0, r, 0], { width: 1.2 });
        scene.dot([0, 0, 0], { r: 2.5 });
        scene.text([0, r / 2, 0], 'r', { italic: true, dy: -6 });
      }
    } else {
      // Paraboloid z = x² + y² up to height h, painted like a surface.
      const R = Math.sqrt(h);
      const N = 28, M = 10;
      for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
        const [t0, t1] = [(2 * Math.PI * i) / N, (2 * Math.PI * (i + 1)) / N];
        const [s0, s1] = [(R * j) / M, (R * (j + 1)) / M];
        const P = (s: number, t: number): V3 => [s * Math.cos(t), s * Math.sin(t), s * s];
        const q = [P(s0, t0), P(s1, t0), P(s1, t1), P(s0, t1)];
        scene.face(q, { fill: shade(cross(sub(q[1], q[0]), sub(q[3], q[0]))), fillOpacity: 0.85, color: '#1e3a8a', width: 0.3, opacity: 0.4 });
      }
      scene.axes([R * 1.4, R * 1.4, h * 1.25], [R * 0.6, R * 0.6, 0]);
      return { ok: true, svg: scene.render('Paraboloid'), notes: [] };
    }
    return { ok: true, svg: scene.render(`Solid: ${kind}`, 360, 320), notes: [] };
  },
};

// ---- 2D pictures of functions of two variables --------------------------------------------

function readXY(args: string, tools: ArgTools, defaultR = 3) {
  let x: [number, number] | null = null, y: [number, number] | null = null;
  const rest: string[] = [];
  for (const clause of splitClauses(args)) {
    const r = rangeClause(clause, ['x', 'y'], tools);
    if (r) { if (r[0] === 'x') x = r[1]; else y = r[1]; continue; }
    rest.push(clause);
  }
  const xr: [number, number] = x ?? y ?? [-defaultR, defaultR];
  const yr: [number, number] = y ?? xr;
  return { xr, yr, rest };
}

function levelColor(t: number): string {
  return `hsl(${Math.round(230 - 230 * t)}, 70%, 45%)`;
}

function contourPicture(f: (x: number, y: number) => number, xr: [number, number], yr: [number, number], levels: number[] | null, labelled = true) {
  const values: number[] = [];
  for (let i = 0; i <= 40; i++) for (let j = 0; j <= 40; j++) values.push(f(xr[0] + ((xr[1] - xr[0]) * i) / 40, yr[0] + ((yr[1] - yr[0]) * j) / 40));
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  const lv = levels ?? Array.from({ length: 8 }, (_, k) => {
    const v = finite[Math.floor(((k + 0.5) / 8) * finite.length)];
    return parseFloat(v.toPrecision(2));
  }).filter((v, i, a) => a.indexOf(v) === i);
  const frame = makeFrame(xr, yr, { equal: true, width: 420, height: 360 });
  const clip = clipToBox(frame);
  let inner = '';
  let labels = '';
  lv.forEach((level, k) => {
    const segs = contourSegments(f, xr, yr, level, 120, 120);
    const color = levelColor(lv.length > 1 ? k / (lv.length - 1) : 0.5);
    inner += path(segmentsPath(frame, segs), { stroke: color, 'stroke-width': 1.8 });
    if (labelled && segs.length) {
      const s = segs[Math.floor(segs.length * 0.37)];
      labels += text(frame.sx(s[0]), frame.sy(s[1]) - 3, fmt(level, 3), { 'font-size': 11, fill: color, 'font-weight': 600 });
    }
  });
  return { frame, body: clip.defs + drawAxes(frame) + `<g clip-path="${clip.attr}">${inner}</g>` + labels };
}

export const contour: FigureCommand = {
  name: 'contour',
  area: '3D and multivariable',
  example: '/contour x^2 + 2y^2\n  + levels 1, 2, 4, 8',
  description: 'Level curves f(x, y) = c, coloured from low (blue) to high (red). Choose levels or let the app pick.',
  draw(args, tools) {
    const { xr, yr, rest } = readXY(args, tools);
    let levels: number[] | null = null;
    let src = '';
    for (const clause of rest) {
      const m = clause.match(/^(?:levels?|c)\s*[=:]?\s*(.+)$/i);
      if (m) {
        levels = m[1].split(/[\s,]+/).filter(Boolean).map((v) => parseNumber(v, tools.fixName)).filter((v): v is number => v !== null);
        continue;
      }
      src = clause.replace(/^\s*(z|f\(x,\s*y\))\s*=\s*/i, '');
    }
    const parsed = parseExpression(src, { vars: ['x', 'y'], fixName: tools.fixName });
    if (!parsed.ok) return fail(`${parsed.message}. Try: ${firstLine(contour.example)}`);
    const pic = contourPicture((x, y) => parsed.fn(x, y), xr, yr, levels);
    return { ok: true, svg: svg(pic.frame.width, pic.frame.height, pic.body, 'Level curves'), notes: [] };
  },
};

function arrowsOnGrid(frame: Frame, F: (x: number, y: number) => [number, number], n = 15, color: string = COLORS[0]): string {
  const [xr, yr] = [frame.x, frame.y];
  const cell = Math.min((frame.box.right - frame.box.left) / n, (frame.box.bottom - frame.box.top) / n);
  const samples: { x: number; y: number; v: [number, number] }[] = [];
  let maxLen = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x = xr[0] + ((i + 0.5) * (xr[1] - xr[0])) / n, y = yr[0] + ((j + 0.5) * (yr[1] - yr[0])) / n;
    const v = F(x, y);
    if (!v.every(Number.isFinite)) continue;
    maxLen = Math.max(maxLen, Math.hypot(v[0], v[1]));
    samples.push({ x, y, v });
  }
  let out = '';
  for (const s of samples) {
    const len = Math.hypot(s.v[0], s.v[1]);
    if (len < 1e-12 || maxLen === 0) { out += circle(frame.sx(s.x), frame.sy(s.y), 1.5, { fill: color }); continue; }
    // Length grows with strength, but every arrow stays readable.
    const L = cell * 0.85 * (0.35 + 0.65 * Math.sqrt(len / maxLen));
    const ux = s.v[0] / len, uy = -s.v[1] / len;
    const [cx, cy] = [frame.sx(s.x), frame.sy(s.y)];
    const [x1, y1, x2, y2] = [cx - (ux * L) / 2, cy - (uy * L) / 2, cx + (ux * L) / 2, cy + (uy * L) / 2];
    out += path(`M${x1.toFixed(1)},${y1.toFixed(1)}L${x2.toFixed(1)},${y2.toFixed(1)}`, { stroke: color, 'stroke-width': 1.3 });
    out += arrowHead(x1, y1, x2, y2, color, 5);
  }
  return out;
}

/** "(-y, x)", "-y, x", "F = <-y, x>" → the two components. */
function readField(src: string, tools: ArgTools) {
  const inner = src.replace(/^\s*[A-Z](\(x,\s*y\))?\s*=\s*/, '').trim().replace(/^[(<⟨[]\s*|\s*[)>⟩\]]$/g, '');
  const parts = splitTopLevel(inner, ',');
  if (parts.length !== 2) return null;
  const P = parseExpression(parts[0], { vars: ['x', 'y'], fixName: tools.fixName });
  const Q = parseExpression(parts[1], { vars: ['x', 'y'], fixName: tools.fixName });
  if (!P.ok || !Q.ok) return null;
  return (x: number, y: number): [number, number] => [P.fn(x, y), Q.fn(x, y)];
}

export const field: FigureCommand = {
  name: 'field',
  area: '3D and multivariable',
  example: '/field (-y, x)\n  + x -2..2',
  description: 'A 2D vector field F = (P, Q) as arrows; longer arrows are stronger.',
  draw(args, tools) {
    const { xr, yr, rest } = readXY(args, tools, 2);
    const F = readField(rest.join(','), tools);
    if (!F) return fail(`Give the field as (P, Q), e.g. ${firstLine(field.example)}`);
    const frame = makeFrame(xr, yr, { equal: true, width: 400, height: 380 });
    const body = drawAxes(frame) + arrowsOnGrid(frame, F);
    return { ok: true, svg: svg(frame.width, frame.height, body, 'Vector field'), notes: [] };
  },
};

export const gradient: FigureCommand = {
  name: 'gradient',
  area: '3D and multivariable',
  example: '/gradient x^2 + 2y^2',
  description: 'Level curves of f with its gradient arrows (they cross the level curves at right angles).',
  draw(args, tools) {
    const { xr, yr, rest } = readXY(args, tools, 2);
    const src = rest.join(' ').replace(/^\s*(z|f\(x,\s*y\))\s*=\s*/i, '');
    const parsed = parseExpression(src, { vars: ['x', 'y'], fixName: tools.fixName });
    if (!parsed.ok) return fail(`${parsed.message}. Try: ${gradient.example}`);
    const f = (x: number, y: number) => parsed.fn(x, y);
    const h = 1e-5;
    const grad = (x: number, y: number): [number, number] => [(f(x + h, y) - f(x - h, y)) / (2 * h), (f(x, y + h) - f(x, y - h)) / (2 * h)];
    const pic = contourPicture(f, xr, yr, null, false);
    const body = pic.body + arrowsOnGrid(pic.frame, grad, 11, COLORS[1]);
    return { ok: true, svg: svg(pic.frame.width, pic.frame.height, body, 'Gradient field'), notes: [] };
  },
};

export const loop: FigureCommand = {
  name: 'loop',
  area: '3D and multivariable',
  example: '/loop blob ccw\n  + normals',
  description: 'A closed curve C around a region D with its orientation (Green’s theorem). Shapes: circle, ellipse, square, triangle, blob; options cw, normals, tangents.',
  draw(args, tools) {
    const input = args.replace(/[\n;]+/g, ' ');
    const shapes = ['circle', 'ellipse', 'square', 'rectangle', 'triangle', 'blob'];
    const shape = shapes.find((s) => hasWord(input, s, tools)) ?? 'blob';
    const cw = hasWord(input, 'cw') || hasWord(input, 'clockwise', tools);
    const N = 240;
    const at = (t: number): [number, number] => {
      switch (shape) {
        case 'circle': return [Math.cos(t), Math.sin(t)];
        case 'ellipse': return [1.5 * Math.cos(t), Math.sin(t)];
        case 'square':
        case 'rectangle': {
          const w = shape === 'square' ? 1 : 1.5;
          const c = Math.cos(t), s = Math.sin(t);
          const k = 1 / Math.max(Math.abs(c) / w, Math.abs(s));
          return [k * c, k * s];
        }
        case 'triangle': {
          const verts = [[-1.2, -0.8], [1.2, -0.8], [0, 1.2]];
          const u = ((t / (2 * Math.PI)) % 1 + 1) % 1 * 3;
          const i = Math.floor(u), f = u - i;
          const [a, b] = [verts[i % 3], verts[(i + 1) % 3]];
          return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
        }
        default: {
          const r = 1 + 0.22 * Math.sin(3 * t) + 0.12 * Math.cos(2 * t);
          return [1.2 * r * Math.cos(t), r * Math.sin(t)];
        }
      }
    };
    const pts: [number, number][] = Array.from({ length: N + 1 }, (_, i) => at(((cw ? -1 : 1) * 2 * Math.PI * i) / N));
    const frame = makeFrame([-2.2, 2.2], [-1.8, 1.8], { equal: true, width: 420, height: 340 });
    let body = drawAxes(frame, { grid: false });
    body += path(polyline(frame, pts, true), { fill: COLORS[0], 'fill-opacity': 0.12, stroke: COLORS[0], 'stroke-width': 2.2 });
    body += directionArrows(frame, pts, 4, COLORS[0]);
    const wantNormals = hasWord(input, 'normals') || hasWord(input, 'normal');
    const wantTangents = hasWord(input, 'tangents') || hasWord(input, 'tangent');
    for (let k = 0; k < 8 && (wantNormals || wantTangents); k++) {
      const i = Math.floor((N * (k + 0.5)) / 8);
      const [p, q] = [pts[i], pts[i + 1]];
      const [dx, dy] = [q[0] - p[0], q[1] - p[1]];
      const len = Math.hypot(dx, dy) || 1;
      const [tx, ty] = [dx / len, dy / len];
      // Outward normal: turn the tangent right for an anticlockwise curve.
      const [nx, ny] = cw ? [-ty, tx] : [ty, -tx];
      const L = 0.45;
      const draw = (vx: number, vy: number, color: string) => {
        const [x1, y1, x2, y2] = [frame.sx(p[0]), frame.sy(p[1]), frame.sx(p[0] + vx * L), frame.sy(p[1] + vy * L)];
        body += path(`M${x1},${y1}L${x2},${y2}`, { stroke: color, 'stroke-width': 1.5 }) + arrowHead(x1, y1, x2, y2, color, 7);
      };
      if (wantNormals) draw(nx, ny, COLORS[1]);
      if (wantTangents) draw(tx, ty, COLORS[2]);
    }
    body += text(frame.sx(0.05), frame.sy(-0.1), 'D', { 'font-size': 18, 'font-style': 'italic' });
    const lab = at(0.6);
    body += text(frame.sx(lab[0] * 1.12) + 6, frame.sy(lab[1] * 1.12), 'C', { 'font-size': 18, 'font-style': 'italic', fill: COLORS[0] });
    return { ok: true, svg: svg(frame.width, frame.height, body, 'Closed curve'), notes: [`${cw ? 'clockwise' : 'anticlockwise (positive)'} orientation`] };
  },
};

export const MULTIVAR_COMMANDS: FigureCommand[] = [axes3, vec3, surface, contour, field, gradient, plane3, line3, solid, curve3, loop];
