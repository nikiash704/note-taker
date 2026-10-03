// Figure commands: a line starting with "/" (plus any "+ …" lines below it)
// becomes a drawing or a maths block. This file finds the right command for
// what was typed (forgiving typos) and runs it.

import { KNOWN_NAMES } from './expr';
import { closest } from '../fuzzy';
import type { ArgTools, FigureCommand, FigureOutput } from './types';
import { firstLine } from './types';
import { ALL_COMMANDS } from './registry';

export const COMMANDS: FigureCommand[] = ALL_COMMANDS;

/**
 * Other words people reach for. The value is the command that runs; the
 * word itself is passed on as `tools.invokedAs`, so /cylinder can mean
 * "/solid cylinder". Typos of these are caught too.
 */
const ALL_SYNONYMS: Record<string, string> = {
  // graphs
  graph: 'plot', fn: 'plot', func: 'plot', function: 'plot', curve: 'plot', draw: 'plot',
  shade: 'area', integral: 'area', tangents: 'tangent', rsum: 'riemann', riemannsum: 'riemann',
  pw: 'piecewise', maclaurin: 'taylor', param: 'parametric', polarcurve: 'polar',
  ellipse: 'conic', hyperbola: 'conic', parabola: 'conic', seq: 'sequence', partialsums: 'series',
  epsilon: 'epsdelta', unit: 'unitcircle', trig: 'unitcircle', signs: 'signchart', sign: 'signchart',
  // regions
  inequality: 'region', inequalities: 'region', pregion: 'polarregion', lp: 'feasible', linprog: 'feasible',
  disk: 'ball', disc: 'ball', nbhd: 'ball', neighborhood: 'ball', neighbourhood: 'ball',
  // plane
  axis: 'axes', grid: 'axes', plane2: 'axes', coords: 'axes', coordinates: 'axes', points: 'axes', point: 'axes',
  vector: 'vec', vectors2: 'vec', arrow: 'vec', arrows: 'vec',
  // 3D
  axes3d: 'axes3', '3d': 'axes3', space: 'axes3', vec3d: 'vec3', vector3: 'vec3',
  surf: 'surface', plot3: 'surface', plot3d: 'surface', level: 'contour', levels: 'contour', levelcurves: 'contour',
  vectorfield: 'field', vf: 'field', grad: 'gradient', line3d: 'line3', helix: 'curve3', spacecurve: 'curve3',
  cube: 'solid', cuboid: 'solid', prism: 'solid', pyramid: 'solid', tetrahedron: 'solid',
  cylinder: 'solid', cone: 'solid', sphere: 'solid', paraboloid: 'solid',
  green: 'loop', stokes: 'loop', closedcurve: 'loop',
  // linear algebra
  mat: 'matrix', aug: 'augmented', rref: 'rowops', rowreduce: 'rowops', elim: 'rowops', ero: 'rowops',
  sys: 'system', equations: 'system', determinant: 'det', eig: 'eigen', eigenvalues: 'eigen', eigenvectors: 'eigen',
  linmap: 'transform', lintrans: 'transform', proj: 'projection', colvec: 'vectors', columns: 'vectors',
  line: 'lines', inv: 'inverse',
  // differential equations
  slope: 'slopefield', dirfield: 'slopefield', directionfield: 'slopefield', ode: 'slopefield',
  portrait: 'phase', phaseportrait: 'phase', pline: 'phaseline', fseries: 'fourier', mass: 'spring',
  // logic and discrete
  truth: 'truthtable', tt: 'truthtable', logic: 'truthtable', sets: 'venn',
  map: 'mapping', maps: 'mapping', net: 'network', digraph: 'network',
  poset: 'hasse', lattice: 'hasse', rel: 'relation', fsm: 'automaton', dfa: 'automaton', nfa: 'automaton', machine: 'automaton',
  rooted: 'tree',
  // algebra
  grouptable: 'cayley', group: 'cayley', permutation: 'perm', cycle: 'perm',
  // probability
  normal: 'dist', bell: 'dist', density: 'dist', pdf: 'dist', distribution: 'dist', tdist: 'dist', chisq: 'dist',
  exponential: 'dist', uniform: 'dist', binomial: 'dist', poisson: 'dist', geometric: 'dist', pmf: 'dist',
  ptree: 'probtree', histogram: 'hist', box: 'boxplot', regression: 'scatter',
  // complex
  argand: 'complex', unity: 'roots', cpath: 'contourpath', contourintegral: 'contourpath',
  // geometry
  tri: 'triangle', triang: 'triangle', ngon: 'polygon', square: 'polygon', rectangle: 'polygon', rhombus: 'polygon',
  trapezoid: 'polygon', trapezium: 'polygon', kite: 'polygon', pentagon: 'polygon', hexagon: 'polygon', octagon: 'polygon',
  quadrilateral: 'polygon', transversal: 'parallel', geo: 'construct', geometry: 'construct', hyperbolic: 'poincare',
  // topology, number theory, numerics
  identification: 'glue', torus: 'glue', klein: 'glue', mobius: 'glue', rp2: 'glue',
  gcd: 'euclid', euclidean: 'euclid', modular: 'clock', newtons: 'newton', fixedpoint: 'cobweb', iteration: 'cobweb',
  bisect: 'bisection', interp: 'interpolate', lagrange: 'interpolate',
  // number line and diagrams (from before)
  numberline: 'interval', 'number-line': 'interval', nl: 'interval', range: 'interval', set: 'interval', ineq: 'interval',
  diag: 'diagram', flow: 'diagram', chain: 'diagram', cd: 'diagram', boxes: 'diagram',
  // blocks
  tab: 'table', derivation: 'align', steps: 'align',
  definition: 'def', theorem: 'thm', proposition: 'prop', corollary: 'cor', pf: 'proof', example: 'ex', remark: 'rem',
};

