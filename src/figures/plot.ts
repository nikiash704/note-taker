// /plot sin x from -pi to pi
// /plot x^2, 2x+1 from -3 to 3

import { parseExpression, type Fn } from './expr';
import { splitRange } from './range';
import { svg, makeFrame, drawAxes, path, text, el, COLORS, looksLikePi, round } from './svg';
import { fail, type FigureCommand } from './types';

const SAMPLES = 480;
let clipCount = 0;

export const plot: FigureCommand = {
  name: 'plot',
  example: '/plot sin x from -pi to pi',
  description: 'Graph one or more functions of x. Separate several with commas.',
  draw(args, tools) {
    if (!args.trim()) return fail('What should I plot? e.g. /plot x^2 from -2 to 2');
    const split = splitRange(args, tools);
    if (split.error) return fail(split.error);
    const notes = [...split.corrections];
    const [x0, x1] = split.range ?? [-5, 5];
    if (!split.range) notes.push('range −5 to 5 (add “from a to b” to change it)');

    // Several functions: "sin x, cos x" or "sin x and cos x".
    const sources = split.body.split(/\s*(?:,|;|\band\b)\s*/i).filter(Boolean);
    const fns: { fn: Fn; label: string }[] = [];
    for (const raw of sources) {
      const src = raw.replace(/^\s*(y|[a-z]\s*\(\s*[a-z]\s*\))\s*=\s*/i, '');
      let parsed = parseExpression(src, { vars: ['x'], fixName: tools.fixName });
      // Accept another single-letter variable, e.g. /plot t^2.
      const other = !parsed.ok && parsed.message.match(/Unknown name “([a-df-z])”/i);
      if (other) parsed = parseExpression(src, { vars: [other[1]], fixName: tools.fixName });
      if (!parsed.ok) return fail(`${parsed.message} in “${src}”. Try: ${plot.example}`);
      notes.push(...parsed.corrections);
      // Show the corrected spelling in the legend: "cso x" → "cos x".
      const fixed = parsed.corrections.reduce((s, c) => {
        const [from, to] = c.split(' → ');
        return s.replace(new RegExp(`\\b${from}\\b`, 'i'), to);
      }, src);
      fns.push({ fn: parsed.fn, label: prettyLabel(fixed) });
    }
    if (fns.length === 0) return fail(`What should I plot? e.g. ${plot.example}`);

    // Sample every function.
    const xs = Array.from({ length: SAMPLES + 1 }, (_, i) => x0 + ((x1 - x0) * i) / SAMPLES);
    const series = fns.map(({ fn }) => xs.map((x) => fn(x)));
    const yRange = chooseYRange(series.flat());
    if (!yRange) return fail(`The function isn't defined anywhere between ${round(x0)} and ${round(x1)}.`);

    const frame = makeFrame([x0, x1], yRange);
    let body = drawAxes(frame, { piX: looksLikePi(x0, x1) });
    const { box, sx, sy } = frame;
    const clipId = `plot-clip-${++clipCount}`;
    body += `<defs><clipPath id="${clipId}"><rect x="${box.left}" y="${box.top}" width="${round(box.right - box.left)}" height="${round(box.bottom - box.top)}"/></clipPath></defs>`;

    const ySpan = yRange[1] - yRange[0];
    series.forEach((ys, k) => {
      const color = COLORS[k % COLORS.length];
      let d = '';
      let penDown = false;
      ys.forEach((y, i) => {
        const jump = i > 0 && Number.isFinite(ys[i - 1]) && Math.abs(y - ys[i - 1]) > ySpan * 2;
        if (!Number.isFinite(y) || jump) { penDown = false; if (!Number.isFinite(y)) return; }
        const py = Math.max(-5000, Math.min(5000, sy(y)));
        d += `${penDown ? 'L' : 'M'}${round(sx(xs[i]))},${round(py)}`;
        penDown = true;
      });
      body += path(d, { stroke: color, 'stroke-width': 2.2, 'clip-path': `url(#${clipId})`, 'stroke-linejoin': 'round' });
    });

    // Legend in the top-left corner.
    fns.forEach(({ label }, k) => {
      const y = box.top + 14 + k * 18;
      body += el('rect', { x: box.left + 4, y: y - 6, width: 14, height: 3, fill: COLORS[k % COLORS.length], rx: 1 });
      body += text(box.left + 24, y, label, { 'font-style': 'italic', 'font-size': 13 });
    });

    return { ok: true, svg: svg(frame.width, frame.height, body, `Graph of ${fns.map((f) => f.label).join(', ')}`), notes };
  },
};

/** Pick a y-range that shows the interesting part, ignoring asymptote spikes. */
function chooseYRange(values: number[]): [number, number] | null {
  const ys = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (ys.length === 0) return null;
  let lo = ys[Math.floor(ys.length * 0.05)];
  let hi = ys[Math.ceil(ys.length * 0.95) - 1];
  const min = ys[0], max = ys[ys.length - 1];
  // Without spikes, show everything.
  if (max - min <= 3 * (hi - lo) || hi === lo) { lo = min; hi = max; }
  if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
  // Include the x-axis if it's close.
  const span = hi - lo;
  if (lo > 0 && lo < span * 0.5) lo = 0;
  if (hi < 0 && -hi < span * 0.5) hi = 0;
  const pad = (hi - lo) * 0.08;
  return [lo - pad, hi + pad];
}

function prettyLabel(src: string): string {
  const pretty = src
    .replace(/\bpi\b/g, 'π').replace(/\bsqrt\b/g, '√').replace(/\*\*/g, '^')
    .replace(/\^2\b/g, '²').replace(/\^3\b/g, '³').replace(/\*/g, '·').replace(/-/g, '−')
    .trim();
  return `y = ${pretty}`;
}
