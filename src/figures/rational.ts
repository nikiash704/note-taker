// Exact fractions and small matrices, so linear algebra answers come out as
// 1/2 rather than 0.49999999.

export class Q {
  readonly n: number;
  readonly d: number;

  constructor(n: number, d = 1) {
    if (d === 0) throw new Error('division by zero');
    if (d < 0) { n = -n; d = -d; }
    const g = gcd(Math.abs(n), d) || 1;
    this.n = n / g;
    this.d = d / g;
  }

  static readonly ZERO = new Q(0);
  static readonly ONE = new Q(1);

  /** The simplest fraction close to x (denominators up to 10 000). */
  static fromNumber(x: number): Q | null {
    if (!Number.isFinite(x)) return null;
    if (Number.isInteger(x)) return new Q(x);
    // Continued fractions.
    let [h0, h1, k0, k1] = [0, 1, 1, 0];
    let v = x;
    for (let i = 0; i < 30; i++) {
      const a = Math.floor(v);
      [h0, h1] = [h1, a * h1 + h0];
      [k0, k1] = [k1, a * k1 + k0];
      if (k1 > 10000) return null;
      if (Math.abs(h1 / k1 - x) < 1e-9) return new Q(h1, k1);
      v = 1 / (v - a);
      if (!Number.isFinite(v)) break;
    }
    return Math.abs(h1 / k1 - x) < 1e-9 ? new Q(h1, k1) : null;
  }

  add(o: Q) { return new Q(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o: Q) { return new Q(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o: Q) { return new Q(this.n * o.n, this.d * o.d); }
  div(o: Q) { return new Q(this.n * o.d, this.d * o.n); }
  neg() { return new Q(-this.n, this.d); }
  isZero() { return this.n === 0; }
  equals(o: Q) { return this.n === o.n && this.d === o.d; }
  valueOf() { return this.n / this.d; }

  /** Plain text: "-1/2", "3". */
  toString() { return this.d === 1 ? String(this.n) : `${this.n}/${this.d}`; }

  /** LaTeX: "-\frac{1}{2}". */
  toTex() {
    if (this.d === 1) return String(this.n);
    return `${this.n < 0 ? '-' : ''}\\frac{${Math.abs(this.n)}}{${this.d}}`;
  }
}

export function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}

/** "3", "-1/2", "0.25", "(2/3)" → Q. */
export function parseQ(text: string): Q | null {
  const t = text.trim().replace(/^\((.*)\)$/, '$1').replace(/[−–]/g, '-').replace(/\s+/g, '');
  const frac = t.match(/^([+-]?\d+)\/([+-]?\d+)$/);
  if (frac) return Number(frac[2]) === 0 ? null : new Q(Number(frac[1]), Number(frac[2]));
  if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(t)) return Q.fromNumber(Number(t));
  return null;
}

// ---- Matrices ---------------------------------------------------------------------

export type M = Q[][];

export const clone = (m: M): M => m.map((r) => [...r]);

export function identity(n: number): M {
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? Q.ONE : Q.ZERO)));
}

export function det(m: M): Q {
  const a = clone(m);
  const n = a.length;
  let result = Q.ONE;
  for (let c = 0; c < n; c++) {
    let p = c;
    while (p < n && a[p][c].isZero()) p++;
    if (p === n) return Q.ZERO;
    if (p !== c) { [a[p], a[c]] = [a[c], a[p]]; result = result.neg(); }
    result = result.mul(a[c][c]);
    for (let r = c + 1; r < n; r++) {
      const f = a[r][c].div(a[c][c]);
      for (let k = c; k < n; k++) a[r][k] = a[r][k].sub(f.mul(a[c][k]));
    }
  }
  return result;
}

