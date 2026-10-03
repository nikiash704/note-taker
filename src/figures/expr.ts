// A small, forgiving math expression reader used by every figure.
// It accepts the way people jot formulas down:
//   sin x, sin(x), 2x, x^2, x², 2pi, |x|, e^-x, sin^2 x, \sin x, sqrt 2, xy
// It builds a tiny syntax tree, which can then be turned into a plain
// JavaScript function of real numbers, or of complex numbers. No eval.

export type Fn = (...args: number[]) => number;

/** The syntax tree. */
export type Node =
  | { k: 'num'; v: number }
  | { k: 'var'; name: string }
  | { k: 'const'; name: string }
  | { k: 'neg'; a: Node }
  | { k: 'add' | 'sub' | 'mul' | 'div' | 'pow'; a: Node; b: Node }
  | { k: 'call'; f: string; a: Node }
  | { k: 'fact'; a: Node };

export interface ParseOk {
  ok: true;
  /** The expression as a function of the variables, in the order given. */
  fn: Fn;
  ast: Node;
  /** True if the expression mentions any variable. */
  usesVar: boolean;
  /** Which variables it mentions. */
  used: Set<string>;
  /** Friendly notes about names that were auto-corrected, e.g. "sni → sin". */
  corrections: string[];
}
export interface ParseError {
  ok: false;
  message: string;
}
export type ParseResult = ParseOk | ParseError;

const REAL_FUNCTIONS: Record<string, (x: number) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  sec: (x) => 1 / Math.cos(x), csc: (x) => 1 / Math.sin(x), cot: (x) => 1 / Math.tan(x),
  asin: Math.asin, acos: Math.acos, atan: Math.atan,
  arcsin: Math.asin, arccos: Math.acos, arctan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs,
  ln: Math.log, log: Math.log10, exp: Math.exp,
  floor: Math.floor, ceil: Math.ceil, round: Math.round, sgn: Math.sign, sign: Math.sign,
};

/** Only meaningful for complex numbers (z = x + iy). */
const COMPLEX_ONLY = ['re', 'im', 'conj', 'arg'];

const CONSTANTS: Record<string, number> = {
  pi: Math.PI, e: Math.E, tau: 2 * Math.PI, inf: Infinity, infty: Infinity, infinity: Infinity, oo: Infinity,
};

export const KNOWN_NAMES = [...Object.keys(REAL_FUNCTIONS), ...Object.keys(CONSTANTS)];

export interface ParseOptions {
  /** Variable names allowed, e.g. ["x"], ["x", "y"], ["t"]. Empty for plain numbers. */
  vars?: string[];
  /** Allow i (the imaginary unit) and Re, Im, conj, arg. */
  complex?: boolean;
  /** Suggest a known name for an unknown word (typo tolerance). */
  fixName?: (word: string) => string | null;
}

// ---- Tokens -----------------------------------------------------------------

type Token =
  | { t: 'num'; v: number }
  | { t: 'name'; v: string }
  | { t: 'op'; v: string };

const UNICODE: [RegExp, string][] = [
  [/π/g, ' pi '], [/τ/g, ' tau '], [/∞/g, ' inf '], [/√/g, ' sqrt '], [/θ/g, ' theta '], [/φ/g, ' phi '],
  [/λ/g, ' lambda '], [/μ/g, ' mu '], [/σ/g, ' sigma '],
  [/[−–]/g, '-'], [/[×·⋅]/g, '*'], [/÷/g, '/'], [/²/g, '^2'], [/³/g, '^3'],
  [/\*\*/g, '^'], [/\\(left|right)\b/g, ''], [/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '(($1)/($2))'],
  [/\\(cdot|times)\b/g, '*'], [/\\/g, ' '],
];

function tokenize(src: string): Token[] | string {
  for (const [re, rep] of UNICODE) src = src.replace(re, rep);
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    const num = src.slice(i).match(/^(\d+\.?\d*|\.\d+)/);
    if (num) {
      tokens.push({ t: 'num', v: parseFloat(num[0]) });
      i += num[0].length;
    } else if (/[A-Za-z]/.test(c)) {
      const word = src.slice(i).match(/^[A-Za-z]+/)![0];
      tokens.push({ t: 'name', v: word });
      i += word.length;
    } else if (c === '_' && /[A-Za-z0-9]/.test(src[i + 1] ?? '')) {
      // Subscripts like x_1 are part of a variable name: glue them on.
      const sub = src.slice(i + 1).match(/^[A-Za-z0-9]+/)![0];
      const last = tokens[tokens.length - 1];
      if (last?.t === 'name') last.v += '_' + sub;
      i += sub.length + 1;
    } else if ('+-*/^()[]{}|!,\''.includes(c)) {
      tokens.push({ t: 'op', v: c === '[' || c === '{' ? '(' : c === ']' || c === '}' ? ')' : c });
      i++;
    } else {
      return `Unexpected “${c}”`;
    }
  }
  return tokens;
}

