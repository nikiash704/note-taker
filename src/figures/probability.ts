// Probability and statistics:
//   /dist normal 0 1 (+ shade -1..1) · t df=5 · chisq k=3 · exponential λ=2 · uniform 0 1
//   /dist binomial n=10 p=0.3 (+ shade 3..5) · poisson λ=3 · geometric p=0.3
//   /cdf … · /hist data · /boxplot data · /scatter points (+ fit)
// The probability of the shaded part is an answer: suggested with Compute on, shown once written.

import { parseNumber } from './expr';
import { readRange } from './range';
import { splitClauses, findPairs, numberList, param, fmt } from './args';
import {
  svg, makeFrame, drawAxes, path, line, text, el, COLORS, clipToBox, polyline, legend, dot, DASHED,
  functionPath, autoRange, niceStep, ticks, formatNumber, type Frame,
} from './svg';
import { fail, firstLine, type ArgTools, type FigureCommand, type FigureOutput } from './types';

// ---- Special functions ------------------------------------------------------------------------

/** log Γ(x) (Lanczos). */
function lgamma(x: number): number {
  const g = 7;
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61503916999185,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

interface Dist {
  name: string;
  discrete: boolean;
  /** Density or probability mass. */
  f: (x: number) => number;
  range: [number, number];
}

const FAMILIES = ['normal', 't', 'chisq', 'exponential', 'uniform', 'binomial', 'poisson', 'geometric'] as const;
const FAMILY_WORDS: Record<string, (typeof FAMILIES)[number]> = {
  normal: 'normal', gaussian: 'normal', bell: 'normal', n: 'normal', z: 'normal', standard: 'normal',
  t: 't', tdist: 't', student: 't',
  chisq: 'chisq', chi2: 'chisq', chisquare: 'chisq', 'chi-square': 'chisq', 'χ2': 'chisq', 'χ²': 'chisq',
  exponential: 'exponential', exp: 'exponential', expo: 'exponential',
  uniform: 'uniform', unif: 'uniform',
  binomial: 'binomial', binom: 'binomial', bin: 'binomial', b: 'binomial',
  poisson: 'poisson', pois: 'poisson',
  geometric: 'geometric', geom: 'geometric',
};

/** Read "normal 0 1", "N(0, 1)", "binomial n=10 p=0.3", "poisson λ=3"… */
function readDist(text: string, tools: ArgTools): Dist | string {
  let t = text.replace(/\n/g, ' ').trim();
  const call = t.match(/^([A-Za-zχ²2-]+)\s*\(([^)]*)\)\s*(.*)$/);
  if (call) t = `${call[1]} ${call[2].replace(/,/g, ' ')} ${call[3]}`;
  const first = t.split(/\s+/)[0]?.toLowerCase() ?? '';
  let family = FAMILY_WORDS[tools.invokedAs] && tools.invokedAs !== 'dist' && tools.invokedAs !== 'pdf' && tools.invokedAs !== 'pmf' && tools.invokedAs !== 'density' && tools.invokedAs !== 'distribution'
    ? FAMILY_WORDS[tools.invokedAs] : FAMILY_WORDS[first] ?? (first.length >= 4 ? (FAMILY_WORDS[tools.fixWord(first, Object.keys(FAMILY_WORDS)) ?? ''] ?? null) : null);
  if (!family && tools.invokedAs === 'normal') family = 'normal';
  if (!family) return `Which distribution? normal, t, chisq, exponential, uniform, binomial, poisson or geometric`;
  if (FAMILY_WORDS[first]) t = t.slice(first.length).trim();
  const nums = t.split(/\s+/).filter((w) => !/=/.test(w)).map((w) => parseNumber(w, tools.fixName)).filter((v): v is number => v !== null);
  const p = (names: string[], idx: number, fallback: number) => {
    for (const n of names) { const v = param(t, n); if (v !== null) { const x = parseNumber(v, tools.fixName); if (x !== null) return x; } }
    return nums[idx] ?? fallback;
  };
  switch (family) {
    case 'normal': {
      const mu = p(['mu', 'μ', 'mean', 'm'], 0, 0);
      let sigma = p(['sigma', 'σ', 'sd', 's'], 1, 1);
      const variance = param(t, 'var') ?? param(t, 'σ²') ?? param(t, 'sigma2');
      if (variance) sigma = Math.sqrt(parseNumber(variance, tools.fixName) ?? 1);
      if (sigma <= 0) return 'σ must be positive';
      return { name: `N(${fmt(mu)}, ${fmt(sigma * sigma)})`, discrete: false, range: [mu - 4 * sigma, mu + 4 * sigma], f: (x) => Math.exp(-((x - mu) ** 2) / (2 * sigma * sigma)) / (sigma * Math.sqrt(2 * Math.PI)) };
    }
    case 't': {
      const v = p(['df', 'nu', 'ν', 'n'], 0, 5);
      const c = Math.exp(lgamma((v + 1) / 2) - lgamma(v / 2)) / Math.sqrt(v * Math.PI);
      return { name: `t(${fmt(v)})`, discrete: false, range: [-4.5, 4.5], f: (x) => c * Math.pow(1 + (x * x) / v, -(v + 1) / 2) };
    }
    case 'chisq': {
      const k = p(['k', 'df', 'n'], 0, 3);
      const c = -(k / 2) * Math.log(2) - lgamma(k / 2);
      return { name: `χ²(${fmt(k)})`, discrete: false, range: [0, k + 4 * Math.sqrt(2 * k)], f: (x) => (x <= 0 ? 0 : Math.exp(c + (k / 2 - 1) * Math.log(x) - x / 2)) };
    }
    case 'exponential': {
      const l = p(['lambda', 'λ', 'rate', 'l'], 0, 1);
      if (l <= 0) return 'λ must be positive';
      return { name: `Exp(${fmt(l)})`, discrete: false, range: [-0.3 / l, 5 / l], f: (x) => (x < 0 ? 0 : l * Math.exp(-l * x)) };
    }
    case 'uniform': {
      const r = readRange(t, tools);
      const [a, b] = r ?? [p(['a'], 0, 0), p(['b'], 1, 1)];
      if (b <= a) return 'Give a < b for a uniform distribution';
      return { name: `U(${fmt(a)}, ${fmt(b)})`, discrete: false, range: [a - (b - a) * 0.4, b + (b - a) * 0.4], f: (x) => (x >= a && x <= b ? 1 / (b - a) : 0) };
    }
    case 'binomial': {
      const n = Math.round(p(['n'], 0, 10)), q = p(['p'], 1, 0.5);
      if (n < 1 || n > 500 || q < 0 || q > 1) return 'Use n between 1 and 500 and p between 0 and 1';
      return { name: `B(${n}, ${fmt(q)})`, discrete: true, range: [0, n], f: (k) => (k < 0 || k > n ? 0 : Math.exp(lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1) + k * Math.log(q || 1e-300) + (n - k) * Math.log(1 - q || 1e-300))) };
    }
    case 'poisson': {
      const l = p(['lambda', 'λ', 'mu', 'μ', 'l'], 0, 3);
      if (l <= 0) return 'λ must be positive';
      return { name: `Poisson(${fmt(l)})`, discrete: true, range: [0, Math.ceil(l + 4 * Math.sqrt(l) + 2)], f: (k) => (k < 0 ? 0 : Math.exp(-l + k * Math.log(l) - lgamma(k + 1))) };
    }
    case 'geometric': {
      const q = p(['p'], 0, 0.3);
      if (q <= 0 || q > 1) return 'p must be between 0 and 1';
      return { name: `Geom(${fmt(q)})`, discrete: true, range: [1, Math.max(5, Math.ceil(4 / q))], f: (k) => (k < 1 ? 0 : Math.pow(1 - q, k - 1) * q) };
    }
  }
  return 'Unknown distribution';
}