const NAMES = COMMANDS.map((c) => c.name);
export const SYNONYMS: Record<string, string> = Object.fromEntries(
  Object.entries(ALL_SYNONYMS).filter(([word, target]) => NAMES.includes(target) && !NAMES.includes(word)),
);

export type MatchKind = 'exact' | 'synonym' | 'prefix' | 'typo';

export interface Resolved {
  command: FigureCommand;
  kind: MatchKind;
  /** The word that matched: the command name or a synonym. */
  word: string;
}

const byName = (name: string) => COMMANDS.find((c) => c.name === name)!;

/** Find the command meant by what was typed after "/". */
export function resolveCommand(typed: string): Resolved | null {
  const word = typed.toLowerCase();
  if (NAMES.includes(word)) return { command: byName(word), kind: 'exact', word };
  if (word in SYNONYMS) return { command: byName(SYNONYMS[word]), kind: 'synonym', word };
  // A unique beginning: /tria, /inter, /diag
  if (word.length >= 3) {
    const starts = NAMES.filter((n) => n.startsWith(word));
    if (starts.length === 1) return { command: byName(starts[0]), kind: 'prefix', word: starts[0] };
  }
  // A typo of a name or a synonym: /trinagle, /plto, /grpah
  const guess = closest(word, [...NAMES, ...Object.keys(SYNONYMS)]);
  if (guess) return { command: byName(SYNONYMS[guess] ?? guess), kind: 'typo', word: guess };
  return null;
}

const MATH_NAMES = KNOWN_NAMES.filter((n) => n.length >= 3);

/** Forgiving argument helpers handed to every command. */
export function makeTools(invokedAs: string): ArgTools {
  return {
    fixWord: (word, vocabulary) => closest(word.toLowerCase(), vocabulary),
    fixName: (word) => (word.length >= 3 ? closest(word, MATH_NAMES, 1) : null),
    invokedAs,
  };
}

/** Split a block into the typed command name and its arguments. "+ …" lines become new lines of `args`. */
export function parseBlock(block: string): { typed: string; args: string } {
  const [first, ...rest] = block.split('\n');
  const m = first.trim().match(/^\/([A-Za-z][\w-]*)\s*(.*)$/);
  const more = rest.map((l) => l.replace(/^\s*\+\s?/, '').trim()).filter(Boolean);
  const head = m ? m[2].trim() : '';
  return { typed: m ? m[1] : '', args: [head, ...more].filter(Boolean).join('\n') };
}

export interface FigureRun {
  /** The name as typed, e.g. "trinagle". */
  typed: string;
  /** The command that ran, e.g. "triangle" (null if none matched). */
  command: string | null;
  match: MatchKind | null;
  output: FigureOutput;
  /** How long reading + drawing took, in milliseconds. */
  ms: number;
}

export function runFigure(block: string): FigureRun {
  const start = performance.now();
  const { typed, args } = parseBlock(block);
  const resolved = resolveCommand(typed);
  let output: FigureOutput;
  if (!resolved) {
    output = { ok: false, hint: `No figure called /${typed}. Ctrl+/ shows them all.` };
  } else {
    try {
      output = resolved.command.draw(args, makeTools(resolved.word));
    } catch (e) {
      // A bug in one figure must never break typing.
      console.error(e);
      output = { ok: false, hint: `Couldn't draw this. Try: ${firstLine(resolved.command.example)}` };
    }
    if (output.ok && resolved.kind !== 'exact' && resolved.kind !== 'synonym') {
      output = { ...output, notes: [`/${typed} → /${resolved.command.name}`, ...output.notes] };
    } else if (output.ok && resolved.kind === 'synonym' && resolved.word !== typed.toLowerCase()) {
      output = { ...output, notes: [`/${typed} → /${resolved.word}`, ...output.notes] };
    }
  }
  return { typed, command: resolved?.command.name ?? null, match: resolved?.kind ?? null, output, ms: performance.now() - start };
}

// Both the editor hints and the preview ask about the same blocks, so
// remember recent answers.
const cache = new Map<string, FigureRun>();

export function runFigureCached(block: string): FigureRun {
  let run = cache.get(block);
  if (!run) {
    run = runFigure(block);
    if (cache.size > 300) cache.delete(cache.keys().next().value!);
    cache.set(block, run);
  }
  return run;
}

// ---- Suggested answers (only when Compute is on) ----------------------------------------

const suggestionCache = new Map<string, string[] | null>();

/** Lines the app suggests adding under this block, or null. */
export function suggestFor(block: string): string[] | null {
  if (suggestionCache.has(block)) return suggestionCache.get(block)!;
  const { typed, args } = parseBlock(block);
  const resolved = resolveCommand(typed);
  let lines: string[] | null = null;
  if (resolved?.command.suggest) {
    try {
      lines = resolved.command.suggest(args, makeTools(resolved.word));
    } catch (e) {
      console.error(e);
    }
  }
  if (lines && lines.length === 0) lines = null;
  if (suggestionCache.size > 300) suggestionCache.delete(suggestionCache.keys().next().value!);
  suggestionCache.set(block, lines);
  return lines;
}
