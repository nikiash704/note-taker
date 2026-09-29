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
