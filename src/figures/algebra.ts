// Abstract algebra:
//   /cayley Z4 · U(8) · D3 · S3 · V4 · Q8 · Z6 *   (group tables; the entries are yours to fill, or suggested with Compute on)
//   /perm (1 2 3)(4 5)                            (two-line notation and an arrow diagram)

import { splitClauses, wordsAsText } from './args';
import { svg, line, text, circle, COLORS, INK, arrowHead } from './svg';
import { fail, type FigureCommand } from './types';
import { renderMath } from '../markdown';

interface Group {
  title: string;
  /** Plain names (what you type) and LaTeX names. */
  names: string[];
  tex: string[];
  mul: (i: number, j: number) => number;
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

function cyclic(n: number, times: boolean): Group {
  const els = Array.from({ length: n }, (_, i) => i).filter((i) => !times || gcd(i, n) === 1);
  return {
    title: times ? `U(${n})` : `\\mathbb{Z}_{${n}}`,
    names: els.map(String), tex: els.map(String),
    mul: (i, j) => els.indexOf(times ? (els[i] * els[j]) % n : (els[i] + els[j]) % n),
  };
}

function multTable(n: number): Group {
  const els = Array.from({ length: n }, (_, i) => i);
  return { title: `\\mathbb{Z}_{${n}},\\ \\times`, names: els.map(String), tex: els.map(String), mul: (i, j) => (i * j) % n };
}

function dihedral(n: number): Group {
  // r^k s^f, multiplied by (r^a s^b)(r^c s^d) = r^(a + (-1)^b c) s^(b+d).
  const els: [number, number][] = [];
  for (let f = 0; f < 2; f++) for (let k = 0; k < n; k++) els.push([k, f]);
  const plain = ([k, f]: [number, number]) => (k === 0 && !f ? 'e' : `${k === 0 ? '' : k === 1 ? 'r' : `r^${k}`}${f ? 's' : ''}`);
  const tex = ([k, f]: [number, number]) => (k === 0 && !f ? 'e' : `${k === 0 ? '' : k === 1 ? 'r' : `r^{${k}}`}${f ? 's' : ''}`);
  return {
    title: `D_{${n}}`, names: els.map(plain), tex: els.map(tex),
    mul: (i, j) => {
      const [a, b] = els[i], [c, d] = els[j];
      const k = (((a + (b ? -c : c)) % n) + n) % n;
      return els.findIndex(([x, y]) => x === k && y === (b + d) % 2);
    },
  };
}

function symmetric3(): Group {
  // Permutations of {1,2,3} as arrays; (στ)(x) = σ(τ(x)).
  const perms = [[1, 2, 3], [2, 1, 3], [3, 2, 1], [1, 3, 2], [2, 3, 1], [3, 1, 2]];
  const names = ['e', '(1 2)', '(1 3)', '(2 3)', '(1 2 3)', '(1 3 2)'];
  return {
    title: 'S_3', names, tex: names.map((n) => n.replace(/ /g, '\\,')),
    mul: (i, j) => {
      const p = perms[i], q = perms[j];
      const r = [1, 2, 3].map((x) => p[q[x - 1] - 1]);
      return perms.findIndex((s) => s.every((v, k) => v === r[k]));
    },
  };
}

function klein(): Group {
  const names = ['e', 'a', 'b', 'c'];
  return { title: 'V_4', names, tex: names, mul: (i, j) => i ^ j };
}

function quaternion(): Group {
  // ±1, ±i, ±j, ±k as (sign, unit) with unit 0..3 = 1, i, j, k.
  const units = ['1', 'i', 'j', 'k'];
  const els: [number, number][] = [];
  for (let u = 0; u < 4; u++) for (const s of [1, -1]) els.push([s, u]);
  const table = [[[1, 0], [1, 1], [1, 2], [1, 3]], [[1, 1], [-1, 0], [1, 3], [-1, 2]], [[1, 2], [-1, 3], [-1, 0], [1, 1]], [[1, 3], [1, 2], [-1, 1], [-1, 0]]];
  const name = ([s, u]: [number, number]) => `${s < 0 ? '-' : ''}${units[u]}`;
  return {
    title: 'Q_8', names: els.map(name), tex: els.map(name),
    mul: (i, j) => {
      const [s1, u1] = els[i], [s2, u2] = els[j];
      const [s3, u3] = table[u1][u2];
      return els.findIndex(([s, u]) => s === s1 * s2 * s3 && u === u3);
    },
  };
}

function readGroup(spec: string): Group | string {
  const s = spec.replace(/\s+/g, '').replace(/_/g, '').replace(/[{}]/g, '');
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(?:Z|ℤ)(\d+)(\+|,\+)?$/i))) return cyclic(Number(m[1]), false);
  if ((m = s.match(/^(?:Z|ℤ)(\d+)(\*|×|x|,\*|,×)$/i))) return multTable(Number(m[1]));
  if ((m = s.match(/^(?:U\(?(\d+)\)?|(?:Z|ℤ)(\d+)\^?\*\*?|units(\d+))$/i))) return cyclic(Number(m[1] ?? m[2] ?? m[3]), true);
  if ((m = s.match(/^D(\d+)$/i))) {
    // Dn = the 2n symmetries of a regular n-gon.
    const n = Number(m[1]);
    if (n < 3 || n > 8) return 'Use D3 to D8 (Dn = symmetries of an n-gon)';
    return dihedral(n);
  }
  if (/^S3$/i.test(s)) return symmetric3();
  if (/^(V4|V|klein|klein4)$/i.test(s)) return klein();
  if (/^Q8$/i.test(s)) return quaternion();
  return `Unknown group “${spec}”. Try Z4, U(8), D3, S3, V4, Q8 or Z6 *`;
}

