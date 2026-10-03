// Linear algebra.
// Blocks: /matrix /augmented /rowops (/rref) /det /inverse /eigen /system /vectors
// Figures: /transform /span /projection /lines /parallelogram
//
// Answers (determinants, inverses, next row operation, eigenvalues, solutions)
// are only ever *suggested* when Compute is on; what is drawn comes from the text.

import { parseExpression, parseNumber } from './expr';
import { splitClauses, splitTopLevel, findPairs, findTriples, toTex, fmt, wordsAsText } from './args';
import { Q, parseQ, det, inverse, applyOp, opText, opTex, parseRowOp, nextRrefStep, type M, type RowOp } from './rational';
import { svg, makeFrame, drawAxes, path, line, text, el, arrow, COLORS, clipToBox, DASHED, dot, polyline, type Frame } from './svg';
import { fail, firstLine, type ArgTools, type FigureCommand } from './types';
import { renderMath } from '../markdown';
import { drawInverseFunction } from './graphs';
import { Scene3, cross, norm3, type V3 } from './three';

// ---- Reading matrices -----------------------------------------------------------------

export interface ParsedMatrix {
  name: string | null;
  rows: string[][];
  /** Column index where the augmentation bar goes, or null. */
  aug: number | null;
  brackets: 'p' | 'b' | 'v' | null;
}

