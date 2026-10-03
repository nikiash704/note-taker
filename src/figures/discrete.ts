// Logic, sets and discrete maths:
//   /truthtable /venn /mapping /network /tree /probtree /hasse /relation /automaton

import { splitClauses, splitTopLevel } from './args';
import { svg, line, text, circle, el, path, COLORS, INK, arrowHead, round } from './svg';
import { fail, firstLine, type FigureCommand } from './types';

// ---- Logic -------------------------------------------------------------------------------

type Env = Record<string, boolean>;
type Prop = (env: Env) => boolean;

/** Read a propositional formula: ~ ¬ not, & ∧ and, | ∨ or, -> → =>, <-> ↔ iff, xor ⊕. */
function readLogic(src: string): { f: Prop; vars: string[]; tex: string } | string {
  const s = src
    .replace(/<->|<=>|↔|⟺|\biff\b/g, ' IFF ').replace(/->|=>|→|⟹|\bimplies\b/g, ' IMP ')
    .replace(/∧|&&?|\/\\|\band\b/g, ' AND ').replace(/∨|\|\|?|\\\/|\bor\b/g, ' OR ')
    .replace(/⊕|\bxor\b/g, ' XOR ').replace(/¬|~|!|\bnot\b/g, ' NOT ')
    .replace(/[()]/g, (c) => ` ${c} `);
  const tokens = s.split(/\s+/).filter(Boolean);
  let pos = 0;
  const vars = new Set<string>();
  const peek = () => tokens[pos];
  class Fail extends Error {}
  type Node = { f: Prop; tex: string; prec: number };
  const bin = (op: string, tex: string, prec: number, next: () => Node, right = false): Node => {
    let left = next();
    while (peek() === op) {
      pos++;
      const r = right ? bin(op, tex, prec, next, true) : next();
      const [a, b] = [left, r];
      const apply = op === 'AND' ? (e: Env) => a.f(e) && b.f(e) : op === 'OR' ? (e: Env) => a.f(e) || b.f(e)
        : op === 'XOR' ? (e: Env) => a.f(e) !== b.f(e) : op === 'IMP' ? (e: Env) => !a.f(e) || b.f(e) : (e: Env) => a.f(e) === b.f(e);
      const wrap = (n: Node) => (n.prec < prec ? `(${n.tex})` : n.tex);
      left = { f: apply, tex: `${wrap(a)} ${tex} ${wrap(b)}`, prec };
      if (right) break;
    }
    return left;
  };
  const atom = (): Node => {
    const t = tokens[pos++];
    if (t === undefined) throw new Fail('The formula ends too early');
    if (t === 'NOT') { const a = atom(); return { f: (e) => !a.f(e), tex: `\\lnot ${a.prec < 9 ? `(${a.tex})` : a.tex}`, prec: 9 }; }
    if (t === '(') { const inner = iff(); if (tokens[pos++] !== ')') throw new Fail('Missing “)”'); return { ...inner, prec: 10 }; }
    if (/^(T|1|true|⊤)$/i.test(t)) return { f: () => true, tex: '\\top', prec: 10 };
    if (/^(F|0|false|⊥)$/i.test(t)) return { f: () => false, tex: '\\bot', prec: 10 };
    if (/^[a-z](_?\d)?$/.test(t)) { vars.add(t); return { f: (e) => e[t], tex: t.replace(/_?(\d)$/, '_$1'), prec: 10 }; }
    throw new Fail(`Didn't understand “${t}”`);
  };
  const and = () => bin('AND', '\\land', 7, atom);
  const or = () => bin('OR', '\\lor', 6, and);
  const xor = () => bin('XOR', '\\oplus', 5, or);
  const imp = (): Node => bin('IMP', '\\to', 4, xor, true);
  const iff = () => bin('IFF', '\\leftrightarrow', 3, imp);
  try {
    const n = iff();
    if (pos < tokens.length) return `Didn't expect “${tokens[pos]}”`;
    return { f: n.f, vars: [...vars].sort(), tex: n.tex };
  } catch (e) {
    if (e instanceof Fail) return e.message;
    throw e;
  }
}

function truthParts(args: string) {
  const clauses = splitClauses(args).flatMap((c) => (/^=/.test(c) ? [c] : splitTopLevel(c, ',')));
  return { exprs: clauses.filter((c) => !/^=/.test(c)), answers: clauses.filter((c) => /^=/.test(c)) };
}

