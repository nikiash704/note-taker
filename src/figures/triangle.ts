// /triangle ABC right at C
// /triangle PQR isosceles at P
// /triangle ABC equilateral
// /triangle ABC obtuse at B
// /triangle ABC right at C a=3 b=4      side a is opposite A, so this is 3-4-5
// /triangle ABC AB=5 BC=7 CA=6          three sides: drawn to scale
// /triangle ABC A=30°                   label an angle
// /triangle ABC + altitude from A + circumcircle + centroid + incircle + median from B + bisector from C

import { parseNumber } from './expr';
import { COLORS } from './svg';
import { GeoPicture, foot, mid, unit, sub, add, dist, intersect, circumcircle, incircle, centroid, orthocenter } from './geo2d';
import { fail, type FigureCommand } from './types';

type Pt = [number, number];
type Kind = 'right' | 'isosceles' | 'equilateral' | 'obtuse' | 'acute';

const KINDS: Kind[] = ['right', 'isosceles', 'equilateral', 'obtuse', 'acute'];
const KIND_ALIASES: Record<string, Kind> = {
  rt: 'right', 'right-angled': 'right', rightangled: 'right', '90': 'right', '⊥': 'right',
  iso: 'isosceles', isoceles: 'isosceles', equi: 'equilateral', equal: 'equilateral', regular: 'equilateral',
  scalene: 'acute',
};
const FILLER = ['at', 'angle', 'angled', 'triangle', 'with', 'vertex', 'in', 'is', 'and'];

export const triangle: FigureCommand = {
  name: 'triangle',
  area: 'Geometry',
  example: '/triangle ABC\n  + altitude from A\n  + circumcircle\n  + centroid',
  description: 'Right, isosceles, equilateral or obtuse; sides (a=3, AB=5), angles (A=30°); altitude/median/bisector from X, centroid, orthocenter, circumcircle, incircle.',
  draw(args, tools) {
    const notes: string[] = [];
    // Constructions inside the triangle: "altitude from A", "medians", "circumcircle"…
    const features: Feature[] = [];
    const rest = args.replace(FEATURE, (_m, line: string | undefined, from: string | undefined, centre: string | undefined) => {
      if (line) features.push({ kind: lineKind(line), from: from ?? null });
      else if (centre) features.push({ kind: centreKind(centre), from: null });
      return ' ';
    });
    // Split "C=90", "a = 3", "AB=5" into single tokens, everything else on spaces/commas.
    const tokens = rest.replace(/\s*=\s*/g, '=').split(/[\s,;]+/).filter(Boolean);

    let names = 'ABC';
    let kind: Kind | null = null;
    let special: string | null = null;
    const sides: Record<string, string> = {};   // key "BC" (sorted by vertex order) → label
    const angles: Record<string, string> = {};  // vertex → label
    const loose: string[] = [];

    // First pass: vertex names (a 3-letter word that isn't a keyword).
    const nameTok = tokens.find((t) => /^[A-Za-z]{3}$/.test(t) && !isKeyword(t.toLowerCase(), tools));
    if (nameTok) names = nameTok;
    if (new Set(names).size < 3) return fail(`The three vertex names must be different (got “${names}”).`);
    const vertex = (s: string) => names.includes(s) ? s : names.toUpperCase().includes(s.toUpperCase()) ? names[names.toUpperCase().indexOf(s.toUpperCase())] : null;

    for (const tok of tokens) {
      if (tok === nameTok) continue;
      const lower = tok.toLowerCase();
      const eq = tok.match(/^([A-Za-z]{1,2})=(.+)$/);
      if (eq) {
        const [, lhs, value] = eq;
        if (lhs.length === 2) {
          const [p, q] = [vertex(lhs[0]), vertex(lhs[1])];
          if (!p || !q || p === q) return fail(`“${lhs}” isn't a side of ${names}.`);
          sides[sideKey(names, p, q)] = value;
        } else if (lhs === lhs.toLowerCase() && names.includes(lhs.toUpperCase()) && !names.includes(lhs)) {
          // Lower-case letter: the side opposite that vertex (a is opposite A).
          const others = [...names].filter((n) => n !== lhs.toUpperCase());
          sides[sideKey(names, others[0], others[1])] = value;
        } else {
          const v = vertex(lhs);
          if (!v) return fail(`“${lhs}” isn't a vertex of ${names}.`);
          if (/^90\s*°?$/.test(value)) { kind = kind ?? 'right'; special = v; } else angles[v] = value;
        }
        continue;
      }
      if (tok.length === 1 && vertex(tok)) { special = vertex(tok); continue; }
      const k = kindOf(lower, tools);
      if (k) {
        if (k.fixed) notes.push(`${tok} → ${k.kind}`);
        if (kind && kind !== k.kind) return fail(`A triangle can't be both ${kind} and ${k.kind}.`);
        kind = k.kind;
        continue;
      }
      if (FILLER.includes(lower)) continue;
      if (tok.length === 1) return fail(`“${tok}” isn't a vertex of ${names}.`);
      loose.push(tok);
    }
    if (loose.length) return fail(`Didn't understand “${loose.join(' ')}”. Try: ${triangle.example}`);

    const pts = shape(names, kind ?? 'acute', special ?? (kind === 'right' ? names[2] : names[0]), sides, tools.fixName);
    if (typeof pts === 'string') return fail(pts);
    return {
      ok: true,
      svg: drawTriangle(names, pts, kind === 'right' ? special ?? names[2] : null, sides, angles, features),
      notes,
    };
  },
};

