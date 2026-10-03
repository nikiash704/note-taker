// Plane geometry helpers shared by /triangle, /circle, /polygon, /angle,
// /parallel and /construct. Everything is in maths coordinates (y up);
// GeoPicture fits the drawing into an SVG at the end.

import { svg, text, el, round, INK, COLORS, arrowHead } from './svg';

export type Pt = [number, number];

export const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
export const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
export const mul = (a: Pt, k: number): Pt => [a[0] * k, a[1] * k];
export const dot = (a: Pt, b: Pt) => a[0] * b[0] + a[1] * b[1];
export const cross = (a: Pt, b: Pt) => a[0] * b[1] - a[1] * b[0];
export const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const unit = (a: Pt): Pt => { const l = Math.hypot(a[0], a[1]) || 1; return [a[0] / l, a[1] / l]; };
export const perp = (a: Pt): Pt => [-a[1], a[0]];
export const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
export const polar = (r: number, deg: number, c: Pt = [0, 0]): Pt => [c[0] + r * Math.cos((deg * Math.PI) / 180), c[1] + r * Math.sin((deg * Math.PI) / 180)];

/** Where the lines p + t·d and q + s·e meet. */
export function intersect(p: Pt, d: Pt, q: Pt, e: Pt): Pt | null {
  const den = cross(d, e);
  if (Math.abs(den) < 1e-12) return null;
  const t = cross(sub(q, p), e) / den;
  return add(p, mul(d, t));
}

/** Foot of the perpendicular from p to the line AB. */
export function foot(p: Pt, a: Pt, b: Pt): Pt {
  const d = sub(b, a);
  return add(a, mul(d, dot(sub(p, a), d) / dot(d, d)));
}

export function circumcircle(a: Pt, b: Pt, c: Pt): { o: Pt; r: number } | null {
  const o = intersect(mid(a, b), perp(sub(b, a)), mid(b, c), perp(sub(c, b)));
  return o ? { o, r: dist(o, a) } : null;
}

export function incircle(a: Pt, b: Pt, c: Pt): { o: Pt; r: number } {
  const [la, lb, lc] = [dist(b, c), dist(a, c), dist(a, b)];
  const s = la + lb + lc;
  const o: Pt = [(la * a[0] + lb * b[0] + lc * c[0]) / s, (la * a[1] + lb * b[1] + lc * c[1]) / s];
  return { o, r: dist(o, foot(o, a, b)) };
}

export const centroid = (a: Pt, b: Pt, c: Pt): Pt => [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3];

export function orthocenter(a: Pt, b: Pt, c: Pt): Pt | null {
  return intersect(a, perp(sub(c, b)), b, perp(sub(c, a)));
}

interface Style { color?: string; width?: number; dashed?: boolean; fill?: string; fillOpacity?: number; opacity?: number }

type Op =
  | { k: 'poly'; pts: Pt[]; closed: boolean; s: Style }
  | { k: 'circle'; c: Pt; r: number; s: Style }
  | { k: 'label'; p: Pt; str: string; away?: Pt; size?: number; color?: string; italic?: boolean; offset?: number }
  | { k: 'dot'; p: Pt; r: number; color?: string }
  | { k: 'arc'; v: Pt; a: Pt; b: Pt; r: number; label?: string; color?: string; count?: number }
  | { k: 'right'; v: Pt; a: Pt; b: Pt; color?: string }
  | { k: 'ticks'; a: Pt; b: Pt; n: number; color?: string }
  | { k: 'arrow'; a: Pt; b: Pt; s: Style };

/** Collects geometry in maths coordinates and fits it into an SVG. */
export class GeoPicture {
  ops: Op[] = [];
  /** Points that must be visible (beyond what the drawing already covers). */
  extra: Pt[] = [];

  poly(pts: Pt[], s: Style = {}, closed = true) { this.ops.push({ k: 'poly', pts, closed, s }); }
  segment(a: Pt, b: Pt, s: Style = {}) { this.poly([a, b], s, false); }
  circle(c: Pt, r: number, s: Style = {}) { this.ops.push({ k: 'circle', c, r, s }); }
  label(p: Pt, str: string, opts: { away?: Pt; size?: number; color?: string; italic?: boolean; offset?: number } = {}) { this.ops.push({ k: 'label', p, str, ...opts }); }
  dot(p: Pt, r = 3.5, color?: string) { this.ops.push({ k: 'dot', p, r, color }); }
  /** Angle mark at v between rays va and vb (count = number of arcs, for equal angles). */
  angle(v: Pt, a: Pt, b: Pt, opts: { label?: string; color?: string; count?: number; r?: number } = {}) {
    this.ops.push({ k: 'arc', v, a, b, r: opts.r ?? 0, label: opts.label, color: opts.color, count: opts.count });
  }
  rightAngle(v: Pt, a: Pt, b: Pt, color?: string) { this.ops.push({ k: 'right', v, a, b, color }); }
  ticks(a: Pt, b: Pt, n = 1, color?: string) { this.ops.push({ k: 'ticks', a, b, n, color }); }
  arrow(a: Pt, b: Pt, s: Style = {}) { this.ops.push({ k: 'arrow', a, b, s }); }