/** "shade -1..1", "shade < 1.96", "shade x > 2", "P(X <= 3)", "P(2 < X < 5)" → [a, b]. */
function readShade(clause: string, tools: ArgTools): { a: number; b: number; strictA: boolean; strictB: boolean } | null {
  let t = clause.replace(/^(shade|area|highlight|p\s*\(|prob)\s*/i, '').replace(/\)\s*$/, '').trim();
  t = t.replace(/≤/g, '<=').replace(/≥/g, '>=');
  const r = readRange(t.replace(/^(from|between)\s+/i, ''), tools);
  if (r) return { a: r[0], b: r[1], strictA: false, strictB: false };
  const two = t.match(/^(.+?)\s*(<=?)\s*[xXkK]\s*(<=?)\s*(.+)$/);
  if (two) {
    const a = parseNumber(two[1], tools.fixName), b = parseNumber(two[4], tools.fixName);
    if (a !== null && b !== null) return { a, b, strictA: two[2] === '<', strictB: two[3] === '<' };
  }
  const one = t.match(/^(?:[xXkK]\s*)?(<=?|>=?)\s*(.+)$/);
  if (one) {
    const v = parseNumber(one[2], tools.fixName);
    if (v === null) return null;
    const strict = !one[1].endsWith('=');
    return one[1].startsWith('<') ? { a: -Infinity, b: v, strictA: false, strictB: strict } : { a: v, b: Infinity, strictA: strict, strictB: false };
  }
  return null;
}

