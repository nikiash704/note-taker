// Euclidean geometry (and a little hyperbolic):
//   /circle O r=2 + chord AB + tangent at A + angle ACB + sector AB + diameter CD
//   /polygon 6 · /polygon square ABCD + diagonals + symmetries · /polygon (0,0) (4,0) (3,2)
//   /angle ABC = 40° · /parallel angle=60 + alternate
//   /construct A=(0,0) B=(4,0) C=(1,3) + triangle ABC + perp from C to AB + circle ABC
//   /poincare A(0.2, 0.3) B(-0.5, 0.1) C(0.1, -0.6)

import { parseNumber } from './expr';
import { splitClauses, findPairs, numParam, hasWord, fmt } from './args';
import { COLORS, INK } from './svg';
import { fail, firstLine, type FigureCommand } from './types';
import {
  GeoPicture, polar, add, sub, mul, mid, unit, perp, dist, foot, intersect, circumcircle, cross, type Pt,
} from './geo2d';
import { setPolygonDelegate } from './linalg';

const DEFAULT_ANGLES = [210, 330, 90, 30, 150, 270, 0, 180, 120, 60, 240, 300];

// ---- Circles ------------------------------------------------------------------------------------

export const circle: FigureCommand = {
  name: 'circle',
  area: 'Geometry',
  example: '/circle O r=2\n  + chord AB\n  + tangent at A\n  + angle ACB',
  description: 'A circle with named points on it. Lines: chord AB, diameter CD, radius OA, tangent at A, arc AB, sector AB (or sector 30..120), angle ACB, point A at 45.',
  draw(args, tools) {
    const clauses = splitClauses(args);
    const head = clauses[0] ?? '';
    const r = numParam(head, tools, 'r', 'radius') ?? 2;
    const centreName = head.replace(/\br\s*=\s*\S+/i, '').trim().match(/^([A-Z])\b/)?.[1] ?? 'O';
    const O: Pt = [0, 0];
    const at = new Map<string, number>();
    const place = (n: string) => { if (!at.has(n)) at.set(n, DEFAULT_ANGLES[at.size % DEFAULT_ANGLES.length]); return polar(r, at.get(n)!, O); };
    // Explicit positions first: "point A at 45", "A at 120".
    for (const c of clauses) {
      const m = c.match(/^(?:point\s+)?([A-Z])\s+at\s+(.+?)°?$/i);
      if (m) { const v = parseNumber(m[2], tools.fixName); if (v !== null) at.set(m[1], v); }
    }
    const g = new GeoPicture();
    g.circle(O, r, { width: 2 });
    g.dot(O);
    g.label(O, centreName, { away: [r, -r], offset: 12 });
    const used = new Set<string>();
    const show = (n: string) => { used.add(n); return place(n); };
    for (const clause of clauses.slice(1)) {
      const c = clause.trim();
      let m: RegExpMatchArray | null;
      if ((m = c.match(/^(?:point\s+)?([A-Z])\s+at\s+/i))) { show(m[1]); continue; }
      if ((m = c.match(/^chord\s+([A-Z])([A-Z])$/i))) { g.segment(show(m[1]), show(m[2]), { width: 1.8 }); continue; }
      if ((m = c.match(/^diameter\s+([A-Z])([A-Z])$/i))) {
        const a = show(m[1]);
        at.set(m[2], (at.get(m[1])! + 180) % 360);
        g.segment(a, show(m[2]), { width: 1.8 });
        continue;
      }
      if ((m = c.match(/^radius\s+(?:[A-Z](?=[A-Z]))?([A-Z])$/i))) {
        const a = show(m[1]);
        g.segment(O, a, { width: 1.5 });
        g.label(mid(O, a), 'r', { away: add(mid(O, a), perp(sub(a, O))), size: 13 });
        continue;
      }
      if ((m = c.match(/^tangents?\s+(?:at|to|through)?\s*([A-Z])$/i))) {
        const a = show(m[1]);
        const d = mul(unit(perp(sub(a, O))), r * 1.1);
        g.segment(sub(a, d), add(a, d), { color: COLORS[1], width: 1.8 });
        g.rightAngle(a, O, add(a, d), COLORS[1]);
        g.segment(O, a, { dashed: true, width: 1, opacity: 0.6 });
        continue;
      }
      if ((m = c.match(/^(arc|sector)\s+([A-Z])([A-Z])$/i)) || (m = c.match(/^(arc|sector)\s+(.+?)\s*(?:\.\.|to)\s*(.+?)°?$/i))) {
        let a0: number, a1: number;
        if (/^[A-Z]$/.test(m[2]) && /^[A-Z]$/.test(m[3])) { show(m[2]); show(m[3]); a0 = at.get(m[2])!; a1 = at.get(m[3])!; }
        else { a0 = parseNumber(m[2], tools.fixName) ?? 0; a1 = parseNumber(m[3], tools.fixName) ?? 90; }
        if (a1 <= a0) a1 += 360;
        const pts = Array.from({ length: 61 }, (_, i) => polar(r, a0 + ((a1 - a0) * i) / 60, O));
        if (m[1].toLowerCase() === 'sector') g.poly([O, ...pts], { color: COLORS[0], fill: COLORS[0], fillOpacity: 0.18, width: 1.6 });
        else g.poly(pts, { color: COLORS[0], width: 3.5 }, false);
        continue;
      }
      if ((m = c.match(/^(?:inscribed\s+|central\s+)?angle\s+([A-Z])([A-Z])([A-Z])$/i))) {
        const [p, v, q] = [m[1], m[2], m[3]];
        const V = v === centreName ? O : show(v);
        const P = p === centreName ? O : show(p), Q = q === centreName ? O : show(q);
        g.segment(V, P, { width: 1.5 });
        g.segment(V, Q, { width: 1.5 });
        g.angle(V, P, Q, { color: COLORS[3] });
        continue;
      }
      if ((m = c.match(/^(?:triangle|polygon)\s+([A-Z]{3,})$/i))) { g.poly([...m[1]].map(show), { width: 1.6, fill: COLORS[0], fillOpacity: 0.06 }); continue; }
      if ((m = c.match(/^(?:segment\s+)?([A-Z])([A-Z])$/))) { g.segment(m[1] === centreName ? O : show(m[1]), m[2] === centreName ? O : show(m[2]), { width: 1.5 }); continue; }
      return fail(`Didn't understand “${c}”. Try chord AB, tangent at A, angle ACB, sector AB, diameter CD`);
    }
    for (const n of used) { const p = place(n); g.dot(p, 3); g.label(p, n, { away: O, offset: 14 }); }
    return { ok: true, svg: g.render('Circle', 340, 300), notes: [] };
  },
};