export const truthtable: FigureCommand = {
  name: 'truthtable',
  area: 'Logic, sets and discrete maths',
  example: '/truthtable p -> q, ~q -> ~p',
  description: 'A truth table (T first). Result columns stay empty for you to fill with “= T F T T” lines; with Compute on they are suggested.',
  draw(args) {
    const { exprs, answers } = truthParts(args);
    if (!exprs.length) return fail(`Which formulas? e.g. ${truthtable.example}`);
    const parsed = exprs.map(readLogic);
    const bad = parsed.find((p) => typeof p === 'string');
    if (bad) return fail(`${bad}. Try: ${truthtable.example}`);
    const ps = parsed as Exclude<(typeof parsed)[number], string>[];
    const vars = [...new Set(ps.flatMap((p) => p.vars))].sort();
    if (vars.length > 5) return fail('Up to 5 letters, please (that is already 32 rows)');
    const rows = 1 << vars.length;
    const filled = answers.map((a) => a.replace(/^=\s*/, '').split(/[\s,]+/).filter(Boolean));
    const cell = (v: string | undefined) => (v === undefined ? '\\phantom{T}' : /^(t|1|true)$/i.test(v) ? '\\text{T}' : /^(f|0|false)$/i.test(v) ? '\\text{F}' : v);
    let body = `${vars.join(' & ')} & ${ps.map((p) => p.tex).join(' & ')} \\\\ \\hline `;
    for (let r = 0; r < rows; r++) {
      const vals = vars.map((_, i) => !((r >> (vars.length - 1 - i)) & 1));
      body += vals.map((v) => (v ? '\\text{T}' : '\\text{F}')).join(' & ');
      body += ' & ' + ps.map((_, k) => cell(filled[k]?.[r])).join(' & ') + ' \\\\ ';
    }
    const cols = `${'c'.repeat(vars.length)}|${'c'.repeat(ps.length)}`;
    return { ok: true, latex: `\\begin{array}{${cols}} ${body} \\end{array}`, notes: [] };
  },
  suggest(args) {
    const { exprs, answers } = truthParts(args);
    const parsed = exprs.map(readLogic);
    if (!exprs.length || parsed.some((p) => typeof p === 'string') || answers.length >= exprs.length) return null;
    const ps = parsed as Exclude<(typeof parsed)[number], string>[];
    const vars = [...new Set(ps.flatMap((p) => p.vars))].sort();
    if (vars.length > 5) return null;
    return ps.slice(answers.length).map((p) => {
      const out: string[] = [];
      for (let r = 0; r < 1 << vars.length; r++) {
        const env: Env = {};
        vars.forEach((v, i) => (env[v] = !((r >> (vars.length - 1 - i)) & 1)));
        out.push(p.f(env) ? 'T' : 'F');
      }
      return `= ${out.join(' ')}`;
    });
  },
};

// ---- Venn diagrams ---------------------------------------------------------------------------

type SetFn = (inSet: Record<string, boolean>) => boolean;