export function inverse(m: M): M | null {
  const n = m.length;
  const a = m.map((row, i) => [...row, ...identity(n)[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    while (p < n && a[p][c].isZero()) p++;
    if (p === n) return null;
    [a[p], a[c]] = [a[c], a[p]];
    const piv = a[c][c];
    a[c] = a[c].map((x) => x.div(piv));
    for (let r = 0; r < n; r++) {
      if (r === c || a[r][c].isZero()) continue;
      const f = a[r][c];
      a[r] = a[r].map((x, k) => x.sub(f.mul(a[c][k])));
    }
  }
  return a.map((row) => row.slice(n));
}

// ---- Row operations -----------------------------------------------------------------

export type RowOp =
  | { kind: 'swap'; i: number; j: number }
  | { kind: 'scale'; i: number; k: Q }
  | { kind: 'add'; i: number; j: number; k: Q }; // R_i → R_i + k·R_j

export function applyOp(m: M, op: RowOp): M {
  const a = clone(m);
  if (op.kind === 'swap') [a[op.i], a[op.j]] = [a[op.j], a[op.i]];
  else if (op.kind === 'scale') a[op.i] = a[op.i].map((x) => x.mul(op.k));
  else a[op.i] = a[op.i].map((x, c) => x.add(op.k.mul(a[op.j][c])));
  return a;
}

/** Plain text that parseRowOp() reads back: "R1 <-> R2", "1/2 R1", "R2 - 3R1". */
export function opText(op: RowOp): string {
  const R = (i: number) => `R${i + 1}`;
  if (op.kind === 'swap') return `${R(op.i)} <-> ${R(op.j)}`;
  if (op.kind === 'scale') return `${op.k.toString()} ${R(op.i)}`;
  const k = op.k;
  const sign = k.n < 0 ? '-' : '+';
  const abs = new Q(Math.abs(k.n), k.d);
  return `${R(op.i)} ${sign} ${abs.equals(Q.ONE) ? '' : abs.toString()}${R(op.j)}`;
}

/** LaTeX label for an arrow: "R_2 \to R_2 - 3R_1". */
export function opTex(op: RowOp): string {
  const R = (i: number) => `R_{${i + 1}}`;
  if (op.kind === 'swap') return `${R(op.i)} \\leftrightarrow ${R(op.j)}`;
  if (op.kind === 'scale') return `${R(op.i)} \\to ${op.k.equals(new Q(-1)) ? '-' : op.k.toTex()}${R(op.i)}`;
  const abs = new Q(Math.abs(op.k.n), op.k.d);
  return `${R(op.i)} \\to ${R(op.i)} ${op.k.n < 0 ? '-' : '+'} ${abs.equals(Q.ONE) ? '' : abs.toTex()}${R(op.j)}`;
}

/** Read "R2 - 3R1", "R2 -> R2 - 3R1", "R1 <-> R2", "swap R1 R2", "1/2 R1", "R1/2". */
export function parseRowOp(text: string, rows: number): RowOp | string {
  const t = text.replace(/\s+/g, '').replace(/[−–]/g, '-').replace(/→/g, '->').replace(/↔/g, '<->').replace(/r(?=\d)/g, 'R');
  const idx = (s: string) => {
    const i = Number(s) - 1;
    return i >= 0 && i < rows ? i : -1;
  };
  const swap = t.match(/^(?:swap)?R(\d+)(?:<->|<>|,)?R(\d+)$/i) ?? t.match(/^R(\d+)<->R(\d+)$/);
  if (swap && (/swap/i.test(t) || /<->|<>/.test(t))) {
    const [i, j] = [idx(swap[1]), idx(swap[2])];
    if (i < 0 || j < 0) return `There is no row ${i < 0 ? swap[1] : swap[2]}`;
    return { kind: 'swap', i, j };
  }
  let target = -1;
  let rhs = t;
  const assign = t.match(/^R(\d+)(?:->|=|:=)(.+)$/);
  if (assign) { target = idx(assign[1]); rhs = assign[2]; }
  const compound = t.match(/^R(\d+)([+-])=(.+)$/);
  if (compound) { target = idx(compound[1]); rhs = `R${compound[1]}${compound[2]}${compound[3]}`; }
  // Terms like +3R1, -1/2R2, R2/2, (2/3)R1
  const terms: { k: Q; i: number }[] = [];
  const re = /([+-]?)(\(?\d+(?:\/\d+)?\)?|\d*\.\d+)?\*?R(\d+)(?:\/(\d+))?/g;
  const body = rhs.replace(/^\((.*)\)$/, '$1');
  let consumed = '';
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    consumed += m[0];
    const sign = m[1] === '-' ? -1 : 1;
    const coefText = (m[2] ?? '1').replace(/[()]/g, '');
    const c = coefText.includes('/') ? new Q(Number(coefText.split('/')[0]), Number(coefText.split('/')[1])) : Q.fromNumber(Number(coefText));
    if (!c) return `Couldn't read “${text}”`;
    let k = c.mul(new Q(sign));
    if (m[4]) k = k.div(new Q(Number(m[4])));
    const i = idx(m[3]);
    if (i < 0) return `There is no row ${m[3]}`;
    terms.push({ k, i });
  }
  const flat = body;
  if (!terms.length || consumed.replace(/^\+/, '') !== flat.replace(/^\+/, '')) return `Couldn't read the row operation “${text}”. Try R2 - 3R1, 1/2 R1 or R1 <-> R2`;
  if (target < 0) target = terms[0].i;
  const self = terms.filter((x) => x.i === target).reduce((s, x) => s.add(x.k), Q.ZERO);
  const others = terms.filter((x) => x.i !== target);
  if (others.length === 0) {
    if (self.isZero()) return 'That would multiply a row by 0, which is not allowed';
    return { kind: 'scale', i: target, k: self };
  }
  if (others.length === 1 && self.equals(Q.ONE)) return { kind: 'add', i: target, j: others[0].i, k: others[0].k };
  return `Do one step at a time, like R2 - 3R1 (the row being changed must keep coefficient 1)`;
}

/** The next step of Gauss–Jordan elimination, or null if already in reduced row echelon form. */
export function nextRrefStep(m: M, cols = m[0]?.length ?? 0): RowOp | null {
  const rows = m.length;
  let pivotRow = 0;
  for (let c = 0; c < cols && pivotRow < rows; c++) {
    // Find a pivot in this column at or below pivotRow.
    let p = -1;
    for (let r = pivotRow; r < rows; r++) if (!m[r][c].isZero()) { p = r; break; }
    if (p < 0) continue;
    if (p !== pivotRow) return { kind: 'swap', i: pivotRow, j: p };
    if (!m[pivotRow][c].equals(Q.ONE)) return { kind: 'scale', i: pivotRow, k: Q.ONE.div(m[pivotRow][c]) };
    for (let r = 0; r < rows; r++) {
      if (r !== pivotRow && !m[r][c].isZero()) return { kind: 'add', i: r, j: pivotRow, k: m[r][c].neg() };
    }
    pivotRow++;
  }
  return null;
}