// ---- Polygons ------------------------------------------------------------------------------------

const QUADS = ['square', 'rectangle', 'rhombus', 'parallelogram', 'trapezoid', 'trapezium', 'kite'] as const;
const NGON: Record<string, number> = { triangle: 3, pentagon: 5, hexagon: 6, heptagon: 7, octagon: 8, nonagon: 9, decagon: 10 };

export const polygon: FigureCommand = {
  name: 'polygon',
  area: 'Geometry',
  example: '/polygon square ABCD\n  + diagonals\n  + symmetries',
  description: 'Regular n-gons (/polygon 6), named quadrilaterals (square, rectangle, rhombus, parallelogram, trapezoid, kite) with equal-side ticks and right angles, or your own points. Options: diagonals, symmetries.',
  draw(args, tools) {
    const input = `${tools.invokedAs} ${args}`.replace(/[\n;]+/g, ' ');
    const pairs = findPairs(args, tools);
    if (typeof pairs === 'string') return fail(pairs);
    let pts: Pt[];
    let kind = QUADS.find((q) => hasWord(input, q, tools)) ?? null;
    if (kind === 'trapezium') kind = 'trapezoid';
    const nWord = Object.keys(NGON).find((w) => hasWord(input, w));
    const nNum = input.match(/(?:^|\s)(\d{1,2})(?:\s|$)/);
    let n = nWord ? NGON[nWord] : nNum ? Number(nNum[1]) : 0;
    let regular = false;
    if (pairs.length >= 3) {
      pts = pairs.map((p) => [p.x, p.y]);
      kind = null;
    } else if (kind) {
      pts = ({
        square: [[0, 0], [2, 0], [2, 2], [0, 2]],
        rectangle: [[0, 0], [3.2, 0], [3.2, 1.8], [0, 1.8]],
        rhombus: [[0, 0], [2, 0], [3, 1.732], [1, 1.732]],
        parallelogram: [[0, 0], [3, 0], [3.9, 1.6], [0.9, 1.6]],
        trapezoid: [[0, 0], [4, 0], [3, 1.8], [0.8, 1.8]],
        trapezium: [[0, 0], [4, 0], [3, 1.8], [0.8, 1.8]],
        kite: [[0, 0], [1.3, 1.8], [0, 2.7], [-1.3, 1.8]],
      } as Record<string, Pt[]>)[kind];
    } else {
      if (!n || n < 3 || n > 24) return fail(`Which polygon? e.g. ${firstLine(polygon.example)} or /polygon 6`);
      regular = true;
      const offset = -90 - 180 / n;
      pts = Array.from({ length: n }, (_, i) => polar(1.6, offset + (360 * i) / n));
    }
    n = pts.length;
    const nameTok = input.match(/\b([A-Z]{3,})\b/)?.[1];
    const names = nameTok && nameTok.length === n ? [...nameTok] : pairs.length >= 3 ? pairs.map((p, i) => p.name ?? String.fromCharCode(65 + i)) : Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
    const centre: Pt = [pts.reduce((s, p) => s + p[0], 0) / n, pts.reduce((s, p) => s + p[1], 0) / n];
    const g = new GeoPicture();
    g.poly(pts, { width: 2, fill: COLORS[0], fillOpacity: 0.08 });
    const side = (i: number): [Pt, Pt] => [pts[i], pts[(i + 1) % n]];
    // Equal sides get the same number of ticks; right angles get squares.
    const tickPattern: number[] | null = regular || kind === 'square' || kind === 'rhombus' ? Array(n).fill(1)
      : kind === 'rectangle' || kind === 'parallelogram' ? [1, 2, 1, 2] : kind === 'kite' ? [2, 1, 1, 2] : null;
    if (tickPattern) tickPattern.forEach((t, i) => g.ticks(...side(i), t));
    if (kind === 'square' || kind === 'rectangle') pts.forEach((p, i) => g.rightAngle(p, pts[(i + 1) % n], pts[(i + n - 1) % n]));
    if (hasWord(input, 'diagonals', tools) || hasWord(input, 'diagonal')) {
      for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) if (!(i === 0 && j === n - 1)) g.segment(pts[i], pts[j], { dashed: true, width: 1.2, color: COLORS[3] });
    }
    if (hasWord(input, 'symmetries', tools) || hasWord(input, 'symmetry', tools) || hasWord(input, 'axes')) {
      const axes: [Pt, Pt][] = [];
      const R = Math.max(...pts.map((p) => dist(p, centre))) * 1.25;
      const through = (dir: Pt) => axes.push([sub(centre, mul(unit(dir), R)), add(centre, mul(unit(dir), R))]);
      // A regular n-gon: axes through each vertex and through each side's midpoint.
      if (regular) for (let k = 0; k < n; k++) { through(sub(pts[k], centre)); through(sub(mid(...side(k)), centre)); }
      if (kind === 'square') { through(sub(pts[0], centre)); through(sub(pts[1], centre)); through([1, 0]); through([0, 1]); }
      if (kind === 'rectangle') { through([1, 0]); through([0, 1]); }
      if (kind === 'rhombus') { through(sub(pts[0], centre)); through(sub(pts[1], centre)); }
      if (kind === 'kite') through(sub(pts[0], pts[2]));
      const seen = new Set<string>();
      for (const [a, b] of axes) {
        const key = `${Math.round(Math.atan2(b[1] - a[1], b[0] - a[0]) * 1000) % 3142}`;
        if (seen.has(key)) continue;
        seen.add(key);
        g.segment(a, b, { dashed: true, color: COLORS[1], width: 1.2 });
      }
      g.dot(centre, 3, COLORS[1]);
    }
    pts.forEach((p, i) => g.label(p, names[i], { away: centre, offset: 15 }));
    const title = regular ? `Regular ${n}-gon` : kind ?? 'Polygon';
    return { ok: true, svg: g.render(title, 340, 280), notes: [] };
  },
};