/**
 * Split a run of letters into known names: "xsinx" → x sin x, "2pix" → pi x.
 * Longest match wins at each position. Returns null if something is unknown.
 */
function splitWord(word: string, vocab: string[]): string[] | null {
  if (vocab.includes(word)) return [word];
  const lower = word.toLowerCase();
  const parts: string[] = [];
  let i = 0;
  while (i < lower.length) {
    let best = '';
    for (const name of vocab) {
      if (name.length > best.length && lower.startsWith(name.toLowerCase(), i)) best = name;
    }
    if (!best) return null;
    parts.push(best);
    i += best.length;
  }
  return parts;
}

// ---- Parser (recursive descent) ---------------------------------------------------

export function parseExpression(src: string, opts: ParseOptions = {}): ParseResult {
  const vars = opts.vars ?? [];
  const raw = tokenize(src);
  if (typeof raw === 'string') return { ok: false, message: raw };

  const functions = [...Object.keys(REAL_FUNCTIONS), ...(opts.complex ? COMPLEX_ONLY : [])];
  const constants = [...Object.keys(CONSTANTS), ...(opts.complex ? ['i'] : [])];
  const vocab = [...functions, ...constants, ...vars];
  const corrections: string[] = [];
  const tokens: Token[] = [];
  for (const tok of raw) {
    if (tok.t !== 'name') { tokens.push(tok); continue; }
    // Variables like x_1 or theta are matched whole first.
    let parts = vars.includes(tok.v) ? [tok.v] : splitWord(tok.v, vocab);
    if (!parts) {
      const fixed = opts.fixName?.(tok.v.toLowerCase());
      if (fixed && vocab.includes(fixed)) {
        corrections.push(`${tok.v} → ${fixed}`);
        parts = [fixed];
      } else {
        const hint = vars.length === 1 ? ` (the variable is ${vars[0]})` : vars.length > 1 ? ` (the variables are ${vars.join(', ')})` : '';
        return { ok: false, message: `Unknown name “${tok.v}”${hint}` };
      }
    }
    for (const p of parts) tokens.push({ t: 'name', v: p });
  }

  let pos = 0;
  let absDepth = 0;
  const used = new Set<string>();
  const peek = () => tokens[pos];
  const isOp = (v: string) => peek()?.t === 'op' && peek()!.v === v;
  const isFunc = (tok?: Token) => tok?.t === 'name' && functions.includes(tok.v);

  /** Can the next token begin a factor? (for implicit multiplication like 2x) */
  const startsFactor = () => {
    const tok = peek();
    if (!tok) return false;
    if (tok.t !== 'op') return true;
    return tok.v === '(' || (tok.v === '|' && absDepth === 0);
  };

  class Fail extends Error {}
  const fail = (msg: string): never => { throw new Fail(msg); };

  function expression(): Node {
    let left = term();
    while (isOp('+') || isOp('-')) {
      const op = tokens[pos++].v;
      left = { k: op === '+' ? 'add' : 'sub', a: left, b: term() };
    }
    return left;
  }

  function term(): Node {
    let left = unary();
    for (;;) {
      if (isOp('*') || isOp('/')) {
        const op = tokens[pos++].v;
        left = { k: op === '*' ? 'mul' : 'div', a: left, b: unary() };
      } else if (startsFactor()) {
        left = { k: 'mul', a: left, b: power() };
      } else {
        return left;
      }
    }
  }

  function unary(): Node {
    if (isOp('-')) { pos++; return { k: 'neg', a: unary() }; }
    if (isOp('+')) { pos++; return unary(); }
    return power();
  }

  function power(): Node {
    const base = postfix();
    if (isOp('^')) {
      pos++;
      return { k: 'pow', a: base, b: unary() };
    }
    return base;
  }

  function postfix(): Node {
    let a = atom();
    for (;;) {
      if (isOp('!')) { pos++; a = { k: 'fact', a }; }
      else if (isOp('\'')) { pos++; } // primes (y') are ignored here
      else return a;
    }
  }

  function atom(): Node {
    const tok = tokens[pos++];
    if (!tok) return fail('The formula ends too early');
    if (tok.t === 'num') return { k: 'num', v: tok.v };
    if (tok.t === 'op') {
      if (tok.v === '(') {
        const inner = expression();
        if (!isOp(')')) fail('Missing “)”');
        pos++;
        return inner;
      }
      if (tok.v === '|') {
        absDepth++;
        const inner = expression();
        absDepth--;
        if (!isOp('|')) fail('Missing closing “|”');
        pos++;
        return { k: 'call', f: 'abs', a: inner };
      }
      return fail(`Unexpected “${tok.v}”`);
    }
    const name = tok.v;
    if (vars.includes(name)) { used.add(name); return { k: 'var', name }; }
    if (constants.includes(name)) return { k: 'const', name };
    return applyFunction(name);
  }

  /** sin(x), sin x, sin 2x, sin^2 x */
  function applyFunction(f: string): Node {
    let exponent: Node | null = null;
    if (isOp('^')) { pos++; exponent = unary(); }
    let arg: Node;
    if (isOp('(')) {
      pos++;
      arg = expression();
      if (!isOp(')')) fail('Missing “)”');
      pos++;
    } else {
      // No parentheses: the argument is the following product, stopping at
      // the next function name, so "sin x cos x" means sin(x)·cos(x).
      arg = unary();
      while (startsFactor() && !isFunc(peek())) arg = { k: 'mul', a: arg, b: power() };
    }
    const call: Node = { k: 'call', f, a: arg };
    return exponent ? { k: 'pow', a: call, b: exponent } : call;
  }

  try {
    if (tokens.length === 0) return { ok: false, message: 'Nothing to read' };
    const ast = expression();
    if (pos < tokens.length) {
      const tok = tokens[pos];
      return { ok: false, message: `Didn't expect “${tok.v}” here` };
    }
    return { ok: true, fn: compileReal(ast, vars), ast, usesVar: used.size > 0, used, corrections };
  } catch (e) {
    if (e instanceof Fail) return { ok: false, message: e.message };
    throw e;
  }
}