function readSetExpr(src: string): { f: SetFn; sets: string[] } | string {
  const s = src.replace(/∪|\bcup\b|\bunion\b|\bor\b|\+|\bu\b/g, ' ∪ ').replace(/∩|\bcap\b|\bintersect\b|\band\b|&|\bn\b/g, ' ∩ ')
    .replace(/\\|−|-(?!>)/g, ' − ').replace(/Δ|\bxor\b|△/g, ' Δ ').replace(/\^c|ᶜ/g, "'").replace(/[()']/g, (c) => ` ${c} `);
  const tokens = s.split(/\s+/).filter(Boolean);
  let pos = 0;
  const sets = new Set<string>();
  class Fail extends Error {}
  const atom = (): SetFn => {
    const t = tokens[pos++];
    let f: SetFn;
    if (t === '(') { f = expr(); if (tokens[pos++] !== ')') throw new Fail('Missing “)”'); }
    else if (t === 'U') f = () => true;
    else if (t === '∅' || t === 'O') f = () => false;
    else if (/^[A-Z]$/.test(t ?? '')) { sets.add(t); f = (m) => m[t]; }
    else throw new Fail(`Didn't understand “${t ?? ''}” (use capital letters for sets)`);
    while (tokens[pos] === "'") { pos++; const g = f; f = (m) => !g(m); }
    return f;
  };
  const expr = (): SetFn => {
    let left = atom();
    while (['∪', '∩', '−', 'Δ'].includes(tokens[pos])) {
      const op = tokens[pos++];
      const [a, b] = [left, atom()];
      left = op === '∪' ? (m) => a(m) || b(m) : op === '∩' ? (m) => a(m) && b(m) : op === '−' ? (m) => a(m) && !b(m) : (m) => a(m) !== b(m);
    }
    return left;
  };
  try {
    const f = expr();
    if (pos < tokens.length) return `Didn't expect “${tokens[pos]}”`;
    return { f, sets: [...sets] };
  } catch (e) {
    if (e instanceof Fail) return e.message;
    throw e;
  }
}

let vennCount = 0;

export const venn: FigureCommand = {
  name: 'venn',
  area: 'Logic, sets and discrete maths',
  example: "/venn A ∩ B'",
  description: "Venn diagram of 2 or 3 sets with an expression shaded: ∪ (or u, cup), ∩ (or n, cap), ' for complement, − for difference, Δ.",
  draw(args) {
    const input = args.replace(/[\n;]+/g, ' ').trim();
    const m = input.match(/^((?:[A-Z]\s*){1,3})(?:shade\s+)?(.*)$/);
    const listed = m && !/[∪∩'−Δ()]/.test(m[1]) && m[2] && !/^[∪∩'−Δ\-+&|^]/.test(m[2].trim()) ? m[1].replace(/\s/g, '').split('') : [];
    const exprText = (listed.length ? m![2] : input).replace(/^shade\s+/i, '').trim();
    let shadeFn: SetFn | null = null;
    let sets = listed;
    if (exprText) {
      const e = readSetExpr(exprText);
      if (typeof e === 'string') return fail(`${e}. Try: ${venn.example}`);
      shadeFn = e.f;
      sets = [...new Set([...listed, ...e.sets])];
    }
    if (!sets.length) sets = ['A', 'B'];
    if (sets.length > 3) return fail('Up to three sets');
    sets.sort();
    const id = `venn${++vennCount}`;
    const W = 380, H = sets.length === 3 ? 320 : 240;
    const r = 78;
    const centres: [number, number][] = sets.length === 1 ? [[W / 2, H / 2]]
      : sets.length === 2 ? [[W / 2 - 48, H / 2 - 4], [W / 2 + 48, H / 2 - 4]]
      : [[W / 2 - 48, H / 2 - 30], [W / 2 + 48, H / 2 - 30], [W / 2, H / 2 + 50]];
    let defs = '<defs>';
    sets.forEach((_, i) => {
      defs += `<clipPath id="${id}-in${i}"><circle cx="${centres[i][0]}" cy="${centres[i][1]}" r="${r}"/></clipPath>`;
      defs += `<mask id="${id}-out${i}"><rect x="0" y="0" width="${W}" height="${H}" fill="white"/><circle cx="${centres[i][0]}" cy="${centres[i][1]}" r="${r}" fill="black"/></mask>`;
    });
    defs += '</defs>';
    let shading = '';
    if (shadeFn) {
      // Each region is "inside these sets, outside those": nest clips and masks.
      for (let code = 0; code < 1 << sets.length; code++) {
        const member: Record<string, boolean> = {};
        sets.forEach((s, i) => (member[s] = !!((code >> i) & 1)));
        if (!shadeFn(member)) continue;
        let g = `<rect x="12" y="12" width="${W - 24}" height="${H - 24}" fill="${COLORS[0]}" fill-opacity="0.35"/>`;
        sets.forEach((_, i) => {
          g = (code >> i) & 1 ? `<g clip-path="url(#${id}-in${i})">${g}</g>` : `<g mask="url(#${id}-out${i})">${g}</g>`;
        });
        shading += g;
      }
    }
    let body = defs + shading;
    body += el('rect', { x: 12, y: 12, width: W - 24, height: H - 24, fill: 'none', stroke: INK, 'stroke-width': 1.5, rx: 6 });
    body += text(24, 32, 'U', { 'font-style': 'italic', 'font-size': 15 });
    sets.forEach((s, i) => {
      body += circle(centres[i][0], centres[i][1], r, { fill: 'none', stroke: INK, 'stroke-width': 1.8 });
      const [dx, dy] = sets.length === 3 ? [[-1, -1], [1, -1], [0, 1]][i] : [[-1, -1], [1, -1]][i] ?? [0, -1];
      body += text(centres[i][0] + dx * r * 0.85, centres[i][1] + dy * r * 0.85 + (dy > 0 ? 18 : 0), s, { 'font-size': 17, 'font-style': 'italic', 'text-anchor': 'middle' });
    });
    if (exprText) body += text(W - 20, H - 20, exprText, { 'font-size': 14, 'text-anchor': 'end', 'font-style': 'italic' });
    return { ok: true, svg: svg(W, H, body, `Venn diagram ${exprText}`), notes: [] };
  },
};

// ---- Functions between sets --------------------------------------------------------------------

function braces(s: string): string[] {
  return s.replace(/^\s*\{|\}\s*$/g, '').split(',').map((x) => x.trim()).filter(Boolean);
}

export const mapping: FigureCommand = {
  name: 'mapping',
  area: 'Logic, sets and discrete maths',
  example: '/mapping {1, 2, 3} -> {a, b}\n  + 1 -> a, 2 -> a, 3 -> b',
  description: 'An arrow diagram of a function or relation between two sets (to check injective/surjective).',
  draw(args) {
    const input = args.replace(/\n/g, '; ');
    const m = input.match(/^\s*(?:([A-Za-z])\s*:\s*)?(\{[^}]*\})\s*(?:->|→|to)\s*(\{[^}]*\})\s*[:;,]?\s*(.*)$/s);
    if (!m) return fail(`Give the two sets and the arrows. Try: ${firstLine(mapping.example)}`);
    const name = m[1] ?? 'f';
    const A = braces(m[2]), B = braces(m[3]);
    const pairs: [string, string][] = [];
    for (const tok of m[4].split(/[,;]/).map((t) => t.trim()).filter(Boolean)) {
      const p = tok.match(/^(.+?)\s*(?:->|→|↦|\|->|:|\s)\s*(.+)$/) ?? (tok.length === 2 ? [tok, tok[0], tok[1]] : null);
      if (!p) return fail(`Couldn't read the arrow “${tok}”. Write it as 1 -> a`);
      const [x, y] = [p[1].trim(), p[2].trim()];
      if (!A.includes(x)) return fail(`“${x}” isn't in the first set`);
      if (!B.includes(y)) return fail(`“${y}” isn't in the second set`);
      pairs.push([x, y]);
    }
    const W = 360, rowH = 34;
    const H = Math.max(A.length, B.length) * rowH + 70;
    const [ax, bx] = [90, 270];
    const posA = (i: number) => H / 2 + (i - (A.length - 1) / 2) * rowH;
    const posB = (i: number) => H / 2 + (i - (B.length - 1) / 2) * rowH;
    let body = '';
    for (const [cx, n] of [[ax, A.length], [bx, B.length]]) {
      body += el('ellipse', { cx, cy: H / 2, rx: 46, ry: (n * rowH) / 2 + 22, fill: COLORS[0], 'fill-opacity': 0.08, stroke: INK, 'stroke-width': 1.5 });
    }
    A.forEach((a, i) => { body += circle(ax + 14, posA(i), 3, { fill: INK }) + text(ax - 6, posA(i) + 5, a, { 'text-anchor': 'end', 'font-size': 15 }); });
    B.forEach((b, i) => { body += circle(bx - 14, posB(i), 3, { fill: INK }) + text(bx + 6, posB(i) + 5, b, { 'font-size': 15 }); });
    for (const [x, y] of pairs) {
      const [x1, y1, x2, y2] = [ax + 18, posA(A.indexOf(x)), bx - 20, posB(B.indexOf(y))];
      body += line(x1, y1, x2, y2, { stroke: COLORS[0], 'stroke-width': 1.6 }) + arrowHead(x1, y1, x2 + 2, y2, COLORS[0], 8);
    }
    body += text(W / 2, 22, name, { 'font-style': 'italic', 'font-size': 17, 'text-anchor': 'middle' });
    body += path(`M${W / 2 - 30},30 L${W / 2 + 30},30`, { 'stroke-width': 1.3 }) + arrowHead(W / 2 - 30, 30, W / 2 + 34, 30, INK, 7);
    return { ok: true, svg: svg(W, H, body, 'Mapping diagram'), notes: [] };
  },
};