setPolygonDelegate(polygon.draw);

// ---- Angles and parallel lines --------------------------------------------------------------------

export const angle: FigureCommand = {
  name: 'angle',
  area: 'Geometry',
  example: '/angle ABC = 40°',
  description: 'An angle between two rays with its measure (90 gets a square). Add “bisector” to halve it.',
  draw(args, tools) {
    const input = args.replace(/[\n;]+/g, ' ').trim();
    const m = input.match(/^(?:([A-Z])([A-Z])([A-Z]))?\s*=?\s*([^°]*?)\s*(°|deg|rad)?\s*(bisector)?\s*$/i);
    const names = m?.[1] ? [m[1], m[2], m[3]] : ['A', 'B', 'C'];
    const valueText = m?.[4]?.trim() ?? '';
    let deg = valueText ? parseNumber(valueText, tools.fixName) : 50;
    if (deg === null) {
      // A symbolic angle like α: draw a typical one and label it.
      deg = 50;
    } else if (m?.[5] === 'rad' || (/pi|π/.test(valueText) && m?.[5] !== '°')) deg = (deg * 180) / Math.PI;
    if (deg <= 0 || deg >= 360) return fail('Give an angle between 0° and 360°');
    const label = valueText && parseNumber(valueText, tools.fixName) === null ? valueText : `${fmt(deg, 4)}°`;
    const B: Pt = [0, 0], C: Pt = [3, 0], A = polar(3, deg);
    const g = new GeoPicture();
    g.segment(B, C, { width: 2 });
    g.segment(B, A, { width: 2 });
    if (Math.abs(deg - 90) < 1e-9) g.rightAngle(B, A, C, COLORS[0]);
    else g.angle(B, C, A, { label, color: COLORS[0] });
    if (Math.abs(deg - 90) < 1e-9) g.label(polar(0.75, 45), '90°', { color: COLORS[0], italic: false, size: 13 });
    if (hasWord(input, 'bisector', tools)) {
      const D = polar(3, deg / 2);
      g.segment(B, D, { dashed: true, color: COLORS[1], width: 1.4 });
      g.angle(B, C, D, { color: COLORS[1], r: 0.7, count: 1 });
      g.angle(B, D, A, { color: COLORS[1], r: 0.7, count: 1 });
    }
    g.dot(B, 3);
    const centre: Pt = mid(A, C);
    g.label(A, names[0], { away: B, offset: 14 });
    g.label(B, names[1], { away: centre, offset: 14 });
    g.label(C, names[2], { away: B, offset: 14 });
    return { ok: true, svg: g.render(`Angle ${names.join('')}`, 300, 240), notes: [] };
  },
};