function probabilityOf(d: Dist, s: { a: number; b: number; strictA: boolean; strictB: boolean }): number {
  if (d.discrete) {
    let total = 0;
    const lo = Math.max(Number.isFinite(s.a) ? Math.ceil(s.a) : d.range[0], d.range[0]);
    const hi = Math.min(Number.isFinite(s.b) ? Math.floor(s.b) : d.range[1] * 4 + 100, 100000);
    for (let k = lo; k <= hi; k++) {
      if ((k === s.a && s.strictA) || (k === s.b && s.strictB)) continue;
      total += d.f(k);
    }
    return total;
  }
  // Simpson's rule, with infinite ends cut where the density has died away.
  const width = d.range[1] - d.range[0];
  const a = Math.max(s.a, d.range[0] - 10 * width), b = Math.min(s.b, d.range[1] + 10 * width);
  if (b <= a) return 0;
  const N = 4000;
  const h = (b - a) / N;
  let sum = d.f(a) + d.f(b);
  for (let i = 1; i < N; i++) sum += (i % 2 ? 4 : 2) * d.f(a + i * h);
  return (sum * h) / 3;
}

function distParts(args: string) {
  const clauses = splitClauses(args);
  const answers = clauses.filter((c) => /^P\s*=|^p\s*=|^≈/.test(c));
  const shades = clauses.filter((c) => /^(shade|area|highlight|p\s*\()/i.test(c));
  const spec = clauses.filter((c) => !answers.includes(c) && !shades.includes(c)).join(' ');
  return { spec, shades, answers };
}

function drawDist(d: Dist, shades: ReturnType<typeof readShade>[], answer: string | null, cumulative: boolean): FigureOutput {
  const [x0, x1] = d.range;
  if (d.discrete) {
    const ks: number[] = [];
    for (let k = Math.ceil(x0); k <= x1; k++) ks.push(k);
    const vals = cumulative ? ks.map((k) => ks.filter((j) => j <= k).reduce((s, j) => s + d.f(j), 0)) : ks.map((k) => d.f(k));
    const frame = makeFrame([x0 - 1, x1 + 1], [0, Math.max(...vals) * 1.12]);
    let body = drawAxes(frame, { xLabel: 'k', yLabel: cumulative ? 'F(k)' : 'P(X = k)' });
    const inShade = (k: number) => shades.some((s) => s && (k > s.a || (k === s.a && !s.strictA)) && (k < s.b || (k === s.b && !s.strictB)));
    ks.forEach((k, i) => {
      if (cumulative) {
        const next = k + 1;
        body += line(frame.sx(k), frame.sy(vals[i]), frame.sx(Math.min(next, x1 + 1)), frame.sy(vals[i]), { stroke: COLORS[0], 'stroke-width': 2.2 });
        body += dot(frame, k, vals[i], { color: COLORS[0], r: 3.5 });
        if (next <= x1) body += dot(frame, next, vals[i], { color: COLORS[0], r: 3.5, open: true });
      } else {
        const color = inShade(k) ? COLORS[1] : COLORS[0];
        const w = (frame.sx(1) - frame.sx(0)) * 0.7;
        body += el('rect', { x: frame.sx(k) - w / 2, y: frame.sy(vals[i]), width: w, height: frame.sy(0) - frame.sy(vals[i]), fill: color, 'fill-opacity': inShade(k) ? 0.75 : 0.45, stroke: color });
      }
    });
    body += legend(frame, [{ label: `X ~ ${d.name}`, color: COLORS[0] }]);
    if (answer) body += text(frame.box.right - 4, frame.box.top + 14, answer, { 'text-anchor': 'end', fill: COLORS[1], 'font-size': 14, 'font-style': 'italic' });
    return { ok: true, svg: svg(frame.width, frame.height, body, `Distribution ${d.name}`), notes: [] };
  }
  const N = 400;
  const xs = Array.from({ length: N + 1 }, (_, i) => x0 + ((x1 - x0) * i) / N);
  let F = 0;
  const cdfVals = xs.map((x, i) => (i === 0 ? 0 : (F += ((d.f(x) + d.f(xs[i - 1])) / 2) * ((x1 - x0) / N))));
  const g = cumulative ? (x: number) => cdfVals[Math.max(0, Math.min(N, Math.round(((x - x0) / (x1 - x0)) * N)))] : d.f;
  const yMax = cumulative ? 1.05 : Math.max(...xs.map(d.f).filter(Number.isFinite)) * 1.15;
  const frame = makeFrame([x0, x1], [0, yMax || 1]);
  const clip = clipToBox(frame);
  let inner = '';
  if (!cumulative) {
    for (const s of shades) {
      if (!s) continue;
      const a = Math.max(s.a, x0), b = Math.min(s.b, x1);
      if (b <= a) continue;
      const pts: [number, number][] = [[a, 0]];
      for (let i = 0; i <= 120; i++) { const x = a + ((b - a) * i) / 120; pts.push([x, d.f(x)]); }
      pts.push([b, 0]);
      inner += path(polyline(frame, pts, true), { fill: COLORS[1], 'fill-opacity': 0.35, stroke: 'none' });
      for (const e of [s.a, s.b]) if (Number.isFinite(e) && e >= x0 && e <= x1) inner += line(frame.sx(e), frame.sy(0), frame.sx(e), frame.sy(d.f(e)), { stroke: COLORS[1], 'stroke-width': 1.2, ...DASHED });
    }
  }
  inner += path(functionPath(frame, g, x0, x1, 500), { stroke: COLORS[0], 'stroke-width': 2.3 });
  let body = clip.defs + drawAxes(frame, { yLabel: cumulative ? 'F(x)' : 'f(x)' }) + `<g clip-path="${clip.attr}">${inner}</g>`;
  body += legend(frame, [{ label: `X ~ ${d.name}`, color: COLORS[0] }]);
  if (answer) body += text(frame.box.right - 4, frame.box.top + 14, answer, { 'text-anchor': 'end', fill: COLORS[1], 'font-size': 14, 'font-style': 'italic' });
  return { ok: true, svg: svg(frame.width, frame.height, body, `Distribution ${d.name}`), notes: [] };
}

export const dist: FigureCommand = {
  name: 'dist',
  area: 'Probability and statistics',
  example: '/dist normal 0 1\n  + shade -1..1',
  description: 'A distribution: normal μ σ, t df, chisq k, exponential λ, uniform a b, binomial n p, poisson λ, geometric p. “shade a..b” or “shade < 1.96” colours a probability; with Compute on, its value is suggested.',
  draw(args, tools) {
    const { spec, shades, answers } = distParts(args);
    const d = readDist(spec, tools);
    if (typeof d === 'string') return fail(`${d}. Try: ${firstLine(dist.example)}`);
    const ss = shades.map((s) => readShade(s, tools));
    if (ss.some((s) => s === null)) return fail('Write the shaded part like “shade -1..1”, “shade < 1.96” or “shade > 2”');
    return drawDist(d, ss, answers[0] ?? null, false);
  },
  suggest(args, tools) {
    const { spec, shades, answers } = distParts(args);
    if (!shades.length || answers.length) return null;
    const d = readDist(spec, tools);
    if (typeof d === 'string') return null;
    const ss = shades.map((s) => readShade(s, tools));
    if (ss.some((s) => s === null)) return null;
    const p = ss.reduce((sum, s) => sum + probabilityOf(d, s!), 0);
    return [`P = ${p.toFixed(4)}`];
  },
};

export const cdf: FigureCommand = {
  name: 'cdf',
  area: 'Probability and statistics',
  example: '/cdf binomial n=5 p=0.5',
  description: 'The cumulative distribution function F(x) = P(X ≤ x): a step function for discrete distributions.',
  draw(args, tools) {
    const d = readDist(splitClauses(args).join(' '), tools);
    if (typeof d === 'string') return fail(`${d}. Try: ${cdf.example}`);
    return drawDist(d, [], null, true);
  },
};

// ---- Data ----------------------------------------------------------------------------------------

function quartiles(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const med = (a: number[]) => (a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2);
  const half = Math.floor(s.length / 2);
  return { min: s[0], q1: med(s.slice(0, half)), med: med(s), q3: med(s.slice(s.length % 2 ? half + 1 : half)), max: s[s.length - 1], sorted: s };
}

export const hist: FigureCommand = {
  name: 'hist',
  area: 'Probability and statistics',
  example: '/hist 2 3 3 4 5 5 5 6 7 7 8 9 12\n  + bins=5',
  description: 'A histogram of the numbers you give (bins=k to choose the number of bars).',
  draw(args, tools) {
    const clauses = splitClauses(args);
    const binsText = clauses.map((c) => param(c, 'bins', 'k')).find((v) => v !== null);
    const data = numberList(clauses.filter((c) => !/bins|^k\s*=/i.test(c)).join(' '), tools);
    if (!data || data.length < 2) return fail(`Give at least two numbers. Try: ${firstLine(hist.example)}`);
    const min = Math.min(...data), max = Math.max(...data);
    const k = Math.max(1, Math.min(40, Number(binsText) || Math.ceil(Math.log2(data.length) + 1)));
    const width = (max - min) / k || 1;
    const counts = Array(k).fill(0);
    for (const x of data) counts[Math.min(k - 1, Math.floor((x - min) / width))]++;
    const frame = makeFrame([min - width * 0.5, max + width * 0.5], [0, Math.max(...counts) * 1.15]);
    let body = drawAxes(frame, { yLabel: 'count', xLabel: '' });
    counts.forEach((c, i) => {
      const a = min + i * width;
      body += el('rect', { x: frame.sx(a), y: frame.sy(c), width: frame.sx(a + width) - frame.sx(a), height: frame.sy(0) - frame.sy(c), fill: COLORS[0], 'fill-opacity': 0.45, stroke: COLORS[0], 'stroke-width': 1.2 });
    });
    return { ok: true, svg: svg(frame.width, frame.height, body, 'Histogram'), notes: [`${data.length} values, ${k} bins of width ${fmt(width)}`] };
  },
};

export const boxplot: FigureCommand = {
  name: 'boxplot',
  area: 'Probability and statistics',
  example: '/boxplot A: 2 3 5 6 7 8 9 12\n  + B: 4 5 5 6 6 7 15',
  description: 'Box plots (min, quartiles, median, max; points beyond 1.5 IQR shown separately). One data set per line, optionally named “A: …”.',
  draw(args, tools) {
    const sets: { name: string; data: number[] }[] = [];
    for (const c of splitClauses(args)) {
      const m = c.match(/^([^:\d-][^:]*):\s*(.*)$/);
      const data = numberList(m ? m[2] : c, tools);
      if (!data || data.length < 2) return fail(`Give at least two numbers per box. Try: ${firstLine(boxplot.example)}`);
      sets.push({ name: m ? m[1].trim() : '', data });
    }
    if (!sets.length) return fail(`Which data? e.g. ${firstLine(boxplot.example)}`);
    const all = sets.flatMap((s) => s.data);
    const [lo, hi] = [Math.min(...all), Math.max(...all)];
    const pad = (hi - lo) * 0.08 || 1;
    const W = 440, rowH = 54, H = sets.length * rowH + 50;
    const frame = makeFrame([lo - pad, hi + pad], [0, 1], { width: W, height: H });
    const sx = frame.sx;
    let body = '';
    const axisY = H - 30;
    body += line(28, axisY, W - 20, axisY, { 'stroke-width': 1.2 });
    for (const t of ticks(lo - pad, hi + pad, niceStep(hi - lo + 2 * pad, 7))) {
      body += line(sx(t), axisY, sx(t), axisY + 4, { 'stroke-width': 1 }) + text(sx(t), axisY + 16, formatNumber(t), { 'font-size': 11, 'text-anchor': 'middle', 'fill-opacity': 0.75 });
    }
    sets.forEach((s, i) => {
      const q = quartiles(s.data);
      const iqr = q.q3 - q.q1;
      const inner = q.sorted.filter((x) => x >= q.q1 - 1.5 * iqr && x <= q.q3 + 1.5 * iqr);
      const [wLo, wHi] = [Math.min(...inner), Math.max(...inner)];
      const y = 22 + i * rowH + rowH / 2 - 8;
      const h = 26;
      const color = COLORS[i % COLORS.length];
      body += line(sx(wLo), y, sx(q.q1), y, { stroke: color, 'stroke-width': 1.5 }) + line(sx(q.q3), y, sx(wHi), y, { stroke: color, 'stroke-width': 1.5 });
      body += line(sx(wLo), y - 8, sx(wLo), y + 8, { stroke: color, 'stroke-width': 1.5 }) + line(sx(wHi), y - 8, sx(wHi), y + 8, { stroke: color, 'stroke-width': 1.5 });
      body += el('rect', { x: sx(q.q1), y: y - h / 2, width: sx(q.q3) - sx(q.q1), height: h, fill: color, 'fill-opacity': 0.18, stroke: color, 'stroke-width': 1.6 });
      body += line(sx(q.med), y - h / 2, sx(q.med), y + h / 2, { stroke: color, 'stroke-width': 2.5 });
      for (const o of q.sorted.filter((x) => !inner.includes(x))) body += el('circle', { cx: sx(o), cy: y, r: 3.5, fill: 'none', stroke: color, 'stroke-width': 1.5 });
      if (s.name) body += text(sx(wLo) - 8, y + 5, s.name, { 'text-anchor': 'end', 'font-size': 13, 'font-style': 'italic' });
    });
    return { ok: true, svg: svg(W, H, body, 'Box plot'), notes: [] };
  },
};

export const scatter: FigureCommand = {
  name: 'scatter',
  area: 'Probability and statistics',
  example: '/scatter (1, 2) (2, 2.8) (3, 4.1) (4, 4.4) (5, 6.2)\n  + fit',
  description: 'A scatter plot of points (x, y), or “x: 1 2 3” and “y: 2 4 5” lines. “fit” adds the least-squares line, “residuals” the vertical gaps.',
  draw(args, tools) {
    const clauses = splitClauses(args);
    let pts: [number, number][] = [];
    const xs = clauses.find((c) => /^x\s*[:=]/i.test(c)), ys = clauses.find((c) => /^y\s*[:=]/i.test(c));
    if (xs && ys) {
      const a = numberList(xs.replace(/^x\s*[:=]/i, ''), tools), b = numberList(ys.replace(/^y\s*[:=]/i, ''), tools);
      if (!a || !b || a.length !== b.length) return fail('The x and y lists need the same number of values');
      pts = a.map((x, i) => [x, b[i]]);
    } else {
      const p = findPairs(clauses.join(' '), tools);
      if (typeof p === 'string') return fail(p);
      pts = p.map((q) => [q.x, q.y]);
    }
    if (pts.length < 2) return fail(`Give at least two points. Try: ${firstLine(scatter.example)}`);
    const wantFit = clauses.some((c) => /\b(fit|regression|line|lsq)\b/i.test(c));
    const wantRes = clauses.some((c) => /\bresiduals?\b/i.test(c));
    const n = pts.length;
    const mx = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n;
    const sxx = pts.reduce((s, p) => s + (p[0] - mx) ** 2, 0), sxy = pts.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0);
    const slope = sxx ? sxy / sxx : 0, icept = my - slope * mx;
    const xr = autoRange(pts.map((p) => p[0]), false)!, yr = autoRange(pts.map((p) => p[1]), false)!;
    const frame: Frame = makeFrame(xr, yr);
    const clip = clipToBox(frame);
    let inner = '';
    if (wantFit || wantRes) {
      inner += line(frame.sx(xr[0]), frame.sy(icept + slope * xr[0]), frame.sx(xr[1]), frame.sy(icept + slope * xr[1]), { stroke: COLORS[1], 'stroke-width': 2 });
      if (wantRes) for (const [x, y] of pts) inner += line(frame.sx(x), frame.sy(y), frame.sx(x), frame.sy(icept + slope * x), { ...DASHED, 'stroke-width': 1, stroke: COLORS[1] });
    }
    let body = clip.defs + drawAxes(frame) + `<g clip-path="${clip.attr}">${inner}</g>`;
    for (const [x, y] of pts) body += dot(frame, x, y, { color: COLORS[0], r: 4 });
    if (wantFit) body += legend(frame, [{ label: 'least-squares line', color: COLORS[1] }]);
    return { ok: true, svg: svg(frame.width, frame.height, body, 'Scatter plot'), notes: [] };
  },
};

export const PROBABILITY_COMMANDS: FigureCommand[] = [dist, cdf, hist, boxplot, scatter];
