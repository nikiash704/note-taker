// A small, forgiving math expression reader used by /plot, /vec, /interval …
// It accepts the way people jot formulas down:
//   sin x, sin(x), 2x, x^2, x², 2pi, |x|, e^-x, sin^2 x, \sin x, sqrt 2
// and turns them into a plain JavaScript function. No eval.

export type Fn = (x: number) => number;

export interface ParseOk {
  ok: true;
  fn: Fn;
  /** True if the expression mentions the variable. */
  usesVar: boolean;
  /** Friendly notes about names that were auto-corrected, e.g. "sni → sin". */
  corrections: string[];
}
export interface ParseError {
  ok: false;
  message: string;
}
export type ParseResult = ParseOk | ParseError;

const FUNCTIONS: Record<string, Fn> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  sec: (x) => 1 / Math.cos(x), csc: (x) => 1 / Math.sin(x), cot: (x) => 1 / Math.tan(x),
  asin: Math.asin, acos: Math.acos, atan: Math.atan,
  arcsin: Math.asin, arccos: Math.acos, arctan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs,
  ln: Math.log, log: Math.log10, exp: Math.exp,
  floor: Math.floor, ceil: Math.ceil, round: Math.round, sgn: Math.sign, sign: Math.sign,
};

const CONSTANTS: Record<string, number> = {
  pi: Math.PI, e: Math.E, tau: 2 * Math.PI, inf: Infinity, infty: Infinity, infinity: Infinity, oo: Infinity,
};

export const KNOWN_NAMES = [...Object.keys(FUNCTIONS), ...Object.keys(CONSTANTS)];

export interface ParseOptions {
  /** Variable names allowed (usually ["x"]). Empty for plain numbers. */
  vars?: string[];
  /** Suggest a known name for an unknown word (typo tolerance). */
  fixName?: (word: string) => string | null;
}

// ---- Tokens -----------------------------------------------------------------

type Token =
  | { t: 'num'; v: number }
  | { t: 'name'; v: string }
  | { t: 'op'; v: string };

const UNICODE: [RegExp, string][] = [
  [/π/g, ' pi '], [/τ/g, ' tau '], [/∞/g, ' inf '], [/√/g, ' sqrt '],
  [/[−–]/g, '-'], [/[×·⋅]/g, '*'], [/÷/g, '/'], [/²/g, '^2'], [/³/g, '^3'],
  [/\*\*/g, '^'], [/\\(left|right)\b/g, ''], [/\\/g, ' '],
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
    } else if ('+-*/^()[]{}|!,'.includes(c)) {
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
  const lower = word.toLowerCase();
  const parts: string[] = [];
  let i = 0;
  while (i < lower.length) {
    let best = '';
    for (const name of vocab) {
      if (name.length > best.length && lower.startsWith(name, i)) best = name;
    }
    if (!best) return null;
    parts.push(best);
    i += best.length;
  }
  return parts;
}

// ---- Parser (recursive descent) ---------------------------------------------------

type Node = (x: number) => number;