/** The 8 angles where a transversal crosses two parallel lines (1–4 at the top line, 5–8 at the bottom). */
function parallelAngles(theta: number): number[] {
  const a = theta, b = 180 - theta;
  return [a, b, a, b, a, b, a, b];
}

const PAIRS: Record<string, [number, number][]> = {
  corresponding: [[1, 5], [2, 6], [3, 7], [4, 8]],
  alternate: [[3, 5], [4, 6]],
  'alternate exterior': [[1, 7], [2, 8]],
  'co-interior': [[3, 6], [4, 5]],
  cointerior: [[3, 6], [4, 5]],
  vertical: [[1, 3], [2, 4], [5, 7], [6, 8]],
};

export const parallel: FigureCommand = {
  name: 'parallel',
  area: 'Geometry',
  example: '/parallel angle=60\n  + alternate',
  description: 'Two parallel lines cut by a transversal, angles numbered 1–8. Highlight corresponding, alternate, co-interior or vertical pairs. With Compute on, all eight angles are suggested.',
  draw(args, tools) {
    const input = args.replace(/[\n;]+/g, ' ');
    const theta = numParam(input, tools, 'angle', 'theta', 'θ', 'a') ?? 60;
    if (theta <= 0 || theta >= 180) return fail('The angle must be between 0° and 180°');
    const answers = input.match(/=\s*1\s*:\s*.+$/)?.[0] ?? null;
    const values = answers ? answers.replace(/^=\s*/, '').split(',').map((s) => s.split(':')[1]?.trim()) : null;
    const h = 1.6;
    const u = polar(1, theta);
    const P: Pt = [0, 0], Q: Pt = [h / Math.tan((theta * Math.PI) / 180), h];
    const g = new GeoPicture();
    const L = 3;
    g.segment([-L, 0], [L + Q[0], 0], { width: 2 });
    g.segment([-L, h], [L + Q[0], h], { width: 2 });
    g.segment(sub(P, mul(u, 1.4)), add(Q, mul(u, 1.4)), { width: 2, color: COLORS[0] });
    // Parallel marks (arrowheads) on both lines.
    for (const y of [0, h]) g.poly([[-L + 0.5, y + 0.1], [-L + 0.7, y], [-L + 0.5, y - 0.1]], { width: 1.5 }, false);
    const pairWord = Object.keys(PAIRS).find((w) => new RegExp(w.replace(' ', '\\s+'), 'i').test(input));
    const highlighted = new Set((pairWord ? PAIRS[pairWord] : []).flat());
    // Sector directions: 1 above-right, 2 above-left, 3 below-left, 4 below-right (same for 5–8 at P).
    const dirs = (at: Pt): [Pt, Pt][] => [[add(at, [1, 0]), add(at, u)], [add(at, u), add(at, [-1, 0])], [add(at, [-1, 0]), sub(at, u)], [sub(at, u), add(at, [1, 0])]];
    const shown = parallelAngles(theta);
    [Q, P].forEach((at, row) => {
      dirs(at).forEach(([a, b], i) => {
        const k = row * 4 + i + 1;
        const color = highlighted.has(k) ? COLORS[1] : '#888';
        const text = values?.[k - 1] ?? (k === 1 && /angle\s*=/.test(input) ? `${fmt(shown[0])}°` : String(k));
        if (highlighted.has(k)) g.angle(at, a, b, { color, r: 0.32 });
        const bis = unit(add(unit(sub(a, at)), unit(sub(b, at))));
        g.label(add(at, mul(bis, 0.5)), text, { color: highlighted.has(k) ? COLORS[1] : INK, size: 13, italic: false, away: at, offset: 1 });
      });
    });
    const note = !pairWord ? [] : pairWord.startsWith('co') ? ['co-interior angles add up to 180°'] : [`${pairWord} angles are equal`];
    return { ok: true, svg: g.render('Parallel lines and a transversal', 380, 240), notes: note };
  },
  suggest(args, tools) {
    const input = args.replace(/[\n;]+/g, ' ');
    if (/=\s*1\s*:/.test(input)) return null;
    const theta = numParam(input, tools, 'angle', 'theta', 'θ', 'a');
    if (theta === null) return null;
    return [`= ${parallelAngles(theta).map((v, i) => `${i + 1}: ${fmt(v)}°`).join(', ')}`];
  },
};