// ---- Real numbers ---------------------------------------------------------------

export function compileReal(ast: Node, vars: string[]): Fn {
  const build = (n: Node): ((env: number[]) => number) => {
    switch (n.k) {
      case 'num': { const v = n.v; return () => v; }
      case 'var': { const i = vars.indexOf(n.name); return (env) => env[i]; }
      case 'const': { const v = CONSTANTS[n.name] ?? NaN; return () => v; }
      case 'neg': { const a = build(n.a); return (env) => -a(env); }
      case 'add': { const a = build(n.a), b = build(n.b); return (env) => a(env) + b(env); }
      case 'sub': { const a = build(n.a), b = build(n.b); return (env) => a(env) - b(env); }
      case 'mul': { const a = build(n.a), b = build(n.b); return (env) => a(env) * b(env); }
      case 'div': { const a = build(n.a), b = build(n.b); return (env) => a(env) / b(env); }
      case 'pow': { const a = build(n.a), b = build(n.b); return (env) => realPow(a(env), b(env)); }
      case 'fact': { const a = build(n.a); return (env) => factorial(a(env)); }
      case 'call': {
        const f = REAL_FUNCTIONS[n.f];
        const a = build(n.a);
        if (f) return (env) => f(a(env));
        // Re, Im, conj, arg of a real number.
        if (n.f === 're' || n.f === 'conj') return a;
        if (n.f === 'im') return () => 0;
        if (n.f === 'arg') return (env) => (a(env) < 0 ? Math.PI : 0);
        return () => NaN;
      }
    }
  };
  const run = build(ast);
  return (...args: number[]) => run(args);
}

/** x^(1/3) of a negative x should be the real cube root, as on a calculator. */
function realPow(a: number, b: number): number {
  if (a < 0 && !Number.isInteger(b)) {
    const inv = 1 / b;
    if (Number.isInteger(Math.round(inv)) && Math.abs(inv - Math.round(inv)) < 1e-9 && Math.round(inv) % 2 !== 0) {
      return -Math.pow(-a, b);
    }
  }
  return Math.pow(a, b);
}

function factorial(n: number): number {
  if (n < 0 || !Number.isInteger(n)) return NaN;
  let r = 1;
  for (let i = 2; i <= n && r < Infinity; i++) r *= i;
  return r;
}

// ---- Complex numbers --------------------------------------------------------------

export type C = [number, number];

