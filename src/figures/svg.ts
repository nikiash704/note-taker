// Tiny helpers for writing SVG by hand. Figures use currentColor for "ink",
// so they follow the page's light/dark theme, and a downloaded SVG is black.

export const INK = 'currentColor';
export const COLORS = ['#2563eb', '#dc2626', '#059669', '#d97706', '#7c3aed'];
export const FONT = "Georgia, 'Times New Roman', serif";

type Attrs = Record<string, string | number | undefined>;

function attrs(a: Attrs): string {
  return Object.entries(a)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => ` ${k}="${typeof v === 'number' ? round(v) : escapeXml(String(v))}"`)
    .join('');
}

export function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function escapeXml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

export const el = (tag: string, a: Attrs, children = '') =>
  children ? `<${tag}${attrs(a)}>${children}</${tag}>` : `<${tag}${attrs(a)}/>`;

export const line = (x1: number, y1: number, x2: number, y2: number, a: Attrs = {}) =>
  el('line', { x1, y1, x2, y2, stroke: INK, 'stroke-width': 1.5, ...a });

export const circle = (cx: number, cy: number, r: number, a: Attrs = {}) => el('circle', { cx, cy, r, ...a });

export const text = (x: number, y: number, content: string, a: Attrs = {}) =>
  el('text', { x, y, fill: INK, 'font-size': 14, ...a }, escapeXml(content));

export const path = (d: string, a: Attrs = {}) => el('path', { d, fill: 'none', stroke: INK, 'stroke-width': 1.5, ...a });

/** A line with an arrowhead at (x2, y2). */
export function arrow(x1: number, y1: number, x2: number, y2: number, a: Attrs & { head?: number } = {}): string {
  const { head = 9, ...rest } = a;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const color = (rest.stroke as string) ?? INK;
  const wing = (side: number) => [
    x2 - head * Math.cos(angle + side * 0.42),
    y2 - head * Math.sin(angle + side * 0.42),
  ];
  const [lx, ly] = wing(1);
  const [rx, ry] = wing(-1);
  // Stop the shaft short so it doesn't poke through the arrow tip.
  const sx = x2 - head * 0.6 * Math.cos(angle);
  const sy = y2 - head * 0.6 * Math.sin(angle);
  return (
    line(x1, y1, sx, sy, rest) +
    el('path', { d: `M${round(x2)},${round(y2)} L${round(lx)},${round(ly)} L${round(rx)},${round(ry)} Z`, fill: color, stroke: 'none' })
  );
}

/** Just the arrowhead at (x2, y2), pointing along the direction from (x1, y1). */
export function arrowHead(x1: number, y1: number, x2: number, y2: number, color: string = INK, size = 9): string {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const p = (side: number) => `${round(x2 - size * Math.cos(angle + side * 0.42))},${round(y2 - size * Math.sin(angle + side * 0.42))}`;
  return el('path', { d: `M${round(x2)},${round(y2)} L${p(1)} L${p(-1)} Z`, fill: color, stroke: 'none' });
}

/** Wrap drawing code in a standalone <svg>. */
export function svg(width: number, height: number, body: string, label: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${round(width)} ${round(height)}" width="${round(width)}" height="${round(height)}"` +
    ` font-family="${FONT}" role="img" aria-label="${escapeXml(label)}">` +
    body +
    '</svg>'
  );
}

// ---- Numbers on axes ---------------------------------------------------------------

/** A "nice" step (1, 2 or 5 × a power of ten) giving roughly `target` ticks. */
export function niceStep(span: number, target = 6): number {
  const raw = span / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  return (norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10) * mag;
}

export function ticks(lo: number, hi: number, step: number): number[] {
  const out: number[] = [];
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step) out.push(Math.abs(v) < step * 1e-6 ? 0 : v);
  return out;
}

export function formatNumber(v: number): string {
  if (Number.isInteger(v)) return String(v).replace('-', '−');
  return String(parseFloat(v.toPrecision(4))).replace('-', '−');
}

/** Label multiples of π nicely: π/2, π, 3π/2, −π … */
export function formatPi(v: number): string {
  const quarters = Math.round((v / Math.PI) * 4);
  if (quarters === 0) return '0';
  const sign = quarters < 0 ? '−' : '';
  let num = Math.abs(quarters);
  let den = 4;
  while (num % 2 === 0 && den > 1) { num /= 2; den /= 2; }
  const n = num === 1 ? '' : String(num);
  return den === 1 ? `${sign}${n}π` : `${sign}${n}π/${den}`;
}