// ---- Constructions ------------------------------------------------------------------------------

export const construct: FigureCommand = {
  name: 'construct',
  area: 'Geometry',
  example: '/construct A=(0,0) B=(4,0) C=(1,3)\n  + triangle ABC\n  + perp from C to AB as H\n  + midpoint M of BC\n  + circle ABC',
  description: 'Ruler-and-compass style: points A=(x,y); segment AB, line AB, ray AB, triangle/polygon ABC, circle A through B, circle A r=2, circle ABC, midpoint M of AB, perp from C to AB (as H), perp bisector AB, parallel through C to AB, P = AB ∩ CD, angle ABC.',
  draw(args, tools) {
    const pts = new Map<string, Pt>();
    const g = new GeoPicture();
    const marks: string[] = [];
    const get = (n: string): Pt => { const p = pts.get(n); if (!p) throw new Error(`Point ${n} isn't defined yet`); return p; };
    const longLine = (a: Pt, d: Pt, both = true): [Pt, Pt] => [both ? sub(a, mul(unit(d), 6)) : a, add(a, mul(unit(d), 6))];
    try {
      for (const raw of splitClauses(args)) {
        const c = raw.trim();
        let m: RegExpMatchArray | null;
        const found = findPairs(c, tools);
        if (typeof found !== 'string' && found.length && found.every((p) => p.name)) {
          for (const p of found) { pts.set(p.name!, [p.x, p.y]); marks.push(p.name!); }
          continue;
        }
        if ((m = c.match(/^(?:segment\s+)?([A-Z])([A-Z])$/i)) || (m = c.match(/^segment\s+([A-Z])\s*([A-Z])$/i))) { g.segment(get(m[1]), get(m[2]), { width: 1.8 }); continue; }
        if ((m = c.match(/^line\s+([A-Z])\s*([A-Z])$/i))) { const a = get(m[1]); g.segment(...longLine(a, sub(get(m[2]), a)), { width: 1.4 }); continue; }
        if ((m = c.match(/^ray\s+([A-Z])\s*([A-Z])$/i))) { const a = get(m[1]); g.segment(...longLine(a, sub(get(m[2]), a), false), { width: 1.4 }); continue; }
        if ((m = c.match(/^(?:triangle|polygon|quad(?:rilateral)?)\s+([A-Z]{3,})$/i))) { g.poly([...m[1]].map(get), { width: 2, fill: COLORS[0], fillOpacity: 0.07 }); continue; }
        if ((m = c.match(/^circle\s+([A-Z])\s+(?:through|thru)\s+([A-Z])$/i))) { const o = get(m[1]); g.circle(o, dist(o, get(m[2])), { color: COLORS[0], width: 1.5 }); continue; }
        if ((m = c.match(/^circle\s+([A-Z])\s+r\s*=\s*(.+)$/i))) { const r = parseNumber(m[2], tools.fixName); if (r === null) throw new Error(`Couldn't read the radius ${m[2]}`); g.circle(get(m[1]), r, { color: COLORS[0], width: 1.5 }); continue; }
        if ((m = c.match(/^circle\s+([A-Z])([A-Z])([A-Z])$/i))) {
          const cc = circumcircle(get(m[1]), get(m[2]), get(m[3]));
          if (!cc) throw new Error(`${m[1]}, ${m[2]}, ${m[3]} are on one line`);
          g.circle(cc.o, cc.r, { color: COLORS[0], width: 1.5 });
          continue;
        }
        if ((m = c.match(/^midpoint\s+([A-Z])\s+of\s+([A-Z])\s*([A-Z])$/i))) {
          const p = mid(get(m[2]), get(m[3]));
          pts.set(m[1], p); marks.push(m[1]);
          g.ticks(get(m[2]), p, 1, COLORS[2]); g.ticks(p, get(m[3]), 1, COLORS[2]);
          continue;
        }
        if ((m = c.match(/^perp(?:endicular)?\s+(?:from|through)\s+([A-Z])\s+to\s+([A-Z])\s*([A-Z])(?:\s+(?:as|at|called)\s+([A-Z]))?$/i))) {
          const p = get(m[1]), a = get(m[2]), b = get(m[3]);
          const h = foot(p, a, b);
          g.segment(p, h, { dashed: true, color: COLORS[1], width: 1.5 });
          g.rightAngle(h, p, dist(h, a) > 1e-9 ? a : b, COLORS[1]);
          const name = m[4] ?? 'H';
          pts.set(name, h); marks.push(name);
          continue;
        }
        if ((m = c.match(/^perp(?:endicular)?\s+bisector\s+(?:of\s+)?([A-Z])\s*([A-Z])$/i))) {
          const a = get(m[1]), b = get(m[2]);
          g.segment(...longLine(mid(a, b), perp(sub(b, a))), { color: COLORS[3], width: 1.3, dashed: true });
          g.ticks(a, mid(a, b), 1, COLORS[3]); g.ticks(mid(a, b), b, 1, COLORS[3]);
          continue;
        }
        if ((m = c.match(/^parallel\s+(?:through|thru)\s+([A-Z])\s+to\s+([A-Z])\s*([A-Z])$/i))) {
          g.segment(...longLine(get(m[1]), sub(get(m[3]), get(m[2]))), { color: COLORS[2], width: 1.4 });
          continue;
        }
        if ((m = c.match(/^([A-Z])\s*=\s*([A-Z])([A-Z])\s*(?:∩|n|cap|x|meets|and)\s*([A-Z])([A-Z])$/i)) || (m = c.match(/^intersect(?:ion)?\s+([A-Z])([A-Z])\s+(?:and\s+)?([A-Z])([A-Z])\s+as\s+([A-Z])$/i))) {
          const [name, a, b, p, q] = m.length === 6 && /^intersect/i.test(c) ? [m[5], m[1], m[2], m[3], m[4]] : [m[1], m[2], m[3], m[4], m[5]];
          const x = intersect(get(a), sub(get(b), get(a)), get(p), sub(get(q), get(p)));
          if (!x) throw new Error(`${a}${b} and ${p}${q} are parallel`);
          pts.set(name, x); marks.push(name);
          continue;
        }
        if ((m = c.match(/^(?:angle|mark)\s+([A-Z])([A-Z])([A-Z])(?:\s*=\s*(.+))?$/i))) {
          const v = get(m[2]), a = get(m[1]), b = get(m[3]);
          const right = Math.abs(cross(unit(sub(a, v)), unit(sub(b, v)))) > 0.9999 && Math.abs((sub(a, v)[0] * sub(b, v)[0] + sub(a, v)[1] * sub(b, v)[1])) < 1e-9;
          if (right) g.rightAngle(v, a, b, COLORS[3]); else g.angle(v, a, b, { color: COLORS[3], label: m[4] });
          continue;
        }
        if ((m = c.match(/^bisector\s+(?:of\s+)?([A-Z])([A-Z])([A-Z])$/i))) {
          const v = get(m[2]);
          const d = add(unit(sub(get(m[1]), v)), unit(sub(get(m[3]), v)));
          g.segment(...longLine(v, d, false), { color: COLORS[4], width: 1.3, dashed: true });
          continue;
        }
        throw new Error(`Didn't understand “${c}”`);
      }
    } catch (e) {
      return fail(`${(e as Error).message}. Try: ${firstLine(construct.example)}`);
    }
    if (!pts.size) return fail(`Start with some points, e.g. ${firstLine(construct.example)}`);
    const all = [...pts.values()];
    const centre: Pt = [all.reduce((s, p) => s + p[0], 0) / all.length, all.reduce((s, p) => s + p[1], 0) / all.length];
    // Keep the view near the points, even with long lines.
    const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]);
    const pad = Math.max(1, (Math.max(...xs) - Math.min(...xs) + Math.max(...ys) - Math.min(...ys)) * 0.25);
    g.ops = g.ops.map((op) => (op.k === 'poly' && op.pts.length === 2 && dist(op.pts[0], op.pts[1]) > 10 ? { ...op, pts: clipSegment(op.pts as [Pt, Pt], [Math.min(...xs) - pad, Math.max(...xs) + pad], [Math.min(...ys) - pad, Math.max(...ys) + pad]) } : op));
    for (const n of new Set(marks)) { g.dot(pts.get(n)!, 3.2); g.label(pts.get(n)!, n, { away: centre, offset: 14 }); }
    return { ok: true, svg: g.render('Construction', 380, 320), notes: [] };
  },
};

