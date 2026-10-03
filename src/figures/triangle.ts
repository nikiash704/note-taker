// /triangle ABC right at C
// /triangle PQR isosceles at P
// /triangle ABC equilateral
// /triangle ABC obtuse at B
// /triangle ABC right at C a=3 b=4      side a is opposite A, so this is 3-4-5
// /triangle ABC AB=5 BC=7 CA=6          three sides: drawn to scale
// /triangle ABC A=30°                   label an angle

import { parseNumber } from './expr';
import { svg, path, text, INK, round } from './svg';
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
  example: '/triangle ABC right at C',
  description: 'Right, isosceles, equilateral or obtuse; label sides (a=3, AB=5) and angles (A=30°).',
  draw(args, tools) {
    const notes: string[] = [];
    // Split "C=90", "a = 3", "AB=5" into single tokens, everything else on spaces/commas.
    const tokens = args.replace(/\s*=\s*/g, '=').split(/[\s,;]+/).filter(Boolean);

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
      svg: drawTriangle(names, pts, kind === 'right' ? special ?? names[2] : null, sides, angles),
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

function drawTriangle(
  names: string, pts: Record<string, Pt>, rightAt: string | null,
  sides: Record<string, string>, angles: Record<string, string>,
): string {
  const all = Object.values(pts);
  const minX = Math.min(...all.map((p) => p[0])), maxX = Math.max(...all.map((p) => p[0]));
  const minY = Math.min(...all.map((p) => p[1])), maxY = Math.max(...all.map((p) => p[1]));
  const pad = 40;
  const scale = Math.min(300 / (maxX - minX || 1), 210 / (maxY - minY || 1));
  const width = (maxX - minX) * scale + 2 * pad;
  const height = (maxY - minY) * scale + 2 * pad;
  const P: Record<string, Pt> = {};
  for (const n of names) P[n] = [pad + (pts[n][0] - minX) * scale, pad + (maxY - pts[n][1]) * scale];

  const [a, b, c] = [...names].map((n) => P[n]);
  const centroid: Pt = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3];
  const unit = (from: Pt, to: Pt): Pt => {
    const d = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
    return [(to[0] - from[0]) / d, (to[1] - from[1]) / d];
  };

  let body = path(`M${round(a[0])},${round(a[1])} L${round(b[0])},${round(b[1])} L${round(c[0])},${round(c[1])} Z`, {
    'stroke-width': 2, 'stroke-linejoin': 'round', fill: INK, 'fill-opacity': 0.04,
  });

  // Right-angle square.
  if (rightAt) {
    const i = names.indexOf(rightAt);
    const v = P[rightAt], p = P[names[(i + 1) % 3]], q = P[names[(i + 2) % 3]];
    const [ux, uy] = unit(v, p), [wx, wy] = unit(v, q);
    const s = 13;
    body += path(
      `M${round(v[0] + ux * s)},${round(v[1] + uy * s)} L${round(v[0] + (ux + wx) * s)},${round(v[1] + (uy + wy) * s)} L${round(v[0] + wx * s)},${round(v[1] + wy * s)}`,
      { 'stroke-width': 1.3 },
    );
  }

  // Angle arcs with labels.
  for (const [n, label] of Object.entries(angles)) {
    const i = names.indexOf(n);
    const v = P[n], p = P[names[(i + 1) % 3]], q = P[names[(i + 2) % 3]];
    const [ux, uy] = unit(v, p), [wx, wy] = unit(v, q);
    const r = 24;
    const sweep = ux * wy - uy * wx > 0 ? 1 : 0;
    body += path(`M${round(v[0] + ux * r)},${round(v[1] + uy * r)} A${r},${r} 0 0 ${sweep} ${round(v[0] + wx * r)},${round(v[1] + wy * r)}`, { 'stroke-width': 1.3 });
    const [bx, by] = unit([0, 0], [ux + wx, uy + wy]);
    const shown = /^[\d.]+$/.test(label) ? `${label}°` : label;
    body += text(v[0] + bx * (r + 16), v[1] + by * (r + 16) + 5, shown, { 'font-size': 13, 'text-anchor': 'middle' });
  }

  // Side labels, pushed away from the opposite vertex.
  for (const [key, label] of Object.entries(sides)) {
    const p = P[key[0]], q = P[key[1]];
    const mid: Pt = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    const [ox, oy] = unit(centroid, mid);
    body += text(mid[0] + ox * 16, mid[1] + oy * 16 + 5, label, { 'font-size': 14, 'text-anchor': 'middle', 'font-style': 'italic' });
  }

  // Vertex names, pushed outwards.
  for (const n of names) {
    const [ox, oy] = unit(centroid, P[n]);
    body += text(P[n][0] + ox * 16, P[n][1] + oy * 16 + 6, n, { 'font-size': 17, 'text-anchor': 'middle', 'font-style': 'italic' });
  }
  return svg(width, height, body, `Triangle ${names}`);
}