/** Should this range be labelled in multiples of π? */
export function looksLikePi(lo: number, hi: number): boolean {
  const isPiish = (v: number) => v !== 0 && Math.abs((v / Math.PI) * 4 - Math.round((v / Math.PI) * 4)) < 1e-6;
  return (isPiish(lo) || lo === 0) && (isPiish(hi) || hi === 0) && (lo !== 0 || hi !== 0);
}

// ---- A 2D frame: maps math coordinates to SVG pixels ----------------------------------

export interface Frame {
  width: number;
  height: number;
  sx: (x: number) => number;
  sy: (y: number) => number;
  x: [number, number];
  y: [number, number];
  /** Pixel box of the plotting area. */
  box: { left: number; right: number; top: number; bottom: number };
}

export function makeFrame(
  x: [number, number], y: [number, number],
  opts: { width?: number; height?: number; equal?: boolean; pad?: number } = {},
): Frame {
  const pad = opts.pad ?? 28;
  let width = opts.width ?? 440;
  let height = opts.height ?? 270;
  if (opts.equal) {
    // Same scale on both axes (circles look round, right angles look right).
    const scale = Math.min((width - 2 * pad) / (x[1] - x[0]), (height - 2 * pad) / (y[1] - y[0]));
    width = (x[1] - x[0]) * scale + 2 * pad;
    height = (y[1] - y[0]) * scale + 2 * pad;
  }
  const box = { left: pad, right: width - pad, top: pad * 0.6, bottom: height - pad * 1.2 };
  const sx = (v: number) => box.left + ((v - x[0]) / (x[1] - x[0])) * (box.right - box.left);
  const sy = (v: number) => box.bottom - ((v - y[0]) / (y[1] - y[0])) * (box.bottom - box.top);
  return { width, height, sx, sy, x, y, box };
}

/** Grid, axes through the origin (or along the edge), ticks and labels. */
export function drawAxes(f: Frame, opts: { grid?: boolean; piX?: boolean; xLabel?: string; yLabel?: string } = {}): string {
  const { box, sx, sy } = f;
  let out = '';
  const xStep = opts.piX ? piStep(f.x[1] - f.x[0]) : niceStep(f.x[1] - f.x[0], (box.right - box.left) / 60);
  const yStep = niceStep(f.y[1] - f.y[0], Math.max(3, (box.bottom - box.top) / 45));
  const xTicks = ticks(f.x[0], f.x[1], xStep);
  const yTicks = ticks(f.y[0], f.y[1], yStep);

  if (opts.grid !== false) {
    const gridAttrs = { stroke: INK, 'stroke-opacity': 0.12, 'stroke-width': 1 };
    for (const t of xTicks) out += line(sx(t), box.top, sx(t), box.bottom, gridAttrs);
    for (const t of yTicks) out += line(box.left, sy(t), box.right, sy(t), gridAttrs);
  }

  // Axes sit at zero when zero is visible, otherwise along the bottom/left edge.
  const ax = f.y[0] <= 0 && f.y[1] >= 0 ? sy(0) : box.bottom;
  const ay = f.x[0] <= 0 && f.x[1] >= 0 ? sx(0) : box.left;
  out += arrow(box.left - 6, ax, box.right + 14, ax, { 'stroke-width': 1.3, head: 7 });
  out += arrow(ay, box.bottom + 6, ay, box.top - 10, { 'stroke-width': 1.3, head: 7 });
  out += text(box.right + 12, ax - 8, opts.xLabel ?? 'x', { 'font-style': 'italic', 'text-anchor': 'end' });
  out += text(ay + 8, box.top - 2, opts.yLabel ?? 'y', { 'font-style': 'italic' });

  const small = { 'font-size': 11, 'fill-opacity': 0.75 };
  for (const t of xTicks) {
    if (t === 0 && ay === sx(0)) continue;
    out += line(sx(t), ax - 3, sx(t), ax + 3, { 'stroke-width': 1 });
    out += text(sx(t), ax + 15, opts.piX ? formatPi(t) : formatNumber(t), { ...small, 'text-anchor': 'middle' });
  }
  for (const t of yTicks) {
    if (t === 0 && ax === sy(0)) continue;
    out += line(ay - 3, sy(t), ay + 3, sy(t), { 'stroke-width': 1 });
    out += text(ay - 6, sy(t) + 4, formatNumber(t), { ...small, 'text-anchor': 'end' });
  }
  if (ax === sy(0) && ay === sx(0)) out += text(ay - 6, ax + 14, '0', { ...small, 'text-anchor': 'end' });
  return out;
}