function cayleyParts(args: string) {
  const clauses = splitClauses(args);
  return { spec: clauses[0] ?? '', rows: clauses.slice(1) };
}

export const cayley: FigureCommand = {
  name: 'cayley',
  area: 'Abstract algebra',
  example: '/cayley Z4',
  description: 'A group table for Zn, U(n), Dn, S3, V4, Q8 (or Zn * for multiplication mod n). Fill rows with “+” lines; with Compute on the rows are suggested.',
  draw(args) {
    const { spec, rows } = cayleyParts(args);
    const g = readGroup(spec);
    if (typeof g === 'string') return fail(g);
    const n = g.names.length;
    if (n > 16) return fail('That group is too big for a table (up to 16 elements)');
    const filled = rows.map((r) => r.split(/[\s,]+(?![^()]*\))/).filter(Boolean));
    const texOf = (v: string) => { const i = g.names.indexOf(v); return i >= 0 ? g.tex[i] : v.replace(/\^(\d+)/g, '^{$1}'); };
    let body = `${g.title.includes('times') ? '\\times' : g.title.startsWith('\\mathbb') ? '+' : '\\cdot'} & ${g.tex.join(' & ')} \\\\ \\hline `;
    for (let i = 0; i < n; i++) {
      const cells = Array.from({ length: n }, (_, j) => (filled[i]?.[j] !== undefined ? texOf(filled[i][j]) : '\\phantom{0}'));
      body += `${g.tex[i]} & ${cells.join(' & ')} \\\\ `;
    }
    return { ok: true, latex: `\\begin{array}{c|${'c'.repeat(n)}} ${body} \\end{array}`, notes: [`${g.title.replace(/\\mathbb\{Z\}_\{(\d+)\}/, 'Z$1').replace(/[\\{}_]/g, '').replace(/,\s*times/, ' under ×')}, ${n} elements`] };
  },
  suggest(args) {
    const { spec, rows } = cayleyParts(args);
    const g = readGroup(spec);
    if (typeof g === 'string' || g.names.length > 16 || rows.length >= g.names.length) return null;
    return g.names.slice(rows.length).map((_, k) => {
      const i = rows.length + k;
      return g.names.map((_, j) => g.names[g.mul(i, j)]).join(' ');
    });
  },
};

// ---- Permutations ------------------------------------------------------------------------------