// ---- Graphs (networks) ------------------------------------------------------------------------

interface Graph { nodes: string[]; edges: { a: string; b: string; directed: boolean; label: string }[]; pos: Map<string, [number, number]> }

function namedGraph(spec: string): Graph | null {
  const s = spec.replace(/\s|_|\{|\}/g, '');
  const ring = (n: number, r = 1, offset = -Math.PI / 2) => Array.from({ length: n }, (_, i) => [r * Math.cos(offset + (2 * Math.PI * i) / n), r * Math.sin(offset + (2 * Math.PI * i) / n)] as [number, number]);
  const g: Graph = { nodes: [], edges: [], pos: new Map() };
  const add = (name: string, p: [number, number]) => { g.nodes.push(name); g.pos.set(name, p); };
  const edge = (a: number | string, b: number | string) => g.edges.push({ a: String(a), b: String(b), directed: false, label: '' });
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^K(\d+)[,x×](\d+)$/i))) {
    const [p, q] = [Number(m[1]), Number(m[2])];
    for (let i = 0; i < p; i++) add(`a${i + 1}`, [(i - (p - 1) / 2) * 0.8, -0.8]);
    for (let j = 0; j < q; j++) add(`b${j + 1}`, [(j - (q - 1) / 2) * 0.8, 0.8]);
    for (let i = 0; i < p; i++) for (let j = 0; j < q; j++) edge(`a${i + 1}`, `b${j + 1}`);
    return g;
  }
  if ((m = s.match(/^([KCPWS])(\d+)$/i))) {
    const [kind, n] = [m[1].toUpperCase(), Math.min(16, Number(m[2]))];
    if (kind === 'P') { for (let i = 0; i < n; i++) add(String(i + 1), [(i - (n - 1) / 2) * 0.7, 0]); for (let i = 1; i < n; i++) edge(i, i + 1); return g; }
    if (kind === 'W' || kind === 'S') {
      add('0', [0, 0]);
      const k = kind === 'W' ? n - 1 : n - 1;
      ring(k).forEach((p, i) => add(String(i + 1), p));
      for (let i = 1; i <= k; i++) { edge(0, i); if (kind === 'W') edge(i, (i % k) + 1); }
      return g;
    }
    ring(n).forEach((p, i) => add(String(i + 1), p));
    if (kind === 'K') { for (let i = 1; i <= n; i++) for (let j = i + 1; j <= n; j++) edge(i, j); }
    else for (let i = 1; i <= n; i++) edge(i, (i % n) + 1);
    return g;
  }
  if (/^petersen$/i.test(s)) {
    ring(5, 1).forEach((p, i) => add(String(i + 1), p));
    ring(5, 0.5).forEach((p, i) => add(String(i + 6), p));
    for (let i = 1; i <= 5; i++) { edge(i, (i % 5) + 1); edge(i, i + 5); edge(i + 5, ((i + 1) % 5) + 6); }
    return g;
  }
  if (/^(Q3|cube)$/i.test(s)) {
    const pts: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1], [-0.45, -0.45], [0.45, -0.45], [0.45, 0.45], [-0.45, 0.45]];
    const names = ['000', '100', '110', '010', '001', '101', '111', '011'];
    names.forEach((n, i) => add(n, pts[i]));
    for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) {
      const diff = [...names[i]].filter((c, k) => c !== names[j][k]).length;
      if (diff === 1) edge(names[i], names[j]);
    }
    return g;
  }
  return null;
}

