// Figure commands: a line starting with "/" becomes a drawing.
// This file finds the right command for a line (forgiving typos) and runs it.

import { plot } from './plot';
import { axes, vec } from './plane';
import { triangle } from './triangle';
import { interval } from './interval';
import { diagram } from './diagram';
import { KNOWN_NAMES } from './expr';
import { closest } from '../fuzzy';
import type { ArgTools, FigureCommand, FigureOutput } from './types';

export const COMMANDS: FigureCommand[] = [plot, axes, vec, triangle, interval, diagram];

/** Other words people reach for. Typos of these are caught too. */
export const SYNONYMS: Record<string, string> = {
  graph: 'plot', fn: 'plot', func: 'plot', function: 'plot', curve: 'plot', draw: 'plot',
  axis: 'axes', grid: 'axes', plane: 'axes', coords: 'axes', coordinates: 'axes', points: 'axes', point: 'axes',
  vector: 'vec', vectors: 'vec', arrow: 'vec', arrows: 'vec',
  tri: 'triangle', triang: 'triangle',
  numberline: 'interval', 'number-line': 'interval', nl: 'interval', range: 'interval', set: 'interval', ineq: 'interval',
  diag: 'diagram', flow: 'diagram', chain: 'diagram', map: 'diagram', maps: 'diagram', cd: 'diagram', boxes: 'diagram',
};

export type MatchKind = 'exact' | 'synonym' | 'prefix' | 'typo';

export interface Resolved {
  command: FigureCommand;
  kind: MatchKind;
}

const NAMES = COMMANDS.map((c) => c.name);
const byName = (name: string) => COMMANDS.find((c) => c.name === name)!;

/** Find the command meant by what was typed after "/". */
export function resolveCommand(typed: string): Resolved | null {
  const word = typed.toLowerCase();
  if (NAMES.includes(word)) return { command: byName(word), kind: 'exact' };
  if (word in SYNONYMS) return { command: byName(SYNONYMS[word]), kind: 'synonym' };
  // A unique beginning: /tria, /inter, /diag
  if (word.length >= 3) {
    const starts = NAMES.filter((n) => n.startsWith(word));
    if (starts.length === 1) return { command: byName(starts[0]), kind: 'prefix' };
  }
  // A typo of a name or a synonym: /trinagle, /plto, /grpah
  const guess = closest(word, [...NAMES, ...Object.keys(SYNONYMS)]);
  if (guess) return { command: byName(SYNONYMS[guess] ?? guess), kind: 'typo' };
  return null;
}

/** Forgiving argument helpers handed to every command. */
const MATH_NAMES = KNOWN_NAMES.filter((n) => n.length >= 3);
export const tools: ArgTools = {
  fixWord: (word, vocabulary) => closest(word.toLowerCase(), vocabulary),
  fixName: (word) => (word.length >= 3 ? closest(word, MATH_NAMES, 1) : null),
};

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

export function runFigure(line: string): FigureRun {
  const start = performance.now();
  const m = line.trim().match(/^\/([A-Za-z][\w-]*)\s*(.*)$/);
  const typed = m ? m[1] : '';
  const args = m ? m[2] : '';
  const resolved = resolveCommand(typed);
  let output: FigureOutput;
  if (!resolved) {
    output = { ok: false, hint: `No figure called /${typed}. Try ${NAMES.map((n) => '/' + n).join(', ')}.` };
  } else {
    output = resolved.command.draw(args, tools);
    if (output.ok && resolved.kind !== 'exact') {
      output = { ...output, notes: [`/${typed} → /${resolved.command.name}`, ...output.notes] };
    }
  }
  return { typed, command: resolved?.command.name ?? null, match: resolved?.kind ?? null, output, ms: performance.now() - start };
}

// Both the editor hints and the preview ask about the same lines, so
// remember recent answers.
const cache = new Map<string, FigureRun>();

export function runFigureCached(line: string): FigureRun {
  let run = cache.get(line);
  if (!run) {
    run = runFigure(line);
    if (cache.size > 300) cache.delete(cache.keys().next().value!);
    cache.set(line, run);
  }
  return run;
}
