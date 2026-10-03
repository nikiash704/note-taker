// Helpers for reading command arguments forgivingly. Shared by all figures.

import { parseNumber, parseExpression, type Fn } from './expr';
import type { ArgTools } from './types';

/**
 * Split arguments into clauses. A clause ends at ";" or a line break (a "+"
 * continuation line), but not inside brackets: "[1 2; 3 4]; R2-3R1" gives
 * ["[1 2; 3 4]", "R2-3R1"].
 */
export function splitClauses(args: string): string[] {
  return splitTopLevel(args, ';\n');
}

/** Split on any of `seps`, ignoring separators inside (), [] or {}. */
export function splitTopLevel(s: string, seps: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const c of s) {
    if ('([{'.includes(c)) depth++;
    if (')]}'.includes(c)) depth = Math.max(0, depth - 1);
    if (depth === 0 && seps.includes(c)) {
      parts.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  parts.push(cur.trim());
  return parts.filter((p) => p !== '');
}

/** The value after "name=" or "name =" (e.g. param("n=4 left", "n") → "4"). */
export function param(text: string, ...names: string[]): string | null {
  for (const name of names) {
    const m = text.match(new RegExp(`(?:^|[\\s,;(])${escapeRegex(name)}\\s*[=:]\\s*([^\\s,;]+)`, 'i'));
    if (m) return m[1];
  }
  return null;
}

/** A numeric "name=value" parameter. */
export function numParam(text: string, tools: ArgTools, ...names: string[]): number | null {
  const raw = param(text, ...names);
  return raw === null ? null : parseNumber(raw, tools.fixName);
}

/** Remove "name=value" parameters from the text. */
export function stripParams(text: string, ...names: string[]): string {
  let out = text;
  for (const name of names) out = out.replace(new RegExp(`(^|[\\s,;])${escapeRegex(name)}\\s*[=:]\\s*[^\\s,;]+`, 'gi'), '$1');
  return out.replace(/\s{2,}/g, ' ').trim();
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Does the text contain this word (or a typo of it)? */
export function hasWord(text: string, word: string, tools?: ArgTools): boolean {
  const words = text.toLowerCase().split(/[^a-z0-9']+/);
  if (words.includes(word)) return true;
  return !!tools && word.length >= 5 && words.some((w) => w.length >= 4 && tools.fixWord(w, [word]) === word);
}

/** The first word of a clause, matched (forgiving typos) against keywords. */
export function leadingKeyword(clause: string, keywords: readonly string[], tools: ArgTools): { word: string; rest: string } | null {
  const m = clause.trim().match(/^([A-Za-z][A-Za-z-]*)\s*(.*)$/s);
  if (!m) return null;
  const w = m[1].toLowerCase();
  const word = keywords.includes(w) ? w : w.length >= 4 ? tools.fixWord(w, keywords) : null;
  return word ? { word, rest: m[2].trim() } : null;
}

// ---- Numbers and points --------------------------------------------------------

export interface Pair {
  name: string | null;
  x: number;
  y: number;
  start: number;
  end: number;
}

const OPEN = '([<⟨';
const CLOSE: Record<string, string> = { '(': ')', '[': ']', '<': '>', '⟨': '⟩' };

/** Find every (x, y) pair in the text, with an optional name in front: u=(1,2), A(1,2). */
export function findPairs(src: string, tools: ArgTools, openers = OPEN, size = 2): Pair[] | string {
  const pairs: Pair[] = [];
  for (let i = 0; i < src.length; i++) {
    if (!openers.includes(src[i])) continue;
    const close = CLOSE[src[i]];
    let depth = 0, j = i + 1;
    for (; j < src.length; j++) {
      if (src[j] === close && depth === 0) break;
      if (src[j] === '(') depth++;
      else if (src[j] === ')') depth--;
    }
    const parts = splitTopLevel(src.slice(i + 1, j), ',;');
    if (parts.length !== size) {
      if (size === 2 && parts.length === 3) return 'Use two numbers like (2, 3) here (for 3D, use /vec3 or /axes3)';
      continue;
    }
    const nums = parts.map((p) => parseNumber(p, tools.fixName));
    if (nums.some((n) => n === null)) return `Couldn't read the numbers in “${src.slice(i, j + 1)}”`;
    const before = src.slice(0, i).match(/([A-Za-z][A-Za-z0-9_']*)\s*[=:]?\s*$/);
    const name = before && !/^(to|from|and|at|through|thru|via|onto|on|of|by)$/i.test(before[1]) ? before[1] : null;
    pairs.push({ name, x: nums[0]!, y: nums[1]!, start: before && name ? i - before[0].length : i, end: j + 1 });
    i = j;
  }
  return pairs;
}

export interface Triple { name: string | null; v: [number, number, number]; start: number; end: number }

export function findTriples(src: string, tools: ArgTools): Triple[] | string {
  const out: Triple[] = [];
  for (let i = 0; i < src.length; i++) {
    if (!OPEN.includes(src[i])) continue;
    const close = CLOSE[src[i]];
    let depth = 0, j = i + 1;
    for (; j < src.length; j++) {
      if (src[j] === close && depth === 0) break;
      if (src[j] === '(') depth++;
      else if (src[j] === ')') depth--;
    }
    const parts = splitTopLevel(src.slice(i + 1, j), ',;');
    if (parts.length !== 3) continue;
    const nums = parts.map((p) => parseNumber(p, tools.fixName));
    if (nums.some((n) => n === null)) return `Couldn't read the numbers in “${src.slice(i, j + 1)}”`;
    const before = src.slice(0, i).match(/([A-Za-z][A-Za-z0-9_']*)\s*[=:]?\s*$/);
    const name = before && !/^(to|from|and|at|through|onto|of)$/i.test(before[1]) ? before[1] : null;
    out.push({ name, v: nums as [number, number, number], start: before && name ? i - before[0].length : i, end: j + 1 });
    i = j;
  }
  return out;
}

/** "2 3 3 5 7" or "2, 3, 3, 5" → numbers. */
export function numberList(text: string, tools: ArgTools): number[] | null {
  const parts = text.split(/[\s,;]+/).filter(Boolean);
  const nums = parts.map((p) => parseNumber(p, tools.fixName));
  return nums.some((n) => n === null) ? null : (nums as number[]);
}

/** Parse a formula in the given variables, with a friendly error. */
export function formula(src: string, vars: string[], tools: ArgTools, notes?: string[]): Fn | string {
  const cleaned = src.replace(/^\s*([a-z]\s*\(\s*[a-z,\s]+\)|y|z|r)\s*=\s*/i, '');
  const r = parseExpression(cleaned, { vars, fixName: tools.fixName });
  if (!r.ok) return `${r.message} in “${cleaned.trim()}”`;
  notes?.push(...r.corrections);
  return r.fn;
}

/** "lhs = rhs" → lhs − rhs (for implicit curves and level sets). */
export function equationToZero(src: string, vars: string[], tools: ArgTools, notes?: string[]): Fn | string {
  const sides = src.split(/(?<![<>!=])=(?!=)/);
  if (sides.length > 2) return `“${src}” has more than one “=”`;
  const lhs = formula(sides[0], vars, tools, notes);
  if (typeof lhs === 'string') return lhs;
  if (sides.length === 1) return lhs;
  const rhs = parseExpression(sides[1], { vars, fixName: tools.fixName });
  if (!rhs.ok) return `${rhs.message} in “${sides[1].trim()}”`;
  const r = rhs.fn;
  return (...a: number[]) => lhs(...a) - r(...a);
}

// ---- Turning typed maths into LaTeX for blocks ------------------------------------

/**
 * Light clean-up of typed maths into LaTeX: "x^2 <= sqrt(2)*pi" → "x^2 \le \sqrt{2}\cdot\pi".
 * Real LaTeX passes through untouched.
 */
export function toTex(text: string): string {
  return text
    .replace(/<=>|<->|↔/g, ' \\iff ')
    .replace(/=>|⇒/g, ' \\implies ')
    .replace(/<=|≤/g, ' \\le ')
    .replace(/>=|≥/g, ' \\ge ')
    .replace(/!=|≠/g, ' \\neq ')
    .replace(/->|→/g, ' \\to ')
    .replace(/(?<!\\)\b(sqrt)\s*\(([^()]*)\)/g, '\\sqrt{$2}')
    .replace(/(?<!\\)\bsqrt\s*(\w+)/g, '\\sqrt{$1}')
    .replace(/(?<![\\a-zA-Z])(pi|theta|alpha|beta|gamma|delta|lambda|mu|sigma|omega|phi|epsilon|infty)(?![a-zA-Z])/g, '\\$1')
    .replace(/(?<![\\a-zA-Z])inf(?![a-zA-Z])/g, '\\infty')
    .replace(/(?<![\\a-zA-Z])(sin|cos|tan|ln|log|exp|det|lim|max|min|gcd)(?![a-zA-Z])/g, '\\$1')
    .replace(/\*\*/g, '^')
    .replace(/\*/g, ' \\cdot ')
    .replace(/±/g, ' \\pm ')
    .replace(/√(\w+)/g, '\\sqrt{$1}')
    .replace(/λ/g, '\\lambda ')
    .replace(/π/g, '\\pi ')
    .replace(/\^\(([^()]*)\)/g, '^{$1}')
    .replace(/\^(-?\d{2,})/g, '^{$1}');
}

/** Format a number compactly: 0.333333 → 0.3333, 2.0 → 2. */
export function fmt(v: number, digits = 4): string {
  if (!Number.isFinite(v)) return v > 0 ? '∞' : v < 0 ? '−∞' : '?';
  if (Math.abs(v) < 1e-10) return '0';
  if (Number.isInteger(v)) return String(v);
  return String(parseFloat(v.toPrecision(digits)));
}