function drawGraph(g: Graph, label: string, opts: { accepting?: Set<string>; start?: string; arcs?: boolean } = {}) {
  const pts = g.nodes.map((n) => g.pos.get(n)!);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const span = Math.max(x1 - x0, y1 - y0, 0.5);
  const k = 260 / span;
  const pad = 40;
  const W = Math.max(160, (x1 - x0) * k + 2 * pad), H = Math.max(opts.arcs ? 200 : 120, (y1 - y0) * k + 2 * pad);
  const P = (n: string): [number, number] => { const [x, y] = g.pos.get(n)!; return [pad + (x - x0) * k + (W - 2 * pad - (x1 - x0) * k) / 2, pad + (y - y0) * k + (H - 2 * pad - (y1 - y0) * k) / 2]; };
  const R = Math.max(13, ...g.nodes.map((n) => n.length * 4.2 + 6));
  let body = '';
  for (const e of g.edges) {
    const [a, b] = [P(e.a), P(e.b)];
    const color = INK;
    if (e.a === e.b) {
      body += el('path', { d: `M${round(a[0] - 8)},${round(a[1] - R + 2)} C${round(a[0] - 30)},${round(a[1] - R - 34)} ${round(a[0] + 30)},${round(a[1] - R - 34)} ${round(a[0] + 8)},${round(a[1] - R + 2)}`, fill: 'none', stroke: color, 'stroke-width': 1.6 });
      if (e.directed) body += arrowHead(a[0] + 18, a[1] - R - 12, a[0] + 8, a[1] - R + 2, color, 8);
      if (e.label) body += text(a[0], a[1] - R - 30, e.label, { 'text-anchor': 'middle', 'font-size': 13, 'font-style': 'italic' });
      continue;
    }
    const both = g.edges.some((o) => o !== e && o.a === e.b && o.b === e.a);
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    const [ux, uy] = [dx / len, dy / len];
    let bend = both ? 22 : 0;
    if (opts.arcs) {
      // States in a row: neighbours forward are straight, other edges arc (forward above, back below).
      const steps = Math.round((g.pos.get(e.b)![0] - g.pos.get(e.a)![0]) / 1.15);
      if (steps !== 1) bend = (steps > 0 ? -1 : 1) * Math.sign(ux || 1) * (26 + 14 * Math.abs(steps));
    }
    const [mx, my] = [(a[0] + b[0]) / 2 - uy * bend, (a[1] + b[1]) / 2 + ux * bend];
    const start: [number, number] = [a[0] + ux * R, a[1] + uy * R];
    const end: [number, number] = [b[0] - ux * (R + 1), b[1] - uy * (R + 1)];
    if (bend) {
      body += el('path', { d: `M${round(start[0])},${round(start[1])} Q${round(mx)},${round(my)} ${round(end[0])},${round(end[1])}`, fill: 'none', stroke: color, 'stroke-width': 1.6 });
      if (e.directed) body += arrowHead(mx, my, end[0], end[1], color, 9);
    } else {
      body += line(start[0], start[1], end[0], end[1], { stroke: color, 'stroke-width': 1.6 });
      if (e.directed) body += arrowHead(start[0], start[1], end[0], end[1], color, 9);
    }
    if (e.label) {
      const [lx, ly] = bend ? [mx, my] : [(start[0] + end[0]) / 2 - uy * 11, (start[1] + end[1]) / 2 + ux * 11];
      body += el('rect', { x: lx - e.label.length * 4 - 3, y: ly - 9, width: e.label.length * 8 + 6, height: 16, rx: 3, style: 'fill: var(--paper, #fff)' });
      body += text(lx, ly + 4, e.label, { 'text-anchor': 'middle', 'font-size': 13, fill: COLORS[1] });
    }
  }
  for (const n of g.nodes) {
    const [x, y] = P(n);
    body += circle(x, y, R, { style: 'fill: var(--paper, #fff)', stroke: INK, 'stroke-width': 1.6 });
    if (opts.accepting?.has(n)) body += circle(x, y, R - 4, { fill: 'none', stroke: INK, 'stroke-width': 1.3 });
    body += text(x, y + 5, n, { 'text-anchor': 'middle', 'font-size': 14, 'font-style': 'italic' });
    if (opts.start === n) body += line(x - R - 30, y, x - R - 2, y, { 'stroke-width': 1.6 }) + arrowHead(x - R - 30, y, x - R, y, INK, 9);
  }
  return svg(W + (opts.start ? 30 : 0), H, opts.start ? `<g transform="translate(30,0)">${body}</g>` : body, label);
}