const cAdd = (a: C, b: C): C => [a[0] + b[0], a[1] + b[1]];
const cSub = (a: C, b: C): C => [a[0] - b[0], a[1] - b[1]];
const cMul = (a: C, b: C): C => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const cDiv = (a: C, b: C): C => {
  const d = b[0] * b[0] + b[1] * b[1];
  return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
};
const cExp = (a: C): C => { const r = Math.exp(a[0]); return [r * Math.cos(a[1]), r * Math.sin(a[1])]; };
const cLog = (a: C): C => [Math.log(Math.hypot(a[0], a[1])), Math.atan2(a[1], a[0])];
const cPow = (a: C, b: C): C => {
  if (b[1] === 0 && Number.isInteger(b[0]) && Math.abs(b[0]) <= 64) {
    let r: C = [1, 0];
    for (let i = 0; i < Math.abs(b[0]); i++) r = cMul(r, a);
    return b[0] < 0 ? cDiv([1, 0], r) : r;
  }
  if (a[0] === 0 && a[1] === 0) return [0, 0];
  return cExp(cMul(b, cLog(a)));
};
const I: C = [0, 1];

const COMPLEX_FUNCTIONS: Record<string, (z: C) => C> = {
  exp: cExp,
  ln: cLog,
  log: (z) => { const l = cLog(z); return [l[0] / Math.LN10, l[1] / Math.LN10]; },
  sqrt: (z) => cPow(z, [0.5, 0]),
  sin: (z) => [Math.sin(z[0]) * Math.cosh(z[1]), Math.cos(z[0]) * Math.sinh(z[1])],
  cos: (z) => [Math.cos(z[0]) * Math.cosh(z[1]), -Math.sin(z[0]) * Math.sinh(z[1])],
  tan: (z) => cDiv(COMPLEX_FUNCTIONS.sin(z), COMPLEX_FUNCTIONS.cos(z)),
  sinh: (z) => cMul([0, -1], COMPLEX_FUNCTIONS.sin(cMul(I, z))),
  cosh: (z) => COMPLEX_FUNCTIONS.cos(cMul(I, z)),
  tanh: (z) => cDiv(COMPLEX_FUNCTIONS.sinh(z), COMPLEX_FUNCTIONS.cosh(z)),
  abs: (z) => [Math.hypot(z[0], z[1]), 0],
  re: (z) => [z[0], 0],
  im: (z) => [z[1], 0],
  conj: (z) => [z[0], -z[1]],
  arg: (z) => [Math.atan2(z[1], z[0]), 0],
};

/** Turn a syntax tree into a function of complex numbers (one per variable). */
export function compileComplex(ast: Node, vars: string[]): (...args: C[]) => C {
  const build = (n: Node): ((env: C[]) => C) => {
    switch (n.k) {
      case 'num': { const v: C = [n.v, 0]; return () => v; }
      case 'var': { const i = vars.indexOf(n.name); return (env) => env[i]; }
      case 'const': { const v: C = n.name === 'i' ? I : [CONSTANTS[n.name] ?? NaN, 0]; return () => v; }
      case 'neg': { const a = build(n.a); return (env) => { const z = a(env); return [-z[0], -z[1]]; }; }
      case 'add': { const a = build(n.a), b = build(n.b); return (env) => cAdd(a(env), b(env)); }
      case 'sub': { const a = build(n.a), b = build(n.b); return (env) => cSub(a(env), b(env)); }
      case 'mul': { const a = build(n.a), b = build(n.b); return (env) => cMul(a(env), b(env)); }
      case 'div': { const a = build(n.a), b = build(n.b); return (env) => cDiv(a(env), b(env)); }
      case 'pow': { const a = build(n.a), b = build(n.b); return (env) => cPow(a(env), b(env)); }
      case 'fact': { const a = build(n.a); return (env) => [factorial(a(env)[0]), 0]; }
      case 'call': {
        const a = build(n.a);
        const f = COMPLEX_FUNCTIONS[n.f];
        if (f) return (env) => f(a(env));
        const real = REAL_FUNCTIONS[n.f];
        return (env) => [real ? real(a(env)[0]) : NaN, 0];
      }
    }
  };
  const run = build(ast);
  return (...args: C[]) => run(args);
}

/** Read a complex number like "1+i", "2e^(i pi/3)", "3 - 2i". */
export function parseComplex(src: string, fixName?: ParseOptions['fixName']): C | null {
  const r = parseExpression(src, { complex: true, fixName });
  if (!r.ok) return null;
  const v = compileComplex(r.ast, [])();
  return Number.isFinite(v[0]) && Number.isFinite(v[1]) ? v : null;
}

/** Read a plain number like "-pi/2" or "3.5". */
export function parseNumber(src: string, fixName?: ParseOptions['fixName']): number | null {
  const r = parseExpression(src, { fixName });
  if (!r.ok || r.usesVar) return null;
  const v = r.fn();
  return Number.isNaN(v) ? null : v;
}