function piStep(span: number): number {
  const halfPis = span / (Math.PI / 2);
  return halfPis <= 8 ? Math.PI / 2 : halfPis <= 16 ? Math.PI : 2 * Math.PI;
}

// ---- Drawing helpers shared by many figures -----------------------------------------

export const DASHED = { 'stroke-dasharray': '5 4' } as const;
export const FAINT = { 'stroke-opacity': 0.45 } as const;

let clipCount = 0;

/** Keep drawing inside the plotting box. Returns the <defs> to add and the attribute to use. */
export function clipToBox(f: Frame): { defs: string; attr: string } {
  const id = `clip-${++clipCount}`;
  const { box } = f;
  return {
    defs: `<defs><clipPath id="${id}"><rect x="${round(box.left)}" y="${round(box.top)}" width="${round(box.right - box.left)}" height="${round(box.bottom - box.top)}"/></clipPath></defs>`,
    attr: `url(#${id})`,
  };
}

/** Path through y = fn(x), lifting the pen at gaps and asymptote jumps. */
export function functionPath(f: Frame, fn: (x: number) => number, x0 = f.x[0], x1 = f.x[1], samples = 480): string {
  const ySpan = f.y[1] - f.y[0];
  let d = '';
  let pen = false;
  let prev = NaN;
  for (let i = 0; i <= samples; i++) {
    const x = x0 + ((x1 - x0) * i) / samples;
    const y = fn(x);
    const jump = Number.isFinite(prev) && Math.abs(y - prev) > ySpan * 2;
    prev = y;
    if (!Number.isFinite(y) || jump) {
      pen = false;
      if (!Number.isFinite(y)) continue;
    }
    d += `${pen ? 'L' : 'M'}${round(f.sx(x))},${round(clampPx(f.sy(y)))}`;
    pen = true;
  }
  return d;
}

const clampPx = (v: number) => Math.max(-5000, Math.min(5000, v));

/** Path through points given in maths coordinates. */
export function polyline(f: Frame, pts: [number, number][], closed = false): string {
  let d = '';
  let pen = false;
  for (const [x, y] of pts) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) { pen = false; continue; }
    d += `${pen ? 'L' : 'M'}${round(clampPx(f.sx(x)))},${round(clampPx(f.sy(y)))}`;
    pen = true;
  }
  return closed && d ? d + 'Z' : d;
}

/** Pick a range that shows the interesting part of some values, ignoring spikes. */
export function autoRange(values: number[], includeZero = true): [number, number] | null {
  const ys = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (ys.length === 0) return null;
  let lo = ys[Math.floor(ys.length * 0.05)];
  let hi = ys[Math.ceil(ys.length * 0.95) - 1];
  const min = ys[0], max = ys[ys.length - 1];
  if (max - min <= 3 * (hi - lo) || hi === lo) { lo = min; hi = max; }
  if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
  const span = hi - lo;
  if (includeZero) {
    if (lo > 0 && lo < span * 0.5) lo = 0;
    if (hi < 0 && -hi < span * 0.5) hi = 0;
  }
  const pad = (hi - lo) * 0.08;
  return [lo - pad, hi + pad];
}

export type Segment = [number, number, number, number];