function isKeyword(word: string, tools: Parameters<FigureCommand['draw']>[1]): boolean {
  return FILLER.includes(word) || !!kindOf(word, tools);
}

function kindOf(word: string, tools: Parameters<FigureCommand['draw']>[1]): { kind: Kind; fixed: boolean } | null {
  if ((KINDS as string[]).includes(word)) return { kind: word as Kind, fixed: false };
  if (word in KIND_ALIASES) return { kind: KIND_ALIASES[word], fixed: false };
  if (word.length < 4) return null;
  const fixed = tools.fixWord(word, KINDS);
  return fixed ? { kind: fixed as Kind, fixed: true } : null;
}

/** Sides are stored under their two vertices in the order they appear in the name. */
function sideKey(names: string, p: string, q: string): string {
  return names.indexOf(p) < names.indexOf(q) ? p + q : q + p;
}

// ---- Geometry -----------------------------------------------------------------------------

/** Place the three vertices (in math coordinates, y up). Returns a hint string on failure. */
function shape(
  names: string, kind: Kind, special: string, sides: Record<string, string>,
  fixName: (w: string) => string | null,
): Record<string, Pt> | string {
  const [n0, n1, n2] = names;
  const len = (p: string, q: string) => {
    const label = sides[sideKey(names, p, q)];
    const v = label === undefined ? null : parseNumber(label, fixName);
    return v !== null && v > 0 ? v : null;
  };

  // Three numeric sides: draw to scale.
  const ab = len(n0, n1), bc = len(n1, n2), ca = len(n2, n0);
  if (ab && bc && ca) {
    if (ab + bc <= ca || bc + ca <= ab || ca + ab <= bc) return `Sides ${ab}, ${bc}, ${ca} can't make a triangle (each side must be shorter than the other two together).`;
    // n1 at origin, n2 along the x-axis, n0 from the law of cosines.
    const x = (ab * ab + bc * bc - ca * ca) / (2 * bc);
    return { [n1]: [0, 0], [n2]: [bc, 0], [n0]: [x, Math.sqrt(Math.max(0, ab * ab - x * x))] };
  }

  const i = names.indexOf(special);
  const v = names[i], next = names[(i + 1) % 3], prev = names[(i + 2) % 3];
  switch (kind) {
    case 'right': {
      // Right angle at v (bottom-left); legs along the axes. A hypotenuse
      // plus one leg gives the other leg.
      const hyp = len(next, prev);
      let legX = len(v, next);
      let legY = len(v, prev);
      if (hyp && ((legX ?? 0) >= hyp || (legY ?? 0) >= hyp)) return `The hypotenuse (${hyp}) must be the longest side.`;
      if (hyp && legX && !legY) legY = Math.sqrt(hyp * hyp - legX * legX);
      if (hyp && legY && !legX) legX = Math.sqrt(hyp * hyp - legY * legY);
      return { [v]: [0, 0], [next]: [legX ?? 4, 0], [prev]: [0, legY ?? 3] };
    }
    case 'equilateral':
      return { [n1]: [0, 0], [n2]: [4, 0], [n0]: [2, 2 * Math.sqrt(3)] };
    case 'isosceles':
      return { [v]: [2, 3.3], [next]: [0, 0], [prev]: [4, 0] };
    case 'obtuse':
      return { [v]: [1.4, 1.3], [next]: [0, 0], [prev]: [5, 0] };
    default:
      return { [n0]: [1.6, 3], [n1]: [0, 0], [n2]: [4.4, 0] };
  }
}

// ---- Drawing -------------------------------------------------------------------------------

type FeatureKind = 'altitude' | 'median' | 'bisector' | 'centroid' | 'orthocenter' | 'circumcircle' | 'incircle';
interface Feature { kind: FeatureKind; from: string | null }

