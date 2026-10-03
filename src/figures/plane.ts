// Coordinate-plane figures:
//   /axes                      empty grid
//   /axes -3..3                both axes from -3 to 3
//   /axes x -2..4 y -1..3      separate ranges
//   /axes A(1,2) B(3,-1)       labelled points
//   /vec (2,3)                 arrow from the origin
//   /vec u=(2,3) v=(-1,2)      several, named
//   /vec (1,1) -> (3,2)        arrow between two points

import { parseNumber } from './expr';
import { readRange } from './range';
import { svg, makeFrame, drawAxes, arrow, circle, line, text, COLORS, INK, formatNumber } from './svg';
import { fail, type FigureCommand, type FigureOutput } from './types';
import { findPairs } from './args';

// ---- Drawing ----------------------------------------------------------------------

interface Arrow { from: [number, number]; to: [number, number]; label: string }
interface Dot { at: [number, number]; label: string }

function autoRange(values: number[]): [number, number] {
  const lo = Math.min(0, ...values), hi = Math.max(0, ...values);
  let a = Math.floor(lo) - 1, b = Math.ceil(hi) + 1;
  const short = 4 - (b - a);
  if (short > 0) { a -= Math.floor(short / 2); b += Math.ceil(short / 2); }
  return [a, b];
}

function drawPlane(
  xr: [number, number] | null, yr: [number, number] | null, arrows: Arrow[], dots: Dot[], label: string,
): FigureOutput {
  const xs = [...arrows.flatMap((a) => [a.from[0], a.to[0]]), ...dots.map((d) => d.at[0])];
  const ys = [...arrows.flatMap((a) => [a.from[1], a.to[1]]), ...dots.map((d) => d.at[1])];
  const x = xr ?? autoRange(xs.length ? xs : [-4, 4]);
  const y = yr ?? autoRange(ys.length ? ys : [-3, 3]);
  const frame = makeFrame(x, y, { equal: true, width: 420, height: 340 });
  const { sx, sy } = frame;
  let body = drawAxes(frame);

  // A single vector from the origin gets dashed component lines.
  if (arrows.length === 1 && dots.length === 0 && arrows[0].from[0] === 0 && arrows[0].from[1] === 0) {
    const [tx, ty] = arrows[0].to;
    const dash = { 'stroke-dasharray': '4 4', 'stroke-width': 1, 'stroke-opacity': 0.6 };
    body += line(sx(tx), sy(ty), sx(tx), sy(0), dash) + line(sx(tx), sy(ty), sx(0), sy(ty), dash);
  }

  arrows.forEach((a, k) => {
    const color = COLORS[k % COLORS.length];
    const [x1, y1] = [sx(a.from[0]), sy(a.from[1])];
    const [x2, y2] = [sx(a.to[0]), sy(a.to[1])];
    body += arrow(x1, y1, x2, y2, { stroke: color, 'stroke-width': 2.4, head: 11 });
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const [ux, uy] = [(x2 - x1) / len, (y2 - y1) / len];
    body += text(x2 + ux * 10 + (ux >= 0 ? 2 : -2), y2 + uy * 10 + 5, a.label, {
      fill: color, 'font-style': 'italic', 'font-weight': 600, 'text-anchor': ux >= 0 ? 'start' : 'end',
    });
  });

  for (const d of dots) {
    body += circle(sx(d.at[0]), sy(d.at[1]), 4, { fill: INK });
    body += text(sx(d.at[0]) + 7, sy(d.at[1]) - 7, d.label, { 'font-style': 'italic' });
  }
  return { ok: true, svg: svg(frame.width, frame.height, body, label), notes: [] };
}

const pairLabel = (x: number, y: number) => `(${formatNumber(x)}, ${formatNumber(y)})`;

// ---- /vec -------------------------------------------------------------------------------

export const vec: FigureCommand = {
  name: 'vec',
  area: 'Linear algebra',
  example: '/vec (2,3)',
  description: 'Arrows on a grid: /vec u=(2,3) v=(-1,2), or /vec (1,1) -> (3,2).',
  draw(args, tools) {
    let found = findPairs(args, tools);
    if (typeof found === 'string') return fail(found);
    // No brackets at all: "/vec 2,3" or "/vec 2 3".
    if (found.length === 0) {
      const nums = args.trim().split(/[\s,;]+/).filter(Boolean).map((n) => parseNumber(n, tools.fixName));
      if (nums.length === 2 && nums.every((n) => n !== null)) {
        found = [{ name: null, x: nums[0]!, y: nums[1]!, start: 0, end: args.length }];
      } else {
        return fail(`Give the vector as (x, y), e.g. ${vec.example}`);
      }
    }

    const arrows: Arrow[] = [];
    for (let i = 0; i < found.length; i++) {
      const p = found[i];
      const next = found[i + 1];
      // "(1,1) -> (3,2)" or "(1,1) to (3,2)": an arrow between two points.
      const between = next ? args.slice(p.end, next.start) : '';
      if (next && /^\s*(->|→|to|-)\s*$/i.test(between)) {
        arrows.push({ from: [p.x, p.y], to: [next.x, next.y], label: next.name ?? p.name ?? '' });
        i++;
      } else {
        arrows.push({ from: [0, 0], to: [p.x, p.y], label: p.name ?? pairLabel(p.x, p.y) });
      }
    }
    return drawPlane(null, null, arrows, [], `Vectors ${arrows.map((a) => a.label).join(', ')}`);
  },
};

// ---- /axes ------------------------------------------------------------------------------

export const axes: FigureCommand = {
  name: 'axes',
  area: 'Graphs of functions',
  example: '/axes -3..3',
  description: 'A blank coordinate grid. Optional ranges (x -2..4 y -1..3) and points A(1,2).',
  draw(args, tools) {
    const found = findPairs(args, tools, '(⟨');
    if (typeof found === 'string') return fail(found);
    // Whatever isn't a point should be ranges.
    let rest = args;
    for (const p of [...found].reverse()) rest = rest.slice(0, p.start) + ' ' + rest.slice(p.end);
    rest = rest.trim();

    let xr: [number, number] | null = null;
    let yr: [number, number] | null = null;
    if (rest) {
      const named = rest.match(/^x\s*[:=]?\s*(.+?)\s*,?\s+y\s*[:=]?\s*(.+)$/i);
      const cross = rest.match(/^(\[[^\]]*\])\s*[x×]\s*(\[[^\]]*\])$/i);
      if (named || cross) {
        const m = (named ?? cross)!;
        xr = readRange(m[1], tools);
        yr = readRange(m[2], tools);
      } else {
        xr = yr = readRange(rest.replace(/^(x|y)\s*[:=]?\s*/i, ''), tools);
      }
      if (!xr || !yr) return fail(`Couldn't read the range “${rest}”. Try: /axes -3..3 or /axes x -2..4 y -1..3`);
    }

    const dots = found.map((p) => ({ at: [p.x, p.y] as [number, number], label: (p.name ?? '') + pairLabel(p.x, p.y) }));
    return drawPlane(xr, yr, [], dots, 'Coordinate axes');
  },
};