/** "A-B, B-C:3, C->A" (and isolated "D"). */
function readEdges(text: string) {
  const g: Graph = { nodes: [], edges: [], pos: new Map() };
  const add = (n: string) => { if (!g.nodes.includes(n)) g.nodes.push(n); };
  for (const tok of splitTopLevel(text.replace(/\n/g, ','), ',;')) {
    const m = tok.match(/^(.+?)\s*(<->|<-|->|→|←|↔|--|-|—)\s*(.+?)(?:\s*[:=]\s*(.+))?$/);
    if (!m) { add(tok.trim()); continue; }
    let [a, op, b] = [m[1].trim(), m[2], m[3].trim()];
    if (op === '<-' || op === '←') [a, b] = [b, a];
    add(a); add(b);
    const twoWay = op === '<->' || op === '↔';
    g.edges.push({ a, b, directed: twoWay || ['->', '→', '<-', '←'].includes(op), label: m[4]?.trim() ?? '' });
    if (twoWay) g.edges.push({ a: b, b: a, directed: true, label: '' });
  }
  return g;
}

export const network: FigureCommand = {
  name: 'network',
  area: 'Logic, sets and discrete maths',
  example: '/network A-B:4, B-C:2, C-A:5\n  + C-D:1',
  description: 'A graph (vertices and edges): A-B, A->B (directed), A-B:3 (weight). Or a named graph: K5, C6, P4, W6, S5, K3,3, Petersen, cube.',
  draw(args) {
    const named = namedGraph(args.trim());
    if (named) return { ok: true, svg: drawGraph(named, `Graph ${args.trim()}`), notes: [] };
    const g = readEdges(args);
    if (!g.nodes.length) return fail(`Which vertices and edges? e.g. ${firstLine(network.example)}`);
    const n = g.nodes.length;
    g.nodes.forEach((v, i) => g.pos.set(v, [Math.cos(-Math.PI / 2 + (2 * Math.PI * i) / n), Math.sin(-Math.PI / 2 + (2 * Math.PI * i) / n)]));
    if (n === 2) { g.pos.set(g.nodes[0], [-1, 0]); g.pos.set(g.nodes[1], [1, 0]); }
    return { ok: true, svg: drawGraph(g, 'Graph'), notes: [] };
  },
};

// ---- Trees -------------------------------------------------------------------------------------

interface TreeNode { label: string; edge: string; children: TreeNode[] }

/** "a(b(d,e),c)" or "H 0.5 (H 0.5, T 0.5), T 0.5" or "b:3". */
function readTree(src: string): TreeNode[] | string {
  let pos = 0;
  const s = src.replace(/[\n;]/g, ',');
  const list = (): TreeNode[] => {
    const out: TreeNode[] = [];
    for (;;) {
      out.push(node());
      if (s[pos] === ',') { pos++; continue; }
      return out;
    }
  };
  const node = (): TreeNode => {
    let raw = '';
    while (pos < s.length && !'(),'.includes(s[pos])) raw += s[pos++];
    raw = raw.trim();
    let label = raw, edge = '';
    const colon = raw.match(/^(.*?)\s*:\s*(.+)$/);
    const spaced = raw.match(/^(.*\S)\s+([\d.\/]+%?|[a-z]?\d*\/\d+)$/);
    if (colon) [label, edge] = [colon[1], colon[2]];
    else if (spaced) [label, edge] = [spaced[1], spaced[2]];
    let children: TreeNode[] = [];
    if (s[pos] === '(') {
      pos++;
      children = list();
      if (s[pos] !== ')') throw new Error('Missing “)”');
      pos++;
    }
    return { label, edge, children };
  };
  try {
    const roots = list();
    if (pos < s.length) return `Didn't expect “${s.slice(pos)}”`;
    return roots;
  } catch (e) {
    return (e as Error).message;
  }
}

/** Tidy layout: leaves in order, parents centred over their children. */
function layoutTree(root: TreeNode, depth = 0, next = { leaf: 0 }, out: { n: TreeNode; x: number; d: number; parent: TreeNode | null }[] = [], parent: TreeNode | null = null): number {
  let x: number;
  if (!root.children.length) x = next.leaf++;
  else {
    const xs = root.children.map((c) => layoutTree(c, depth + 1, next, out, root));
    x = (xs[0] + xs[xs.length - 1]) / 2;
  }
  out.push({ n: root, x, d: depth, parent });
  return x;
}