/** Where f(x, y) = level, as little line segments (marching squares). */
export function contourSegments(
  fn: (x: number, y: number) => number, xr: [number, number], yr: [number, number], level = 0, nx = 90, ny = 90,
): Segment[] {
  const dx = (xr[1] - xr[0]) / nx, dy = (yr[1] - yr[0]) / ny;
  const v: number[][] = [];
  for (let i = 0; i <= nx; i++) {
    v.push([]);
    for (let j = 0; j <= ny; j++) v[i].push(fn(xr[0] + i * dx, yr[0] + j * dy) - level);
  }
  const segs: Segment[] = [];
  const lerp = (a: number, b: number) => (Math.abs(a - b) < 1e-12 ? 0.5 : a / (a - b));
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      const a = v[i][j], b = v[i + 1][j], c = v[i + 1][j + 1], d = v[i][j + 1];
      if (![a, b, c, d].every(Number.isFinite)) continue;
      const x = xr[0] + i * dx, y = yr[0] + j * dy;
      // Crossing points on each edge of the cell.
      const pts: [number, number][] = [];
      if ((a > 0) !== (b > 0)) pts.push([x + lerp(a, b) * dx, y]);
      if ((b > 0) !== (c > 0)) pts.push([x + dx, y + lerp(b, c) * dy]);
      if ((c > 0) !== (d > 0)) pts.push([x + (1 - lerp(c, d)) * dx, y + dy]);
      if ((d > 0) !== (a > 0)) pts.push([x, y + (1 - lerp(d, a)) * dy]);
      // Skip cells straddling a pole (huge values of opposite sign).
      const big = Math.max(Math.abs(a), Math.abs(b), Math.abs(c), Math.abs(d));
      if (big > 1e6) continue;
      if (pts.length === 2) segs.push([...pts[0], ...pts[1]]);
      if (pts.length === 4) segs.push([...pts[0], ...pts[1]], [...pts[2], ...pts[3]]);
    }
  }
  return segs;
}

export function segmentsPath(f: Frame, segs: Segment[]): string {
  return segs.map(([x1, y1, x2, y2]) => `M${round(f.sx(x1))},${round(f.sy(y1))}L${round(f.sx(x2))},${round(f.sy(y2))}`).join('');
}

/** Shade wherever pred(x, y) holds, as thin horizontal strips (simple and robust). */
export function fillWhere(f: Frame, pred: (x: number, y: number) => boolean, step = 1.5): string {
  const { box } = f;
  const toX = (px: number) => f.x[0] + ((px - box.left) / (box.right - box.left)) * (f.x[1] - f.x[0]);
  const toY = (py: number) => f.y[0] + ((box.bottom - py) / (box.bottom - box.top)) * (f.y[1] - f.y[0]);
  let d = '';
  for (let py = box.top; py < box.bottom; py += step) {
    const y = toY(py + step / 2);
    let runStart: number | null = null;
    for (let px = box.left; px <= box.right + step; px += step) {
      const inside = px <= box.right && pred(toX(px + step / 2), y);
      if (inside && runStart === null) runStart = px;
      if (!inside && runStart !== null) {
        d += `M${round(runStart)},${round(py)}h${round(px - runStart)}v${round(step + 0.4)}h${round(runStart - px)}Z`;
        runStart = null;
      }
    }
  }
  return d;
}

/** A small colour key in the top-left corner of the plotting box. */
export function legend(f: Frame, items: { label: string; color: string; dashed?: boolean }[]): string {
  let out = '';
  items.forEach(({ label, color, dashed }, k) => {
    const y = f.box.top + 14 + k * 18;
    out += line(f.box.left + 4, y - 4, f.box.left + 18, y - 4, { stroke: color, 'stroke-width': 3, ...(dashed ? { 'stroke-dasharray': '4 3' } : {}) });
    out += text(f.box.left + 24, y, label, { 'font-style': 'italic', 'font-size': 13 });
  });
  return out;
}

/** A labelled point in maths coordinates. */
export function dot(f: Frame, x: number, y: number, opts: { label?: string; color?: string; open?: boolean; r?: number } = {}): string {
  const color = opts.color ?? INK;
  let out = circle(f.sx(x), f.sy(y), opts.r ?? 4, opts.open
    ? { stroke: color, 'stroke-width': 2, style: 'fill: var(--paper, #fff)' }
    : { fill: color });
  if (opts.label) out += text(f.sx(x) + 7, f.sy(y) - 7, opts.label, { 'font-size': 13, 'font-style': 'italic', fill: color });
  return out;
}

/** Arrowheads along a path of points, to show direction. */
export function directionArrows(f: Frame, pts: [number, number][], count = 3, color: string = INK): string {
  let out = '';
  const good = pts.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  for (let k = 1; k <= count; k++) {
    const i = Math.floor((good.length * k) / (count + 1));
    if (i < 1 || i >= good.length) continue;
    const [x0, y0] = good[i - 1], [x1, y1] = good[i];
    if (Math.hypot(f.sx(x1) - f.sx(x0), f.sy(y1) - f.sy(y0)) < 0.01) continue;
    out += arrowHead(f.sx(x0), f.sy(y0), f.sx(x1), f.sy(y1), color, 9);
  }
  return out;
}