/** Cut a long line down to a box (Liang–Barsky). */
function clipSegment([a, b]: [Pt, Pt], xr: [number, number], yr: [number, number]): Pt[] {
  let t0 = 0, t1 = 1;
  const d = sub(b, a);
  const edges: [number, number][] = [[-d[0], a[0] - xr[0]], [d[0], xr[1] - a[0]], [-d[1], a[1] - yr[0]], [d[1], yr[1] - a[1]]];
  for (const [p, q] of edges) {
    if (Math.abs(p) < 1e-12) { if (q < 0) return [a, a]; continue; }
    const t = q / p;
    if (p < 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t);
  }
  return t0 > t1 ? [a, a] : [add(a, mul(d, t0)), add(a, mul(d, t1))];
}

// ---- The Poincaré disk ----------------------------------------------------------------------------

/** The hyperbolic line (geodesic) through p and q: an arc of a circle meeting the unit circle at right angles. */
function geodesic(p: Pt, q: Pt, full: boolean): Pt[] {
  // Solve 2c·p = |p|²+1, 2c·q = |q|²+1 for the centre c.
  const [a1, b1, r1] = [2 * p[0], 2 * p[1], p[0] ** 2 + p[1] ** 2 + 1];
  const [a2, b2, r2] = [2 * q[0], 2 * q[1], q[0] ** 2 + q[1] ** 2 + 1];
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1e-9) {
    // Through the centre: a diameter.
    const d = unit(Math.hypot(...p) > 1e-9 ? p : q);
    return full ? [mul(d, -1), d] : [p, q];
  }
  const o: Pt = [(r1 * b2 - r2 * b1) / det, (a1 * r2 - a2 * r1) / det];
  const R = Math.sqrt(o[0] ** 2 + o[1] ** 2 - 1);
  let t0 = Math.atan2(p[1] - o[1], p[0] - o[0]), t1 = Math.atan2(q[1] - o[1], q[0] - o[0]);
  if (full) {
    // From boundary to boundary: the arc inside the disk.
    const inside = (t: number) => Math.hypot(o[0] + R * Math.cos(t), o[1] + R * Math.sin(t)) <= 1 + 1e-9;
    const mid0 = (t0 + t1) / 2;
    let lo = mid0, hi = mid0;
    while (inside(lo - 0.01) && lo > mid0 - 2 * Math.PI) lo -= 0.01;
    while (inside(hi + 0.01) && hi < mid0 + 2 * Math.PI) hi += 0.01;
    if (!inside(mid0)) { const m2 = mid0 + Math.PI; lo = m2; hi = m2; while (inside(lo - 0.01)) lo -= 0.01; while (inside(hi + 0.01)) hi += 0.01; }
    [t0, t1] = [lo, hi];
  } else {
    // The short way round (the part inside the disk).
    if (Math.abs(t1 - t0) > Math.PI) t1 += t1 < t0 ? 2 * Math.PI : -2 * Math.PI;
  }
  return Array.from({ length: 81 }, (_, i) => [o[0] + R * Math.cos(t0 + ((t1 - t0) * i) / 80), o[1] + R * Math.sin(t0 + ((t1 - t0) * i) / 80)] as Pt);
}