function drawTree(root: TreeNode, horizontal: boolean, label: string): string {
  const placed: { n: TreeNode; x: number; d: number; parent: TreeNode | null }[] = [];
  layoutTree(root, 0, { leaf: 0 }, placed);
  const maxX = Math.max(...placed.map((p) => p.x)), maxD = Math.max(...placed.map((p) => p.d));
  const [gapX, gapD] = horizontal ? [38, 110] : [56, 66];
  const pad = 30;
  const W = horizontal ? maxD * gapD + 2 * pad + 40 : maxX * gapX + 2 * pad;
  const H = horizontal ? maxX * gapX + 2 * pad : maxD * gapD + 2 * pad;
  const P = (p: { x: number; d: number }): [number, number] => (horizontal ? [pad + p.d * gapD, pad + p.x * gapX] : [pad + p.x * gapX, pad + p.d * gapD]);
  const at = new Map(placed.map((p) => [p.n, P(p)]));
  let body = '';
  for (const p of placed) {
    if (!p.parent) continue;
    const [a, b] = [at.get(p.parent)!, at.get(p.n)!];
    const r = horizontal ? 10 : 13;
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    body += line(a[0] + (dx / len) * r, a[1] + (dy / len) * r, b[0] - (dx / len) * r, b[1] - (dy / len) * r, { 'stroke-width': 1.5 });
    if (p.n.edge) {
      const [mx, my] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      body += text(mx + (horizontal ? 0 : dx > 0 ? 8 : -8), my + (horizontal ? (dy > 0 ? 14 : -6) : 0), p.n.edge, { 'font-size': 12, fill: COLORS[1], 'text-anchor': horizontal ? 'middle' : dx >= 0 ? 'start' : 'end' });
    }
  }
  for (const p of placed) {
    const [x, y] = at.get(p.n)!;
    if (horizontal) {
      if (p.n.label === '•' || !p.n.label) body += circle(x, y, 4, { fill: INK });
      else body += text(x + (p.n.children.length ? -2 : 4), y + 5, p.n.label, { 'font-size': 14, 'text-anchor': p.n.children.length ? 'middle' : 'start', 'font-style': 'italic', style: 'paint-order: stroke; stroke: var(--paper, #fff); stroke-width: 4px' });
    } else {
      body += circle(x, y, 13, { style: 'fill: var(--paper, #fff)', stroke: INK, 'stroke-width': 1.5 });
      body += text(x, y + 5, p.n.label, { 'font-size': 13, 'text-anchor': 'middle', 'font-style': 'italic' });
    }
  }
  return svg(W, H, body, label);
}

export const tree: FigureCommand = {
  name: 'tree',
  area: 'Logic, sets and discrete maths',
  example: '/tree 8(3(1, 6(4, 7)), 10(14(13)))',
  description: 'A rooted tree from nested brackets: a(b, c(d)). Edge labels with “:”, e.g. a(b:1, c:2).',
  draw(args) {
    const t = readTree(args.trim());
    if (typeof t === 'string') return fail(`${t}. Try: ${tree.example}`);
    const root = t.length === 1 ? t[0] : { label: '', edge: '', children: t };
    return { ok: true, svg: drawTree(root, false, 'Tree'), notes: [] };
  },
};

export const probtree: FigureCommand = {
  name: 'probtree',
  area: 'Probability and statistics',
  example: '/probtree H 1/2 (H 1/2, T 1/2)\n  + T 1/2 (H 1/2, T 1/2)',
  description: 'A probability tree drawn left to right: each branch is “outcome probability”, followed by (its sub-branches).',
  draw(args) {
    const t = readTree(args.trim());
    if (typeof t === 'string') return fail(`${t}. Try: ${firstLine(probtree.example)}`);
    return { ok: true, svg: drawTree({ label: '•', edge: '', children: t }, true, 'Probability tree'), notes: [] };
  },
};

// ---- Posets ------------------------------------------------------------------------------------

export const hasse: FigureCommand = {
  name: 'hasse',
  area: 'Logic, sets and discrete maths',
  example: '/hasse divisors 12',
  description: 'Hasse diagram: divisors n, subsets {a,b,c}, subgroups Z12, or your own order: a < b, a < c, b < d.',
  draw(args) {
    const input = args.replace(/[\n;]+/g, ', ').trim();
    const nodes: string[] = [];
    const covers: [string, string][] = [];
    let m: RegExpMatchArray | null;
    if ((m = input.match(/^(divisors|subgroups)\s+(?:of\s+)?Z?_?(\d+)$/i))) {
      const n = Number(m[2]);
      if (n > 2000) return fail('Pick a smaller number');
      const ds = Array.from({ length: n }, (_, i) => i + 1).filter((d) => n % d === 0);
      const sub = m[1].toLowerCase() === 'subgroups';
      const name = (d: number) => (sub ? `⟨${n / d}⟩` : String(d));
      ds.forEach((d) => nodes.push(name(d)));
      for (const a of ds) for (const b of ds) if (b % a === 0 && isPrime(b / a)) covers.push([name(a), name(b)]);
    } else if ((m = input.match(/^(?:subsets|powerset|power set)\s+(?:of\s+)?\{?([^}]*)\}?$/i))) {
      const els = m[1].includes(',') ? m[1].split(',').map((x) => x.trim()).filter(Boolean) : m[1].replace(/\s/g, '').split('');
      if (els.length > 4) return fail('Up to 4 elements (16 subsets)');
      const name = (mask: number) => (mask ? `{${els.filter((_, i) => mask & (1 << i)).join(',')}}` : '∅');
      for (let mask = 0; mask < 1 << els.length; mask++) nodes.push(name(mask));
      for (let mask = 0; mask < 1 << els.length; mask++) for (let i = 0; i < els.length; i++) if (!(mask & (1 << i))) covers.push([name(mask), name(mask | (1 << i))]);
    } else {
      for (const tok of input.split(',').map((t) => t.trim()).filter(Boolean)) {
        const r = tok.match(/^(.+?)\s*(<|≤|<=|-|>|≥|>=)\s*(.+)$/);
        if (!r) { if (!nodes.includes(tok)) nodes.push(tok); continue; }
        let [a, b] = [r[1].trim(), r[3].trim()];
        if (/^(>|≥|>=)$/.test(r[2])) [a, b] = [b, a];
        for (const x of [a, b]) if (!nodes.includes(x)) nodes.push(x);
        covers.push([a, b]);
      }
    }
    if (!nodes.length) return fail(`Which order? e.g. ${hasse.example}`);
    // Level = length of the longest chain below.
    const level = new Map(nodes.map((n) => [n, 0]));
    for (let pass = 0; pass < nodes.length; pass++) for (const [a, b] of covers) level.set(b, Math.max(level.get(b)!, level.get(a)! + 1));
    const byLevel: string[][] = [];
    for (const n of nodes) (byLevel[level.get(n)!] ??= []).push(n);
    const g: Graph = { nodes, edges: covers.map(([a, b]) => ({ a, b, directed: false, label: '' })), pos: new Map() };
    const widest = Math.max(...byLevel.map((l) => l?.length ?? 0));
    byLevel.forEach((row, lv) => row?.forEach((n, i) => g.pos.set(n, [(i - (row.length - 1) / 2) * (widest > 3 ? 0.7 : 0.9), -lv * 0.75])));
    return { ok: true, svg: drawGraph(g, 'Hasse diagram'), notes: [] };
  },
};