const FEATURE = /\b(altitudes?|heights?|medians?|(?:angle\s+)?bisectors?)\b(?:\s+(?:from|at|of|through)\s+([A-Za-z])\b)?|\b(centroid|orthocent(?:er|re)|circumcircle|circumcent(?:er|re)|circumscribed|incircle|incent(?:er|re)|inscribed)\b/gi;

const lineKind = (w: string): FeatureKind => (/alt|height/i.test(w) ? 'altitude' : /median/i.test(w) ? 'median' : 'bisector');
const centreKind = (w: string): FeatureKind =>
  /^centroid/i.test(w) ? 'centroid' : /^ortho/i.test(w) ? 'orthocenter' : /^(circum)/i.test(w) ? 'circumcircle' : 'incircle';

function drawTriangle(
  names: string, pts: Record<string, Pt>, rightAt: string | null,
  sides: Record<string, string>, angles: Record<string, string>, features: Feature[] = [],
): string {
  const g = new GeoPicture();
  const V = (n: string) => pts[n];
  const [A, B, C] = [...names].map(V);
  const G = centroid(A, B, C);
  g.poly([A, B, C], { width: 2, fill: 'currentColor', fillOpacity: 0.04 });
  const others = (n: string) => [...names].filter((m) => m !== n).map(V) as [Pt, Pt];

  if (rightAt) {
    const [p, q] = others(rightAt);
    g.rightAngle(V(rightAt), p, q);
  }
  for (const [n, label] of Object.entries(angles)) {
    const [p, q] = others(n);
    g.angle(V(n), p, q, { label: /^[\d.]+$/.test(label) ? `${label}°` : label });
  }
  for (const [key, label] of Object.entries(sides)) {
    g.label(mid(V(key[0]), V(key[1])), label, { away: G, size: 14 });
  }

  // Lines from a vertex (or from all three).
  for (const f of features) {
    if (!['altitude', 'median', 'bisector'].includes(f.kind)) continue;
    const from = f.from && names.toUpperCase().includes(f.from.toUpperCase()) ? names[names.toUpperCase().indexOf(f.from.toUpperCase())] : null;
    for (const n of from ? [from] : [...names]) {
      const v = V(n), [p, q] = others(n);
      const color = f.kind === 'altitude' ? COLORS[1] : f.kind === 'median' ? COLORS[2] : COLORS[4];
      if (f.kind === 'altitude') {
        const h = foot(v, p, q);
        g.segment(v, h, { color, width: 1.5, dashed: true });
        // Extend the base if the foot falls outside it (obtuse triangles).
        const t = (h[0] - p[0]) * (q[0] - p[0]) + (h[1] - p[1]) * (q[1] - p[1]);
        const L = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2;
        if (t < 0) g.segment(p, h, { dashed: true, width: 1, opacity: 0.6 });
        if (t > L) g.segment(q, h, { dashed: true, width: 1, opacity: 0.6 });
        g.rightAngle(h, v, dist(h, p) > 1e-9 ? p : q, color);
      } else if (f.kind === 'median') {
        const m = mid(p, q);
        g.segment(v, m, { color, width: 1.5 });
        g.ticks(p, m, 1, color);
        g.ticks(m, q, 1, color);
      } else {
        const d = add(unit(sub(p, v)), unit(sub(q, v)));
        const hit = intersect(v, d, p, sub(q, p));
        if (hit) {
          g.segment(v, hit, { color, width: 1.5 });
          g.angle(v, p, hit, { color, r: 0 });
          g.angle(v, hit, q, { color, r: 0 });
        }
      }
    }
  }
  // Centres.
  for (const f of features) {
    if (f.kind === 'centroid') { g.dot(G, 3.5, COLORS[2]); g.label(G, 'G', { color: COLORS[2] }); }
    if (f.kind === 'orthocenter') {
      const h = orthocenter(A, B, C);
      if (h) { g.dot(h, 3.5, COLORS[1]); g.label(h, 'H', { color: COLORS[1] }); }
    }
    if (f.kind === 'circumcircle') {
      const c = circumcircle(A, B, C);
      if (c) { g.circle(c.o, c.r, { color: COLORS[0], width: 1.4 }); g.dot(c.o, 3.5, COLORS[0]); g.label(c.o, 'O', { color: COLORS[0] }); }
    }
    if (f.kind === 'incircle') {
      const c = incircle(A, B, C);
      g.circle(c.o, c.r, { color: COLORS[3], width: 1.4 });
      g.dot(c.o, 3.5, COLORS[3]);
      g.label(c.o, 'I', { color: COLORS[3] });
    }
  }
  for (const n of names) g.label(V(n), n, { away: G, size: 17, offset: 16 });
  return g.render(`Triangle ${names}`, 340, 260);
}