export function parseExpression(src: string, opts: ParseOptions = {}): ParseResult {
  const vars = opts.vars ?? [];
  const raw = tokenize(src);
  if (typeof raw === 'string') return { ok: false, message: raw };

  // Resolve letter runs into functions, constants and variables.
  const vocab = [...KNOWN_NAMES, ...vars];
  const corrections: string[] = [];
  const tokens: Token[] = [];
  for (const tok of raw) {
    if (tok.t !== 'name') { tokens.push(tok); continue; }
    let parts = splitWord(tok.v, vocab);
    if (!parts) {
      const fixed = opts.fixName?.(tok.v.toLowerCase());
      if (fixed) {
        corrections.push(`${tok.v} → ${fixed}`);
        parts = [fixed];
      } else {
        return { ok: false, message: `Unknown name “${tok.v}”` + (vars.length ? ` (the variable is ${vars[0]})` : '') };
      }
    }
    for (const p of parts) tokens.push({ t: 'name', v: p });
  }

  let pos = 0;
  let absDepth = 0;
  let usesVar = false;
  const peek = () => tokens[pos];
  const isOp = (v: string) => peek()?.t === 'op' && peek()!.v === v;
  const isFunc = (tok?: Token) => tok?.t === 'name' && tok.v in FUNCTIONS;

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
      const a = left, b = term();
      left = op === '+' ? (x) => a(x) + b(x) : (x) => a(x) - b(x);
    }
    return left;
  }

  function term(): Node {
    let left = unary();
    for (;;) {
      if (isOp('*') || isOp('/')) {
        const op = tokens[pos++].v;
        const a = left, b = unary();
        left = op === '*' ? (x) => a(x) * b(x) : (x) => a(x) / b(x);
      } else if (startsFactor()) {
        const a = left, b = power();
        left = (x) => a(x) * b(x);
      } else {
        return left;
      }
    }
  }

  function unary(): Node {
    if (isOp('-')) { pos++; const a = unary(); return (x) => -a(x); }
    if (isOp('+')) { pos++; return unary(); }
    return power();
  }

  function power(): Node {
    const base = postfix();
    if (isOp('^')) {
      pos++;
      const exp = unary();
      return (x) => Math.pow(base(x), exp(x));
    }
    return base;
  }

  function postfix(): Node {
    let a = atom();
    while (isOp('!')) {
      pos++;
      const inner = a;
      a = (x) => factorial(inner(x));
    }
    return a;
  }

  function atom(): Node {
    const tok = tokens[pos++];
    if (!tok) return fail('The formula ends too early');
    if (tok.t === 'num') return () => tok.v;
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
        return (x) => Math.abs(inner(x));
      }
      return fail(`Unexpected “${tok.v}”`);
    }
    const name = tok.v;
    if (vars.includes(name)) { usesVar = true; return (x) => x; }
    if (name in CONSTANTS) { const v = CONSTANTS[name]; return () => v; }
    return applyFunction(FUNCTIONS[name]);
  }

  /** sin(x), sin x, sin 2x, sin^2 x */
  function applyFunction(f: Fn): Node {
    let exponent: Node | null = null;
    if (isOp('^')) { pos++; exponent = unary(); }
    let arg: Node;
    if (isOp('(')) {
      arg = postfixPower();
    } else {
      // No parentheses: the argument is the following product, stopping at
      // the next function name, so "sin x cos x" means sin(x)·cos(x).
      arg = unary();
      while (startsFactor() && !isFunc(peek())) {
        const a = arg, b = power();
        arg = (x) => a(x) * b(x);
      }
    }
    const e = exponent;
    return e ? (x) => Math.pow(f(arg(x)), e(x)) : (x) => f(arg(x));
  }

  /** A parenthesised argument, allowing a power after it: sin(x)^2 is handled by power(). */
  function postfixPower(): Node {
    pos++; // (
    const inner = expression();
    if (!isOp(')')) fail('Missing “)”');
    pos++;
    return inner;
  }

  try {
    if (tokens.length === 0) return { ok: false, message: 'Nothing to read' };
    const fn = expression();
    if (pos < tokens.length) {
      const tok = tokens[pos];
      return { ok: false, message: `Didn't expect “${tok.t === 'num' ? tok.v : tok.v}” here` };
    }
    return { ok: true, fn, usesVar, corrections };
  } catch (e) {
    if (e instanceof Fail) return { ok: false, message: e.message };
    throw e;
  }
}

function factorial(n: number): number {
  if (n < 0 || !Number.isInteger(n)) return NaN;
  let r = 1;
  for (let i = 2; i <= n && r < Infinity; i++) r *= i;
  return r;
}

/** Read a plain number like "-pi/2" or "3.5". */
export function parseNumber(src: string, fixName?: ParseOptions['fixName']): number | null {
  const r = parseExpression(src, { fixName });
  if (!r.ok || r.usesVar) return null;
  const v = r.fn(0);
  return Number.isNaN(v) ? null : v;
}
