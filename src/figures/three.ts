// A deliberately simple 3D drawing kit: the "cabinet" projection used in
// textbooks. The x-axis points down-left (drawn at half length), y to the
// right and z up. No camera, no WebGL: a point (x, y, z) is drawn at
//   right = y − 0.433·x,   up = z − 0.25·x.
// Things facing the viewer have a normal with a positive dot product with
// VIEW below; hidden edges are drawn dashed, surfaces are painted back to front.

import { svg, el, text, round, arrowHead, INK } from './svg';

export type V3 = [number, number, number];

export const VIEW: V3 = [1, 0.433, 0.25];
const K_COS = 0.433, K_SIN = 0.25;

export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot3 = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm3 = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const unit3 = (a: V3): V3 => scale(a, 1 / (norm3(a) || 1));

/** How far towards the viewer a point is (bigger = nearer). */
export const depth = (p: V3) => dot3(p, VIEW);

const project = (p: V3): [number, number] => [p[1] - K_COS * p[0], p[2] - K_SIN * p[0]];

interface Style { color?: string; width?: number; dashed?: boolean; opacity?: number; fill?: string; fillOpacity?: number }

type Item =
  | { k: 'line'; pts: V3[]; s: Style; closed?: boolean }
  | { k: 'face'; pts: V3[]; s: Style; z: number }
  | { k: 'text'; p: V3; str: string; s: Style & { size?: number; anchor?: string; italic?: boolean; dx?: number; dy?: number } }
  | { k: 'dot'; p: V3; s: Style & { r?: number } }
  | { k: 'arrow'; a: V3; b: V3; s: Style };

/** Collects 3D drawing commands, then fits them into an SVG. */
export class Scene3 {
  private items: Item[] = [];

  line(pts: V3[], s: Style = {}, closed = false) { this.items.push({ k: 'line', pts, s, closed }); }
  segment(a: V3, b: V3, s: Style = {}) { this.line([a, b], s); }
  /** A filled polygon; faces are painted far-to-near. */
  face(pts: V3[], s: Style = {}) {
    const z = pts.reduce((sum, p) => sum + depth(p), 0) / pts.length;
    this.items.push({ k: 'face', pts, s, z });
  }
  text(p: V3, str: string, s: Style & { size?: number; anchor?: string; italic?: boolean; dx?: number; dy?: number } = {}) { this.items.push({ k: 'text', p, str, s }); }
  dot(p: V3, s: Style & { r?: number } = {}) { this.items.push({ k: 'dot', p, s }); }
  arrow(a: V3, b: V3, s: Style = {}) { this.items.push({ k: 'arrow', a, b, s }); }

  /** Arrowed axes from −neg to +len, labelled x, y, z. */
  axes(len: V3 = [2, 2, 2], neg: V3 = [0, 0, 0], labels: [string, string, string] = ['x', 'y', 'z']) {
    const ends: V3[] = [[len[0], 0, 0], [0, len[1], 0], [0, 0, len[2]]];
    const starts: V3[] = [[-neg[0], 0, 0], [0, -neg[1], 0], [0, 0, -neg[2]]];
    ends.forEach((e, i) => {
      this.arrow(starts[i], e, { width: 1.3 });
      this.text(e, labels[i], { italic: true, size: 15, dx: i === 0 ? -10 : 8, dy: i === 2 ? -6 : 14 });
    });
  }

  render(label: string, maxW = 440, maxH = 360): string {
    const pts: [number, number][] = [];
    for (const it of this.items) {
      if (it.k === 'line' || it.k === 'face') it.pts.forEach((p) => pts.push(project(p)));
      else if (it.k === 'arrow') pts.push(project(it.a), project(it.b));
      else pts.push(project(it.p));
    }
    const xs = pts.map((p) => p[0]).filter(Number.isFinite), ys = pts.map((p) => p[1]).filter(Number.isFinite);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const pad = 30;
    const k = Math.min((maxW - 2 * pad) / (x1 - x0 || 1), (maxH - 2 * pad) / (y1 - y0 || 1));
    const W = (x1 - x0) * k + 2 * pad, H = (y1 - y0) * k + 2 * pad;
    const P = (p: V3): [number, number] => { const [u, v] = project(p); return [pad + (u - x0) * k, H - pad - (v - y0) * k]; };

    let out = '';
    // Faces first (back to front), then lines, arrows, dots and text on top.
    const faces = this.items.filter((i): i is Extract<Item, { k: 'face' }> => i.k === 'face').sort((a, b) => a.z - b.z);
    for (const f of faces) {
      const d = f.pts.map((p, i) => `${i ? 'L' : 'M'}${round(P(p)[0])},${round(P(p)[1])}`).join('') + 'Z';
      out += el('path', {
        d, fill: f.s.fill ?? f.s.color ?? INK, 'fill-opacity': f.s.fillOpacity ?? 0.25,
        stroke: f.s.color ?? 'none', 'stroke-width': f.s.width ?? 0.4, 'stroke-opacity': f.s.opacity ?? 0.5, 'stroke-linejoin': 'round',
      });
    }
    for (const it of this.items) {
      if (it.k === 'line') {
        const d = it.pts.map((p, i) => `${i ? 'L' : 'M'}${round(P(p)[0])},${round(P(p)[1])}`).join('') + (it.closed ? 'Z' : '');
        out += el('path', {
          d, fill: 'none', stroke: it.s.color ?? INK, 'stroke-width': it.s.width ?? 1.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round',
          'stroke-opacity': it.s.opacity, 'stroke-dasharray': it.s.dashed ? '5 4' : undefined,
        });
      } else if (it.k === 'arrow') {
        const [a, b] = [P(it.a), P(it.b)];
        const color = it.s.color ?? INK;
        out += el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: color, 'stroke-width': it.s.width ?? 1.6, 'stroke-dasharray': it.s.dashed ? '5 4' : undefined });
        out += arrowHead(a[0], a[1], b[0], b[1], color, 9);
      }
    }
    for (const it of this.items) {
      if (it.k === 'dot') {
        const [x, y] = P(it.p);
        out += el('circle', { cx: x, cy: y, r: it.s.r ?? 3.5, fill: it.s.color ?? INK });
      } else if (it.k === 'text') {
        const [x, y] = P(it.p);
        out += text(x + (it.s.dx ?? 6), y + (it.s.dy ?? -6), it.str, {
          'font-size': it.s.size ?? 13, 'text-anchor': it.s.anchor, 'font-style': it.s.italic ? 'italic' : undefined, fill: it.s.color ?? INK,
        });
      }
    }
    return svg(W, H, out, label);
  }
}

/** A light-blue shade for a surface patch, darker when it faces away from the light. */
export function shade(normal: V3, hue = 215): string {
  const n = unit3(normal);
  const light = unit3([0.6, 0.3, 1]);
  const lambert = Math.abs(dot3(n, light));
  return `hsl(${hue}, 65%, ${round(48 + 34 * lambert)}%)`;
}