/** "A = [1 2; 3 4]", "1, 2; 3, 4", "[[1,2],[3,4]]", "1 2 | 3; 4 5 | 6". */
export function parseMatrix(input: string): ParsedMatrix | string {
  let t = input.trim();
  let name: string | null = null;
  const named = t.match(/^([A-Za-z][\w']*)\s*=\s*(.*)$/s);
  if (named && !/^\d/.test(named[1])) { name = named[1]; t = named[2].trim(); }
  let brackets: ParsedMatrix['brackets'] = null;
  let rowTexts: string[];
  if (/^\[\s*\[/.test(t)) {
    rowTexts = [...t.matchAll(/\[([^[\]]*)\]/g)].map((m) => m[1]);
    brackets = 'b';
  } else {
    const pairs: Record<string, [string, ParsedMatrix['brackets']]> = { '[': [']', 'b'], '(': [')', 'p'], '|': ['|', 'v'] };
    const open = pairs[t[0]];
    if (open && t.endsWith(open[0]) && t.length > 1) {
      t = t.slice(1, -1);
      brackets = open[1];
    }
    rowTexts = t.split(/[;\n]/);
  }
  rowTexts = rowTexts.map((r) => r.trim()).filter(Boolean);
  if (!rowTexts.length) return 'The matrix is empty';
  let aug: number | null = null;
  const rows: string[][] = [];
  for (const r of rowTexts) {
    const parts = r.split('|');
    if (parts.length > 2) return `Use one “|” per row for an augmented matrix`;
    const split = (s: string) => (s.includes(',') ? splitTopLevel(s, ',') : s.trim().split(/\s+/)).filter((x) => x !== '');
    const left = split(parts[0]);
    const right = parts.length === 2 ? split(parts[1]) : [];
    if (parts.length === 2) {
      if (aug !== null && aug !== left.length) return 'The “|” should be in the same column in every row';
      aug = left.length;
    }
    rows.push([...left, ...right]);
  }
  const width = rows[0].length;
  if (rows.some((r) => r.length !== width)) return `Every row needs the same number of entries (the first has ${width})`;
  return { name, rows, aug, brackets };
}

/** Exact numbers for the matrix, or null if some entry isn't a plain number. */
export function numeric(m: ParsedMatrix, tools: ArgTools): M | null {
  const out: M = [];
  for (const row of m.rows) {
    const r: Q[] = [];
    for (const e of row) {
      const q = parseQ(e) ?? (() => { const v = parseNumber(e, tools.fixName); return v === null ? null : Q.fromNumber(v); })();
      if (!q) return null;
      r.push(q);
    }
    out.push(r);
  }
  return out;
}

const entryTex = (e: string | Q) => (typeof e === 'string' ? (parseQ(e)?.toTex() ?? toTex(e)) : e.toTex());

/** LaTeX for a matrix. `env` is pmatrix, bmatrix or vmatrix. */
export function matrixTex(rows: (string | Q)[][], env = 'pmatrix', aug: number | null = null): string {
  const body = rows.map((r) => r.map(entryTex).join(' & ')).join(' \\\\ ');
  if (aug !== null) {
    const cols = 'c'.repeat(aug) + '|' + 'c'.repeat(rows[0].length - aug);
    const [l, r] = env === 'vmatrix' ? ['|', '|'] : env === 'pmatrix' ? ['(', ')'] : ['[', ']'];
    return `\\left${l}\\begin{array}{${cols}} ${body} \\end{array}\\right${r}`;
  }
  return `\\begin{${env}} ${body} \\end{${env}}`;
}

const envOf = (m: ParsedMatrix, fallback = 'pmatrix') => (m.brackets === 'b' ? 'bmatrix' : m.brackets === 'v' ? 'vmatrix' : fallback);

/** Split clauses into the matrix part and "answer" lines (those starting with "=" or a keyword). */
function matrixAndAnswers(args: string, answerStart: RegExp) {
  const clauses = splitClauses(args);
  const answers = clauses.filter((c) => answerStart.test(c));
  const matrixText = clauses.filter((c) => !answerStart.test(c)).join('; ');
  return { matrixText, answers };
}

// ---- Blocks ---------------------------------------------------------------------------------

export const matrix: FigureCommand = {
  name: 'matrix',
  area: 'Linear algebra',
  example: '/matrix A = 1 2 3\n  + 4 5 6\n  + 7 8 9',
  description: 'A matrix from quick input: rows on “+” lines (or separated by ;), entries by spaces or commas. [ ] gives square brackets.',
  draw(args) {
    const m = parseMatrix(splitClauses(args).join('; '));
    if (typeof m === 'string') return fail(`${m}. Try: ${firstLine(matrix.example)}`);
    const latex = `${m.name ? `${toTex(m.name)} = ` : ''}${matrixTex(m.rows, envOf(m), m.aug)}`;
    return { ok: true, latex, notes: [] };
  },
};

export const augmented: FigureCommand = {
  name: 'augmented',
  area: 'Linear algebra',
  example: '/augmented 1 2 | 5\n  + 3 4 | 6',
  description: 'An augmented matrix with a bar. Without “|”, the bar goes before the last column.',
  draw(args) {
    const m = parseMatrix(splitClauses(args).join('; '));
    if (typeof m === 'string') return fail(`${m}. Try: ${firstLine(augmented.example)}`);
    const aug = m.aug ?? m.rows[0].length - 1;
    return { ok: true, latex: `${m.name ? `${toTex(m.name)} = ` : ''}${matrixTex(m.rows, 'bmatrix', aug)}`, notes: [] };
  },
};

/** A row operation mentions a row like R2 (matrix rows never do). */
const isOp = (c: string) => /(^|[^A-Za-z])[Rr]\d/.test(c) || /^swap\b/i.test(c.trim());

function readRowops(args: string, tools: ArgTools) {
  const clauses = splitClauses(args);
  const opsText = clauses.filter(isOp);
  const m = parseMatrix(clauses.filter((c) => !isOp(c)).join('; '));
  if (typeof m === 'string') return m;
  const num = numeric(m, tools);
  if (!num) return 'Row reduction needs numbers in the matrix';
  const steps: { op: RowOp; m: M }[] = [];
  let cur = num;
  for (const t of opsText) {
    const op = parseRowOp(t, cur.length);
    if (typeof op === 'string') return op;
    cur = applyOp(cur, op);
    steps.push({ op, m: cur });
  }
  return { m, start: num, steps, cur };
}

export const rowops: FigureCommand = {
  name: 'rowops',
  area: 'Linear algebra',
  example: '/rowops 1 2 | 5\n  + 3 4 | 6\n  + R2 - 3R1\n  + -1/2 R2',
  description: 'Row reduction: write the matrix, then one row operation per line (R2 - 3R1, 1/2 R1, R1 <-> R2). Each result is worked out and shown. With Compute on, the next step is suggested.',
  draw(args, tools) {
    const r = readRowops(args, tools);
    if (typeof r === 'string') return fail(`${r}. Try: ${firstLine(rowops.example)}`);
    const env = r.m.aug !== null ? 'bmatrix' : envOf(r.m);
    const pieces = [matrixTex(r.start, env, r.m.aug)];
    for (const s of r.steps) pieces.push(`\\xrightarrow{\\textstyle ${opTex(s.op)}} ${matrixTex(s.m, env, r.m.aug)}`);
    const html = `<div class="figure-steps">${pieces.map((p) => `<span>${renderMath(`\\displaystyle ${p}`, false)}</span>`).join('')}</div>`;
    return { ok: true, html, latex: pieces.join(' '), notes: [] };
  },
  suggest(args, tools) {
    const r = readRowops(args, tools);
    if (typeof r === 'string') return null;
    const cols = r.m.aug ?? r.cur[0].length;
    const op = nextRrefStep(r.cur, cols);
    return op ? [opText(op)] : null;
  },
};

export const detCommand: FigureCommand = {
  name: 'det',
  area: 'Linear algebra',
  example: '/det 2 1\n  + 4 3',
  description: 'A determinant |A|. With Compute on, its value is suggested (“= 2”).',
  draw(args) {
    const { matrixText, answers } = matrixAndAnswers(args, /^=/);
    const m = parseMatrix(matrixText);
    if (typeof m === 'string') return fail(`${m}. Try: ${firstLine(detCommand.example)}`);
    if (m.rows.length !== m.rows[0].length) return fail('A determinant needs a square matrix');
    const lhs = m.name ? `\\det ${toTex(m.name)} = ` : '';
    const latex = `${lhs}${matrixTex(m.rows, 'vmatrix')}${answers.map((a) => ` ${toTex(a)}`).join('')}`;
    return { ok: true, latex, notes: [] };
  },
  suggest(args, tools) {
    const { matrixText, answers } = matrixAndAnswers(args, /^=/);
    const m = parseMatrix(matrixText);
    if (typeof m === 'string' || answers.length || m.rows.length !== m.rows[0].length) return null;
    const num = numeric(m, tools);
    return num ? [`= ${det(num).toString()}`] : null;
  },
};

/** "2 1; 5 3", "A = [2 1; 5 3]", "[[2,1],[5,3]]" look like matrices; "e^x" doesn't. */
const looksLikeMatrix = (args: string) => {
  const t = args.trim().replace(/^[A-Z]\w*\s*=\s*/, '');
  return /^[\s[(|]*[-\d./]+[\s,]+[-\d./]+.*[;\n]/s.test(t) || /^\[\s*\[/.test(t);
};

export const inverseCommand: FigureCommand = {
  name: 'inverse',
  area: 'Linear algebra',
  example: '/inverse 2 1\n  + 5 3',
  description: 'A matrix inverse A⁻¹ (with Compute on, suggested as “= [...]”). Given a function instead, draws f and its inverse: /inverse e^x.',
  draw(args, tools) {
    if (!looksLikeMatrix(args)) return drawInverseFunction(args, tools);
    const { matrixText, answers } = matrixAndAnswers(args, /^=|^not\b/i);
    const m = parseMatrix(matrixText);
    if (typeof m === 'string') return fail(`${m}. Try: ${firstLine(inverseCommand.example)}`);
    if (m.rows.length !== m.rows[0].length) return fail('Only square matrices have inverses');
    let rhs = '';
    for (const a of answers) {
      if (/^not/i.test(a)) { rhs += ` \\quad \\text{${a.replace(/[{}\\]/g, '')}}`; continue; }
      const inv = parseMatrix(a.replace(/^=\s*/, ''));
      rhs += typeof inv === 'string' ? ` ${toTex(a)}` : ` = ${matrixTex(inv.rows, envOf(m))}`;
    }
    const name = m.name ? toTex(m.name) : '';
    const latex = name ? `${name}^{-1} = ${matrixTex(m.rows, envOf(m))}^{-1}${rhs}` : `${matrixTex(m.rows, envOf(m))}^{-1}${rhs}`;
    return { ok: true, latex, notes: [] };
  },
  suggest(args, tools) {
    if (!looksLikeMatrix(args)) return null;
    const { matrixText, answers } = matrixAndAnswers(args, /^=|^not\b/i);
    const m = parseMatrix(matrixText);
    if (typeof m === 'string' || answers.length || m.rows.length !== m.rows[0].length) return null;
    const num = numeric(m, tools);
    if (!num) return null;
    const inv = inverse(num);
    if (!inv) return ['not invertible (det = 0)'];
    return [`= [${inv.map((r) => r.map((q) => q.toString()).join(' ')).join('; ')}]`];
  },
};

// ---- Eigenvalues ----------------------------------------------------------------------------

function sqrtParts(q: Q): { out: Q; inside: number } | null {
  // √(n/d) = (a/b)·√c with c square-free; only when n·d fits.
  if (q.n < 0) return null;
  let inside = q.n * q.d;
  let outside = 1;
  for (let f = 2; f * f <= inside; f++) while (inside % (f * f) === 0) { inside /= f * f; outside *= f; }
  return { out: new Q(outside, q.d), inside };
}

function intVector(v: Q[]): string {
  // Clear denominators, then common factors.
  const l = v.reduce((acc, q) => (acc * q.d) / gcdN(acc, q.d), 1);
  let ints = v.map((q) => (q.n * l) / q.d);
  const g = ints.reduce((a, b) => gcdN(a, Math.abs(b)), 0) || 1;
  ints = ints.map((x) => x / g);
  if (ints.find((x) => x !== 0)! < 0) ints = ints.map((x) => -x);
  return `(${ints.join(', ')})`;
}
const gcdN = (a: number, b: number): number => (b ? gcdN(b, a % b) : Math.abs(a));

function eigenAnswers(num: M): string[] {
  const n = num.length;
  if (n === 2) {
    const [[a, b], [c, d]] = num;
    const tr = a.add(d), dt = a.mul(d).sub(b.mul(c));
    const disc = tr.mul(tr).sub(new Q(4).mul(dt));
    const half = new Q(1, 2);
    const vecFor = (l: Q) => {
      if (!b.isZero()) return intVector([b, l.sub(a)]);
      if (!c.isZero()) return intVector([l.sub(d), c]);
      return null;
    };
    if (disc.isZero()) {
      const l = tr.mul(half);
      if (b.isZero() && c.isZero()) return [`λ = ${l} (twice)`, 'v = every nonzero vector'];
      return [`λ = ${l} (twice)`, `v = ${vecFor(l)}`];
    }
    const s = sqrtParts(disc.n < 0 ? disc.neg() : disc);
    if (s && s.inside === 1) {
      const root = s.out;
      const [l1, l2] = [tr.sub(root).mul(half), tr.add(root).mul(half)];
      if (disc.n > 0) return [`λ = ${l1}, ${l2}`, `v = ${vecFor(l1)}, ${vecFor(l2)}`];
      return [`λ = ${tr.mul(half)} ± ${root.mul(half)}i`];
    }
    if (s) {
      const k = s.out.mul(half);
      const coef = k.equals(Q.ONE) ? '' : k.toString();
      const centre = tr.mul(half);
      if (disc.n > 0) {
        const approx = [(tr.valueOf() - Math.sqrt(disc.valueOf())) / 2, (tr.valueOf() + Math.sqrt(disc.valueOf())) / 2];
        return [`λ = ${centre.isZero() ? '' : `${centre} `}± ${coef}√${s.inside}`, `≈ ${approx.map((v) => fmt(v)).join(', ')}`];
      }
      return [`λ = ${centre} ± ${coef}√${s.inside} i`];
    }
  }
  // Larger matrices: numerical roots of the characteristic polynomial.
  const A = num.map((r) => r.map((q) => q.valueOf()));
  const roots = charRoots(A);
  return [`λ ≈ ${roots.map(([re, im]) => (Math.abs(im) < 1e-7 ? fmt(re) : `${fmt(re)} ${im < 0 ? '−' : '+'} ${fmt(Math.abs(im))}i`)).join(', ')}`];
}

/** Roots of det(λI − A) (Faddeev–LeVerrier coefficients, then Durand–Kerner). */
function charRoots(A: number[][]): [number, number][] {
  const n = A.length;
  const coeffs = [1];
  let Mk = A.map((r) => r.map(() => 0));
  for (let k = 1; k <= n; k++) {
    // M_k = A·M_{k-1} + c_{k-1} I, then c_k = −tr(A·M_k) / k
    const Mnew = A.map((row, i) => row.map((_, j) => row.reduce((s, a, t) => s + a * Mk[t][j], 0) + (i === j ? coeffs[k - 1] : 0)));
    const AMn = A.map((row) => row.map((_, j) => row.reduce((s, a, t) => s + a * Mnew[t][j], 0)));
    const trace = AMn.reduce((s, r, i) => s + r[i], 0);
    coeffs.push(-trace / k);
    Mk = Mnew;
  }
  // Durand–Kerner on λ^n + c1 λ^(n-1) + … + cn.
  const evalP = (z: [number, number]): [number, number] => {
    let re = 1, im = 0;
    for (let k = 1; k <= n; k++) {
      [re, im] = [re * z[0] - im * z[1] + coeffs[k], re * z[1] + im * z[0]];
    }
    return [re, im];
  };
  let roots: [number, number][] = Array.from({ length: n }, (_, k) => [Math.cos((2 * Math.PI * k) / n + 0.4) * 1.3, Math.sin((2 * Math.PI * k) / n + 0.4) * 1.3]);
  for (let it = 0; it < 500; it++) {
    roots = roots.map((z, i) => {
      let den: [number, number] = [1, 0];
      roots.forEach((w, j) => {
        if (i === j) return;
        const d: [number, number] = [z[0] - w[0], z[1] - w[1]];
        den = [den[0] * d[0] - den[1] * d[1], den[0] * d[1] + den[1] * d[0]];
      });
      const p = evalP(z);
      const dd = den[0] * den[0] + den[1] * den[1] || 1e-300;
      const q: [number, number] = [(p[0] * den[0] + p[1] * den[1]) / dd, (p[1] * den[0] - p[0] * den[1]) / dd];
      return [z[0] - q[0], z[1] - q[1]];
    });
  }
  return roots.sort((a, b) => a[0] - b[0]);
}

export const eigen: FigureCommand = {
  name: 'eigen',
  area: 'Linear algebra',
  example: '/eigen 2 1\n  + 1 2',
  description: 'A matrix and its eigenvalues/eigenvectors. With Compute on, “λ = …” and “v = …” are suggested; for 2×2, written eigenvectors are also drawn.',
  draw(args, tools) {
    const { matrixText, answers } = matrixAndAnswers(args, /^(λ|lambda|l\s*=|v\s*=|≈|eigen)/i);
    const m = parseMatrix(matrixText);
    if (typeof m === 'string') return fail(`${m}. Try: ${firstLine(eigen.example)}`);
    if (m.rows.length !== m.rows[0].length) return fail('Eigenvalues need a square matrix');
    const name = m.name ? toTex(m.name) : 'A';
    let latex = `${name} = ${matrixTex(m.rows, envOf(m))}`;
    if (answers.length) latex = `\\begin{aligned} &${latex} \\\\ ${answers.map((a) => `&${wordsAsText(toTex(a.replace(/^lambda/i, 'λ').replace(/^l\s*=/i, 'λ =')))}`).join(' \\\\ ')} \\end{aligned}`;
    // Draw written 2×2 eigenvectors under the transformation.
    const num = numeric(m, tools);
    const vLine = answers.find((a) => /^v\s*=/i.test(a));
    if (num && num.length === 2 && vLine) {
      const vs = findPairs(vLine, tools);
      if (typeof vs !== 'string' && vs.length) {
        const pic = transformPicture(num.map((r) => r.map((q) => q.valueOf())), vs.map((p) => [p.x, p.y] as [number, number]));
        return { ok: true, html: `<div class="figure-math">${renderMath(latex, true)}</div>${pic}`, latex, notes: [] };
      }
    }
    return { ok: true, latex, notes: [] };
  },
  suggest(args, tools) {
    const { matrixText, answers } = matrixAndAnswers(args, /^(λ|lambda|l\s*=|v\s*=|≈|eigen)/i);
    if (answers.length) return null;
    const m = parseMatrix(matrixText);
    if (typeof m === 'string' || m.rows.length !== m.rows[0].length) return null;
    const num = numeric(m, tools);
    return num ? eigenAnswers(num) : null;
  },
};

// ---- Systems of linear equations ----------------------------------------------------------------

interface LinearSystem { vars: string[]; rows: Q[][]; rhs: Q[]; texts: string[] }

function readSystem(eqs: string[], tools: ArgTools): LinearSystem | string {
  const vars = [...new Set(eqs.flatMap((e) => [...e.matchAll(/(?<![A-Za-z\\])([a-z](?:_?\d+)?)(?![A-Za-z(])/g)].map((m) => m[1])))].sort();
  if (!vars.length) return 'No variables found';
  const rows: Q[][] = [], rhs: Q[] = [];
  for (const e of eqs) {
    const [l, r] = e.split('=');
    if (r === undefined) return `“${e}” isn't an equation`;
    const L = parseExpression(l, { vars, fixName: tools.fixName });
    const R = parseExpression(r, { vars, fixName: tools.fixName });
    if (!L.ok || !R.ok) return `Couldn't read “${e}”`;
    const g = (...xs: number[]) => L.fn(...xs) - R.fn(...xs);
    const zero = vars.map(() => 0);
    const c0 = g(...zero);
    const coeffs = vars.map((_, i) => { const x = [...zero]; x[i] = 1; return g(...x) - c0; });
    // Linear? Check a random point.
    const test = vars.map((_, i) => 1.7 + i * 0.9);
    if (Math.abs(g(...test) - (c0 + coeffs.reduce((s, c, i) => s + c * test[i], 0))) > 1e-7) return `“${e}” is not linear`;
    const qs = coeffs.map((c) => Q.fromNumber(c));
    const b = Q.fromNumber(-c0);
    if (qs.some((q) => !q) || !b) return 'The coefficients need to be simple numbers';
    rows.push(qs as Q[]);
    rhs.push(b);
  }
  return { vars, rows, rhs, texts: eqs };
}

function solveSystem(s: LinearSystem): string {
  let m: M = s.rows.map((r, i) => [...r, s.rhs[i]]);
  const cols = s.vars.length;
  for (let guard = 0; guard < 200; guard++) {
    const op = nextRrefStep(m, cols);
    if (!op) break;
    m = applyOp(m, op);
  }
  // Inconsistent?
  if (m.some((r) => r.slice(0, cols).every((q) => q.isZero()) && !r[cols].isZero())) return 'no solution';
  const pivots: number[] = [];
  m.forEach((r) => { const p = r.slice(0, cols).findIndex((q) => !q.isZero()); if (p >= 0) pivots.push(p); });
  const free = s.vars.map((_, i) => i).filter((i) => !pivots.includes(i));
  const params = ['t', 's', 'u', 'w'];
  const parts: string[] = [];
  m.forEach((r) => {
    const p = r.slice(0, cols).findIndex((q) => !q.isZero());
    if (p < 0) return;
    let expr = r[cols].isZero() && free.length ? '' : r[cols].toString();
    free.forEach((f, k) => {
      const c = r[f].neg();
      if (c.isZero()) return;
      const abs = new Q(Math.abs(c.n), c.d);
      const term = `${abs.equals(Q.ONE) ? '' : abs.toString()}${params[k]}`;
      expr = expr ? `${expr} ${c.n < 0 ? '-' : '+'} ${term}` : `${c.n < 0 ? '-' : ''}${term}`;
    });
    parts.push(`${s.vars[p]} = ${expr || '0'}`);
  });
  free.forEach((f, k) => parts.push(`${s.vars[f]} = ${params[k]}`));
  parts.sort((a, b) => s.vars.indexOf(a.split(' ')[0]) - s.vars.indexOf(b.split(' ')[0]));
  return parts.join(', ');
}

const ANSWER = /^(=>|⇒|⟹|solution|so\b|no solution|∴)/i;

function systemParts(args: string) {
  const clauses = splitClauses(args).flatMap((c) => (ANSWER.test(c) ? [c] : splitTopLevel(c, ',')));
  return { eqs: clauses.filter((c) => !ANSWER.test(c) && c.includes('=')), answers: clauses.filter((c) => ANSWER.test(c)) };
}

export const system: FigureCommand = {
  name: 'system',
  area: 'Linear algebra',
  example: '/system x + y + z = 6\n  + 2x - y = 0\n  + y - z = -1',
  description: 'A system of equations, aligned with a brace. With Compute on, the solution is suggested (“⇒ x = 1, …”).',
  draw(args) {
    const { eqs, answers } = systemParts(args);
    if (!eqs.length) return fail(`Which equations? e.g. ${firstLine(system.example)}`);
    const rows = eqs.map((e) => { const [l, r] = e.split('='); return `${toTex(l.trim())} &= ${toTex(r.trim())}`; });
    let latex = `\\left\\{\\begin{aligned} ${rows.join(' \\\\ ')} \\end{aligned}\\right.`;
    for (const a of answers) latex += ` \\quad \\Longrightarrow \\quad ${/no solution/i.test(a) ? '\\text{no solution}' : wordsAsText(toTex(a.replace(ANSWER, '').trim()))}`;
    return { ok: true, latex, notes: [] };
  },
  suggest(args, tools) {
    const { eqs, answers } = systemParts(args);
    if (!eqs.length || answers.length) return null;
    const s = readSystem(eqs, tools);
    if (typeof s === 'string') return null;
    return [`⇒ ${solveSystem(s)}`];
  },
};

export const vectors: FigureCommand = {
  name: 'vectors',
  area: 'Linear algebra',
  example: '/vectors 2(1, 0, 3) - (2, 1, 1) = (0, -1, 5)',
  description: 'Column vectors in maths text: every (a, b, c) becomes a column. Good for linear combinations and spans.',
  draw(args) {
    const src = splitClauses(args).join(' \\quad ');
    const latex = src.replace(/(?<![A-Za-z])\(([^()]*,[^()]*)\)/g, (_, inner: string) => `\\begin{pmatrix} ${inner.split(',').map((x) => toTex(x.trim())).join(' \\\\ ')} \\end{pmatrix}`)
      .replace(/(?<!\\)\b(span)\b/gi, '\\operatorname{span}');
    return { ok: true, latex: toTex(latex), notes: [] };
  },
};

// ---- Figures ---------------------------------------------------------------------------------

/** The plane before and after a 2×2 matrix: grid, unit square, images of e1 and e2. */
function transformPicture(A: number[][], eigenvectors: [number, number][] = []): string {
  const T = ([x, y]: [number, number]): [number, number] => [A[0][0] * x + A[0][1] * y, A[1][0] * x + A[1][1] * y];
  const corners: [number, number][] = [[2, 2], [-2, 2], [2, -2], [-2, -2]].map((p) => T(p as [number, number]));
  const R = Math.max(2.5, ...corners.flat().map(Math.abs)) * 1.05;
  const frame = makeFrame([-R, R], [-R, R], { equal: true, width: 400, height: 400 });
  const clip = clipToBox(frame);
  let inner = '';
  const L = Math.ceil(R) + 2;
  for (let k = -L; k <= L; k++) {
    for (const [p, q] of [[[k, -L], [k, L]], [[-L, k], [L, k]]] as [number, number][][]) {
      const [a, b] = [T(p as [number, number]), T(q as [number, number])];
      inner += line(frame.sx(a[0]), frame.sy(a[1]), frame.sx(b[0]), frame.sy(b[1]), { stroke: COLORS[0], 'stroke-opacity': k === 0 ? 0.5 : 0.22, 'stroke-width': 1 });
    }
  }
  const sq: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
  inner += path(polyline(frame, sq, true), { ...DASHED, 'stroke-width': 1.2, 'stroke-opacity': 0.6 });
  inner += path(polyline(frame, sq.map(T), true), { fill: COLORS[0], 'fill-opacity': 0.18, stroke: COLORS[0], 'stroke-width': 1.5 });
  for (const v of eigenvectors) {
    const len = Math.hypot(v[0], v[1]) || 1;
    const [ux, uy] = [(v[0] / len) * R * 2, (v[1] / len) * R * 2];
    inner += line(frame.sx(-ux), frame.sy(-uy), frame.sx(ux), frame.sy(uy), { stroke: COLORS[2], 'stroke-width': 2, ...DASHED });
  }
  let body = clip.defs + drawAxes(frame, { grid: false }) + `<g clip-path="${clip.attr}">${inner}</g>`;
  const e1 = T([1, 0]), e2 = T([0, 1]);
  body += arrow(frame.sx(0), frame.sy(0), frame.sx(e1[0]), frame.sy(e1[1]), { stroke: COLORS[1], 'stroke-width': 2.4 });
  body += arrow(frame.sx(0), frame.sy(0), frame.sx(e2[0]), frame.sy(e2[1]), { stroke: COLORS[3], 'stroke-width': 2.4 });
  body += text(frame.sx(e1[0]) + 5, frame.sy(e1[1]) + 14, 'Ae₁', { fill: COLORS[1], 'font-style': 'italic', 'font-size': 13 });
  body += text(frame.sx(e2[0]) + 5, frame.sy(e2[1]) - 5, 'Ae₂', { fill: COLORS[3], 'font-style': 'italic', 'font-size': 13 });
  return svg(frame.width, frame.height, body, 'Linear transformation');
}

export const transform: FigureCommand = {
  name: 'transform',
  area: 'Linear algebra',
  example: '/transform 1 1\n  + 0 1',
  description: 'What a 2×2 matrix does to the plane: the grid, the unit square and the images of e₁ and e₂.',
  draw(args, tools) {
    const m = parseMatrix(splitClauses(args).join('; '));
    if (typeof m === 'string') return fail(`${m}. Try: ${firstLine(transform.example)}`);
    if (m.rows.length !== 2 || m.rows[0].length !== 2) return fail('Give a 2×2 matrix, like 1 1; 0 1');
    const A = m.rows.map((r) => r.map((e) => parseNumber(e, tools.fixName)));
    if (A.flat().some((v) => v === null)) return fail('The entries need to be numbers');
    return { ok: true, svg: transformPicture(A as number[][]), notes: [] };
  },
};

function planeVectorsPicture(vs: { x: number; y: number; name: string | null }[], extra: (f: Frame) => string, label: string, R?: number) {
  const r = R ?? Math.max(2, ...vs.flatMap((v) => [Math.abs(v.x), Math.abs(v.y)])) * 1.3;
  const frame = makeFrame([-r, r], [-r, r], { equal: true, width: 380, height: 380 });
  const clip = clipToBox(frame);
  let body = clip.defs + drawAxes(frame) + `<g clip-path="${clip.attr}">${extra(frame)}</g>`;
  vs.forEach((v, i) => {
    const color = COLORS[i % COLORS.length];
    body += arrow(frame.sx(0), frame.sy(0), frame.sx(v.x), frame.sy(v.y), { stroke: color, 'stroke-width': 2.4 });
    body += text(frame.sx(v.x) + 6, frame.sy(v.y) - 6, v.name ?? `(${fmt(v.x)}, ${fmt(v.y)})`, { fill: color, 'font-style': 'italic', 'font-size': 13 });
  });
  return svg(frame.width, frame.height, body, label);
}

export const span: FigureCommand = {
  name: 'span',
  area: 'Linear algebra',
  example: '/span (1, 2)',
  description: 'The span of vectors: a line (one vector, or dependent ones) or the whole plane; in 3D a line or a plane.',
  draw(args, tools) {
    const triples = findTriples(args, tools);
    if (typeof triples !== 'string' && triples.length) {
      const scene = new Scene3();
      const vs = triples.map((t) => t.v);
      const L = Math.max(2, ...vs.flat().map(Math.abs)) * 1.3;
      scene.axes([L, L, L], [L * 0.4, L * 0.4, L * 0.4]);
      const independent2 = vs.length >= 2 && norm3(cross(vs[0], vs[1])) > 1e-9;
      if (independent2) {
        const [u, w] = vs;
        const k = 1.2;
        const c: V3[] = [[-k, -k], [k, -k], [k, k], [-k, k]].map(([a, b]) => [a * u[0] + b * w[0], a * u[1] + b * w[1], a * u[2] + b * w[2]]);
        scene.face(c, { color: COLORS[0], fillOpacity: 0.18, width: 1 });
      } else {
        const u = vs[0];
        scene.segment([-2 * u[0], -2 * u[1], -2 * u[2]], [2 * u[0], 2 * u[1], 2 * u[2]], { color: COLORS[0], dashed: true, width: 1.5 });
      }
      vs.forEach((v, i) => scene.arrow([0, 0, 0], v, { color: COLORS[i % COLORS.length], width: 2.4 }));
      const note = vs.length >= 3 && Math.abs(vs[0][0] * (vs[1][1] * vs[2][2] - vs[1][2] * vs[2][1]) - vs[0][1] * (vs[1][0] * vs[2][2] - vs[1][2] * vs[2][0]) + vs[0][2] * (vs[1][0] * vs[2][1] - vs[1][1] * vs[2][0])) > 1e-9 ? ['three independent vectors: their span is all of space'] : [];
      return { ok: true, svg: scene.render('Span'), notes: note };
    }
    const pairs = findPairs(args, tools);
    if (typeof pairs === 'string') return fail(pairs);
    if (!pairs.length) return fail(`Which vectors? e.g. ${span.example}`);
    const dependent = pairs.every((p) => Math.abs(p.x * pairs[0].y - p.y * pairs[0].x) < 1e-12);
    const svgText = planeVectorsPicture(pairs, (f) => {
      if (!dependent) return el('rect', { x: f.box.left, y: f.box.top, width: f.box.right - f.box.left, height: f.box.bottom - f.box.top, fill: COLORS[0], 'fill-opacity': 0.1 });
      const u = pairs.find((p) => p.x !== 0 || p.y !== 0);
      if (!u) return '';
      const k = 100;
      return line(f.sx(-k * u.x), f.sy(-k * u.y), f.sx(k * u.x), f.sy(k * u.y), { stroke: COLORS[0], 'stroke-width': 2, ...DASHED });
    }, 'Span');
    return { ok: true, svg: svgText, notes: [dependent ? 'the span is a line through the origin' : 'the span is the whole plane'] };
  },
};

export const projection: FigureCommand = {
  name: 'projection',
  area: 'Linear algebra',
  example: '/projection (3, 1) onto (1, 2)',
  description: 'The projection of u onto v, with the perpendicular part dashed.',
  draw(args, tools) {
    const p = findPairs(args, tools);
    if (typeof p === 'string') return fail(p);
    if (p.length < 2) return fail(`Give two vectors: ${projection.example}`);
    const [u, v] = p;
    const k = (u.x * v.x + u.y * v.y) / (v.x * v.x + v.y * v.y || 1);
    const pr = { x: k * v.x, y: k * v.y };
    const svgText = planeVectorsPicture([{ ...u, name: u.name ?? 'u' }, { ...v, name: v.name ?? 'v' }], (f) => {
      let out = line(f.sx(-50 * v.x), f.sy(-50 * v.y), f.sx(50 * v.x), f.sy(50 * v.y), { 'stroke-width': 0.8, 'stroke-opacity': 0.3 });
      out += line(f.sx(u.x), f.sy(u.y), f.sx(pr.x), f.sy(pr.y), { ...DASHED, 'stroke-width': 1.4 });
      out += arrow(f.sx(0), f.sy(0), f.sx(pr.x), f.sy(pr.y), { stroke: COLORS[2], 'stroke-width': 3.2 });
      out += text(f.sx(pr.x) + 6, f.sy(pr.y) + 16, 'proj', { fill: COLORS[2], 'font-size': 12, 'font-style': 'italic' });
      // Right-angle mark at the foot.
      const lv = Math.hypot(v.x, v.y) || 1, s = 0.18 * Math.max(1, Math.hypot(u.x, u.y) / 3);
      const [vx, vy] = [v.x / lv, v.y / lv];
      const wx = u.x - pr.x, wy = u.y - pr.y, lw = Math.hypot(wx, wy) || 1;
      const [nx, ny] = [wx / lw, wy / lw];
      const dir = k >= 0 ? -1 : 1;
      const a = [pr.x + dir * vx * s, pr.y + dir * vy * s], b = [a[0] + nx * s, a[1] + ny * s], c = [pr.x + nx * s, pr.y + ny * s];
      out += path(`M${f.sx(a[0])},${f.sy(a[1])}L${f.sx(b[0])},${f.sy(b[1])}L${f.sx(c[0])},${f.sy(c[1])}`, { 'stroke-width': 1 });
      return out;
    }, 'Projection');
    return { ok: true, svg: svgText, notes: [] };
  },
};

export const lines: FigureCommand = {
  name: 'lines',
  area: 'Linear algebra',
  example: '/lines x + y = 3\n  + x - 2y = 0',
  description: 'Linear equations in x and y drawn as lines (a 2×2 system); where they meet is marked.',
  draw(args, tools) {
    const eqs = splitClauses(args).flatMap((c) => splitTopLevel(c, ','));
    const s = readSystem(eqs, tools);
    if (typeof s === 'string') return fail(`${s}. Try: ${firstLine(lines.example)}`);
    const xi = s.vars.indexOf('x'), yi = s.vars.indexOf('y');
    if (s.vars.some((v) => v !== 'x' && v !== 'y')) return fail('Use x and y only');
    const ls = s.rows.map((r, i) => ({ a: xi >= 0 ? r[xi].valueOf() : 0, b: yi >= 0 ? r[yi].valueOf() : 0, c: s.rhs[i].valueOf(), text: s.texts[i] }));
    // Where pairs of lines meet.
    const meets: [number, number][] = [];
    for (let i = 0; i < ls.length; i++) for (let j = i + 1; j < ls.length; j++) {
      const d = ls[i].a * ls[j].b - ls[i].b * ls[j].a;
      if (Math.abs(d) > 1e-12) meets.push([(ls[i].c * ls[j].b - ls[i].b * ls[j].c) / d, (ls[i].a * ls[j].c - ls[i].c * ls[j].a) / d]);
    }
    const R = Math.max(4, ...meets.flat().map((v) => Math.abs(v) * 1.5));
    const frame = makeFrame([-R, R], [-R, R], { equal: true, width: 400, height: 380 });
    const clip = clipToBox(frame);
    let inner = '';
    ls.forEach((l, i) => {
      const color = COLORS[i % COLORS.length];
      const pts: [number, number][] = Math.abs(l.b) > 1e-12
        ? [[-R * 2, (l.c - l.a * -R * 2) / l.b], [R * 2, (l.c - l.a * R * 2) / l.b]]
        : [[l.c / l.a, -R * 2], [l.c / l.a, R * 2]];
      inner += path(polyline(frame, pts), { stroke: color, 'stroke-width': 2.2 });
    });
    let body = clip.defs + drawAxes(frame) + `<g clip-path="${clip.attr}">${inner}</g>`;
    for (const [x, y] of meets) body += dot(frame, x, y, { r: 4.5 });
    ls.forEach((l, i) => {
      body += text(frame.box.left + 8, frame.box.top + 16 + i * 18, l.text, { fill: COLORS[i % COLORS.length], 'font-size': 13, 'font-style': 'italic' });
    });
    return { ok: true, svg: svg(frame.width, frame.height, body, 'Lines'), notes: [] };
  },
};

export const parallelogram: FigureCommand = {
  name: 'parallelogram',
  area: 'Linear algebra',
  example: '/parallelogram (3, 0) (1, 2)',
  description: 'The parallelogram spanned by two vectors (its area is |det|). Given vertex names instead (ABCD), draws the shape.',
  draw(args, tools) {
    const p = findPairs(args, tools);
    if (typeof p === 'string' || p.length < 2) return delegateToPolygon(args, tools);
    const [u, v] = p;
    const s = { x: u.x + v.x, y: u.y + v.y };
    const svgText = planeVectorsPicture([{ ...u, name: u.name ?? 'u' }, { ...v, name: v.name ?? 'v' }], (f) =>
      path(polyline(f, [[0, 0], [u.x, u.y], [s.x, s.y], [v.x, v.y]], true), { fill: COLORS[0], 'fill-opacity': 0.15, stroke: COLORS[0], 'stroke-width': 1, ...DASHED }),
    'Parallelogram', Math.max(2, Math.abs(s.x), Math.abs(s.y), Math.abs(u.x), Math.abs(u.y), Math.abs(v.x), Math.abs(v.y)) * 1.25);
    return { ok: true, svg: svgText, notes: [] };
  },
};

/** Set by the geometry module, to draw /parallelogram ABCD as a polygon. */
let polygonDraw: FigureCommand['draw'] | null = null;
export function setPolygonDelegate(draw: FigureCommand['draw']) { polygonDraw = draw; }
function delegateToPolygon(args: string, tools: ArgTools) {
  return polygonDraw ? polygonDraw(`parallelogram ${args}`, tools) : fail(`Give two vectors: ${parallelogram.example}`);
}

export const LINALG_COMMANDS: FigureCommand[] = [
  matrix, augmented, rowops, detCommand, inverseCommand, eigen, system, vectors, transform, span, projection, lines, parallelogram,
];