export const poincare: FigureCommand = {
  name: 'poincare',
  area: 'Geometry',
  example: '/poincare A(0.2, 0.5) B(-0.6, 0.1) C(0.3, -0.5)\n  + triangle\n  + line AB',
  description: 'The Poincaré disk: points inside the unit disk and hyperbolic lines (arcs meeting the boundary at right angles). “segment AB”, “line AB” (to the boundary), “triangle”.',
  draw(args, tools) {
    const clauses = splitClauses(args);
    const found = findPairs(clauses.join(' '), tools);
    if (typeof found === 'string') return fail(found);
    const pts = new Map<string, Pt>();
    found.forEach((p, i) => pts.set(p.name ?? String.fromCharCode(65 + i), [p.x, p.y]));
    for (const [n, p] of pts) if (Math.hypot(...p) >= 1) return fail(`${n} must be inside the unit disk`);
    const g = new GeoPicture();
    g.circle([0, 0], 1, { width: 2, fill: COLORS[0], fillOpacity: 0.05 });
    const names = [...pts.keys()];
    let drew = false;
    for (const c of clauses) {
      const m = c.match(/^(segment|line|geodesic)\s+([A-Z])\s*([A-Z])$/i);
      if (m) {
        const [p, q] = [pts.get(m[2]), pts.get(m[3])];
        if (!p || !q) return fail(`Define ${m[2]} and ${m[3]} first`);
        g.poly(geodesic(p, q, m[1].toLowerCase() !== 'segment'), { color: m[1].toLowerCase() === 'segment' ? COLORS[0] : COLORS[1], width: 2 }, false);
        drew = true;
      } else if (/^triangle/i.test(c.trim())) {
        for (let i = 0; i < 3 && names.length >= 3; i++) g.poly(geodesic(pts.get(names[i])!, pts.get(names[(i + 1) % 3])!, false), { color: COLORS[0], width: 2 }, false);
        drew = true;
      }
    }
    if (!drew && names.length >= 2) {
      for (let i = 0; i + 1 < names.length; i++) g.poly(geodesic(pts.get(names[i])!, pts.get(names[i + 1])!, false), { color: COLORS[0], width: 2 }, false);
    }
    for (const [n, p] of pts) { g.dot(p, 3.5); g.label(p, n); }
    g.extra.push([-1.05, -1.05], [1.05, 1.05]);
    return { ok: true, svg: g.render('Poincaré disk', 320, 320), notes: [] };
  },
};

export const GEOMETRY_COMMANDS: FigureCommand[] = [circle, polygon, angle, parallel, construct, poincare];