  render(label: string, maxW = 380, maxH = 300): string {
    const pts: Pt[] = [...this.extra];
    for (const op of this.ops) {
      if (op.k === 'poly') pts.push(...op.pts);
      else if (op.k === 'circle') pts.push([op.c[0] - op.r, op.c[1] - op.r], [op.c[0] + op.r, op.c[1] + op.r]);
      else if (op.k === 'dot' || op.k === 'label') pts.push(op.p);
      else if (op.k === 'arrow') pts.push(op.a, op.b);
    }
    const xs = pts.map((p) => p[0]).filter(Number.isFinite), ys = pts.map((p) => p[1]).filter(Number.isFinite);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const pad = 34;
    const k = Math.min((maxW - 2 * pad) / (x1 - x0 || 1), (maxH - 2 * pad) / (y1 - y0 || 1));
    const W = (x1 - x0) * k + 2 * pad, H = (y1 - y0) * k + 2 * pad;
    const P = (p: Pt): Pt => [pad + (p[0] - x0) * k, H - pad - (p[1] - y0) * k];
    const D = (ps: Pt[], closed: boolean) => ps.map((p, i) => `${i ? 'L' : 'M'}${round(P(p)[0])},${round(P(p)[1])}`).join('') + (closed ? 'Z' : '');
    const strokeOf = (s: Style) => ({
      stroke: s.color ?? INK, 'stroke-width': s.width ?? 1.8, 'stroke-dasharray': s.dashed ? '5 4' : undefined, 'stroke-opacity': s.opacity,
      fill: s.fill ?? 'none', 'fill-opacity': s.fill ? s.fillOpacity ?? 0.15 : undefined, 'stroke-linejoin': 'round',
    });
    let fills = '', strokes = '', marks = '', labels = '';
    for (const op of this.ops) {
      switch (op.k) {
        case 'poly':
          if (op.s.fill) fills += el('path', { d: D(op.pts, op.closed), ...strokeOf(op.s), stroke: 'none' });
          strokes += el('path', { d: D(op.pts, op.closed), ...strokeOf({ ...op.s, fill: undefined }) });
          break;
        case 'circle': {
          const [cx, cy] = P(op.c);
          const attrs = strokeOf(op.s);
          if (op.s.fill) fills += el('circle', { cx, cy, r: op.r * k, ...attrs, stroke: 'none' });
          strokes += el('circle', { cx, cy, r: op.r * k, ...attrs, fill: 'none' });
          break;
        }
        case 'arrow': {
          const [a, b] = [P(op.a), P(op.b)];
          strokes += el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], ...strokeOf(op.s) }) + arrowHead(a[0], a[1], b[0], b[1], op.s.color ?? INK, 9);
          break;
        }
        case 'dot': {
          const [x, y] = P(op.p);
          marks += el('circle', { cx: x, cy: y, r: op.r, fill: op.color ?? INK });
          break;
        }
        case 'arc': {
          const v = P(op.v), a = P(op.a), b = P(op.b);
          const [ux, uy] = unit(sub(a, v)), [wx, wy] = unit(sub(b, v));
          const sweep = ux * wy - uy * wx > 0 ? 1 : 0;
          const big = 0;
          const base = op.r ? op.r * k : 22;
          const color = op.color ?? INK;
          for (let i = 0; i < (op.count ?? 1); i++) {
            const r = base + i * 5;
            marks += el('path', { d: `M${round(v[0] + ux * r)},${round(v[1] + uy * r)} A${round(r)},${round(r)} 0 ${big} ${sweep} ${round(v[0] + wx * r)},${round(v[1] + wy * r)}`, fill: 'none', stroke: color, 'stroke-width': 1.3 });
          }
          if (op.label) {
            const [bx, by] = unit([ux + wx, uy + wy]);
            labels += text(v[0] + bx * (base + 15), v[1] + by * (base + 15) + 5, op.label, { 'font-size': 13, 'text-anchor': 'middle', fill: color });
          }
          break;
        }
        case 'right': {
          const v = P(op.v), a = P(op.a), b = P(op.b);
          const [ux, uy] = unit(sub(a, v)), [wx, wy] = unit(sub(b, v));
          const s = 11;
          marks += el('path', { d: `M${round(v[0] + ux * s)},${round(v[1] + uy * s)} L${round(v[0] + (ux + wx) * s)},${round(v[1] + (uy + wy) * s)} L${round(v[0] + wx * s)},${round(v[1] + wy * s)}`, fill: 'none', stroke: op.color ?? INK, 'stroke-width': 1.2 });
          break;
        }
        case 'ticks': {
          const a = P(op.a), b = P(op.b);
          const m = mid(a, b);
          const [ux, uy] = unit(sub(b, a));
          const [nx, ny] = [-uy, ux];
          for (let i = 0; i < op.n; i++) {
            const off = (i - (op.n - 1) / 2) * 5;
            const c: Pt = [m[0] + ux * off, m[1] + uy * off];
            marks += el('line', { x1: c[0] - nx * 6, y1: c[1] - ny * 6, x2: c[0] + nx * 6, y2: c[1] + ny * 6, stroke: op.color ?? INK, 'stroke-width': 1.3 });
          }
          break;
        }
        case 'label': {
          const p = P(op.p);
          let [dx, dy] = [8, -8];
          if (op.away) {
            const [ux, uy] = unit(sub(p, P(op.away)));
            const off = op.offset ?? 15;
            [dx, dy] = [ux * off, uy * off + 5];
            labels += text(p[0] + dx, p[1] + dy, op.str, { 'font-size': op.size ?? 15, 'text-anchor': 'middle', 'font-style': op.italic === false ? undefined : 'italic', fill: op.color ?? INK });
          } else {
            labels += text(p[0] + dx, p[1] + dy, op.str, { 'font-size': op.size ?? 14, 'font-style': op.italic === false ? undefined : 'italic', fill: op.color ?? INK });
          }
          break;
        }
      }
    }
    return svg(W, H, fills + strokes + marks + labels, label);
  }
}

export { COLORS };