function isPrime(n: number): boolean {
  if (n < 2) return false;
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
  return true;
}

export const relation: FigureCommand = {
  name: 'relation',
  area: 'Logic, sets and discrete maths',
  example: '/relation {1, 2, 3}: 1->2, 2->3, 1->3, 1->1',
  description: 'A relation on a set as a directed graph (loops for x R x). Pairs can also be written (1,2), (2,3).',
  draw(args) {
    const input = args.replace(/\n/g, ', ');
    const m = input.match(/^\s*(\{[^}]*\})\s*[:;,]?\s*(.*)$/s);
    const set = m ? braces(m[1]) : [];
    const rest = m ? m[2] : input;
    const g: Graph = { nodes: [...set], edges: [], pos: new Map() };
    const add = (n: string) => { if (!g.nodes.includes(n)) g.nodes.push(n); };
    const pairs = [...rest.matchAll(/\(\s*([^,()]+?)\s*,\s*([^,()]+?)\s*\)/g)].map((p) => [p[1], p[2]]);
    const arrows = rest.replace(/\([^()]*\)/g, '').split(',').map((t) => t.trim()).filter(Boolean).map((t) => t.split(/\s*(?:->|→|R)\s*/));
    for (const [a, b] of [...pairs, ...arrows.filter((p) => p.length === 2)]) { add(a); add(b); g.edges.push({ a, b, directed: true, label: '' }); }
    if (!g.nodes.length) return fail(`Which relation? e.g. ${relation.example}`);
    const n = g.nodes.length;
    g.nodes.forEach((v, i) => g.pos.set(v, [Math.cos(-Math.PI / 2 + (2 * Math.PI * i) / n), Math.sin(-Math.PI / 2 + (2 * Math.PI * i) / n)]));
    return { ok: true, svg: drawGraph(g, 'Relation'), notes: [] };
  },
};

export const automaton: FigureCommand = {
  name: 'automaton',
  area: 'Logic, sets and discrete maths',
  example: '/automaton q0 -a-> q1 -b-> q2\n  + q1 -a-> q1\n  + q2 -a,b-> q0\n  + accept q2',
  description: 'A finite automaton: transitions “q0 -a-> q1” (chains allowed), “accept q2”, “start q0” (otherwise the first state).',
  draw(args) {
    const g: Graph = { nodes: [], edges: [], pos: new Map() };
    const accepting = new Set<string>();
    let start: string | null = null;
    const add = (n: string) => { if (!g.nodes.includes(n)) g.nodes.push(n); };
    for (const clause of splitClauses(args)) {
      const acc = clause.match(/^(?:accept(?:ing)?|final)\s+(.+)$/i);
      if (acc) { acc[1].split(/[\s,]+/).filter(Boolean).forEach((s) => { accepting.add(s); add(s); }); continue; }
      const st = clause.match(/^(?:start|initial)\s+(\S+)$/i);
      if (st) { start = st[1]; add(st[1]); continue; }
      const parts = clause.split(/\s+-([^>]*)->\s+/);
      if (parts.length < 3) { add(clause.trim()); continue; }
      for (let i = 0; i + 2 < parts.length; i += 2) {
        const [a, label, b] = [parts[i].trim(), parts[i + 1].trim(), parts[i + 2].trim()];
        add(a); add(b);
        const existing = g.edges.find((e) => e.a === a && e.b === b);
        if (existing) existing.label += `,${label}`; else g.edges.push({ a, b, directed: true, label });
      }
    }
    if (!g.nodes.length) return fail(`Which states? e.g. ${firstLine(automaton.example)}`);
    g.nodes.forEach((n, i) => g.pos.set(n, [i * 1.15, 0]));
    return { ok: true, svg: drawGraph(g, 'Automaton', { accepting, start: start ?? g.nodes[0], arcs: true }), notes: [] };
  },
};

export const DISCRETE_COMMANDS: FigureCommand[] = [truthtable, venn, mapping, network, tree, hasse, relation, automaton];