/** "(1 2 3)(4 5)" or "[2 3 1 5 4]" → images of 1..n. */
function readPerm(src: string): number[] | string {
  const s = src.trim();
  const oneLine = s.match(/^\[([\d\s,]+)\]$/);
  if (oneLine) {
    const imgs = oneLine[1].split(/[\s,]+/).filter(Boolean).map(Number);
    const sorted = [...imgs].sort((a, b) => a - b);
    if (!sorted.every((v, i) => v === i + 1)) return 'One-line notation must use each of 1…n once';
    return imgs;
  }
  const cycles = [...s.matchAll(/\(([^()]*)\)/g)].map((m) => m[1].split(/[\s,]+/).filter(Boolean).map(Number));
  if (!cycles.length || cycles.some((c) => c.some((v) => !Number.isInteger(v) || v < 1))) return 'Write cycles like (1 2 3)(4 5), or one-line notation like [2 3 1]';
  const n = Math.max(...cycles.flat());
  if (n > 12) return 'Up to 12 points, please';
  // Apply the rightmost cycle first.
  let perm = Array.from({ length: n }, (_, i) => i + 1);
  for (const c of [...cycles].reverse()) {
    const step = (x: number) => { const i = c.indexOf(x); return i < 0 ? x : c[(i + 1) % c.length]; };
    perm = perm.map(step);
  }
  return perm;
}

function disjointCycles(p: number[]): number[][] {
  const seen = new Set<number>();
  const out: number[][] = [];
  for (let i = 1; i <= p.length; i++) {
    if (seen.has(i)) continue;
    const c = [i];
    seen.add(i);
    let j = p[i - 1];
    while (j !== i) { c.push(j); seen.add(j); j = p[j - 1]; }
    if (c.length > 1) out.push(c);
  }
  return out;
}

export const perm: FigureCommand = {
  name: 'perm',
  area: 'Abstract algebra',
  example: '/perm (1 2 3)(3 4)',
  description: 'A permutation in two-line notation with an arrow diagram. Cycles multiply right to left. With Compute on, the disjoint cycles, order and sign are suggested.',
  draw(args) {
    const [spec, ...answers] = splitClauses(args);
    const p = readPerm(spec ?? '');
    if (typeof p === 'string') return fail(`${p}. Try: ${perm.example}`);
    const n = p.length;
    const answerTex = (a: string) => wordsAsText(a.replace(/\(([\d\s]+)\)/g, (_, c: string) => `(${c.trim().replace(/\s+/g, '\\,')})`));
    const latex = `\\begin{pmatrix} ${p.map((_, i) => i + 1).join(' & ')} \\\\ ${p.join(' & ')} \\end{pmatrix}${answers.map((a) => ` \\quad ${answerTex(a)}`).join('')}`;
    // Arrow diagram: top row 1..n, bottom row 1..n.
    const W = Math.max(200, n * 46 + 40), H = 120;
    const x = (i: number) => 30 + (i * (W - 60)) / Math.max(1, n - 1);
    let body = '';
    for (let i = 0; i < n; i++) {
      body += circle(x(i), 26, 3.5, { fill: INK }) + text(x(i), 16, String(i + 1), { 'text-anchor': 'middle', 'font-size': 13 });
      body += circle(x(i), 94, 3.5, { fill: INK }) + text(x(i), 112, String(i + 1), { 'text-anchor': 'middle', 'font-size': 13 });
    }
    p.forEach((img, i) => {
      const color = img === i + 1 ? '#999' : COLORS[i % COLORS.length];
      body += line(x(i), 30, x(img - 1), 88, { stroke: color, 'stroke-width': 1.6 }) + arrowHead(x(i), 30, x(img - 1), 90, color, 7);
    });
    const html = `<div class="figure-math">${renderMath(latex, true)}</div>${svg(W, H, body, 'Permutation')}`;
    return { ok: true, html, latex, notes: [] };
  },
  suggest(args) {
    const [spec, ...answers] = splitClauses(args);
    const p = readPerm(spec ?? '');
    if (typeof p === 'string' || answers.length) return null;
    const cycles = disjointCycles(p);
    const lcm = (a: number, b: number): number => (a * b) / gcd(a, b);
    const order = cycles.reduce((o, c) => lcm(o, c.length), 1);
    const even = cycles.reduce((s, c) => s + c.length - 1, 0) % 2 === 0;
    const form = cycles.length ? cycles.map((c) => `(${c.join(' ')})`).join('') : 'e';
    return [`= ${form}, order ${order}, ${even ? 'even' : 'odd'}`];
  },
};

export const ALGEBRA_COMMANDS: FigureCommand[] = [cayley, perm];
