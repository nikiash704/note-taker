// Figure commands: a line starting with "/" becomes a drawing.
// This file finds the right command for a line and runs it.

import { plot } from './plot';
import { axes, vec } from './plane';
import { triangle } from './triangle';
import { interval } from './interval';
import { diagram } from './diagram';
import type { ArgTools, FigureCommand, FigureOutput } from './types';

export const COMMANDS: FigureCommand[] = [plot, axes, vec, triangle, interval, diagram];

export interface FigureRun {
  /** The name as typed, e.g. "trinagle". */
  typed: string;
  /** The command that ran, e.g. "triangle" (null if none matched). */
  command: string | null;
  output: FigureOutput;
  /** How long reading + drawing took, in milliseconds. */
  ms: number;
}

const exactTools: ArgTools = { fixWord: () => null, fixName: () => null };

export function runFigure(line: string): FigureRun {
  const start = performance.now();
  const m = line.trim().match(/^\/([A-Za-z][\w-]*)\s*(.*)$/);
  const typed = m ? m[1] : '';
  const args = m ? m[2] : '';
  const cmd = COMMANDS.find((c) => c.name === typed.toLowerCase()) ?? null;
  const output: FigureOutput = cmd
    ? cmd.draw(args, exactTools)
    : { ok: false, hint: `No figure called /${typed}. Try ${COMMANDS.map((c) => '/' + c.name).join(', ')}.` };
  return { typed, command: cmd?.name ?? null, output, ms: performance.now() - start };
}
