// Shared shapes for figure commands.

export interface FigureOk {
  ok: true;
  /** A drawing. */
  svg?: string;
  /** A maths block (matrix, system, table…), rendered with KaTeX. */
  latex?: string;
  /** Ready-made HTML (theorem boxes and the like). */
  html?: string;
  /** Quiet notes shown under the figure, e.g. corrections that were made. */
  notes: string[];
}

export interface FigureFail {
  ok: false;
  /** One short sentence saying what to fix. Never a dialog. */
  hint: string;
}

export type FigureOutput = FigureOk | FigureFail;

/** Helpers a command can use to read its arguments forgivingly. */
export interface ArgTools {
  /** Match a (possibly misspelt) word against a list of keywords. */
  fixWord: (word: string, vocabulary: readonly string[]) => string | null;
  /** Suggest a known math name for an unknown one (sni → sin). */
  fixName: (word: string) => string | null;
  /** The word that was typed after "/" once resolved, e.g. "cylinder" for /cylinder → /solid. */
  invokedAs: string;
}

/** Groups for the cheat sheet. */
export type Area =
  | 'Graphs of functions'
  | 'Regions'
  | '3D and multivariable'
  | 'Linear algebra'
  | 'Differential equations'
  | 'Logic, sets and discrete maths'
  | 'Abstract algebra'
  | 'Probability and statistics'
  | 'Complex analysis'
  | 'Geometry'
  | 'Topology, number theory, numerics'
  | 'Blocks';

export interface FigureCommand {
  name: string;
  area: Area;
  /** Shown in the cheat sheet. Several lines (with "+ …" lines) are fine. */
  example: string;
  description: string;
  /**
   * Draw it. `args` is everything after the command name; "+ …" lines
   * below the command arrive joined with "\n", so splitClauses() treats
   * them exactly like ";" on one line.
   */
  draw: (args: string, tools: ArgTools) => FigureOutput;
  /**
   * Answers the app can work out (only asked when Compute is on).
   * Returns the lines to suggest under the command, without the "+ ".
   */
  suggest?: (args: string, tools: ArgTools) => string[] | null;
}

export const fail = (hint: string): FigureFail => ({ ok: false, hint });

/** The first line of an example, for one-line hints. */
export const firstLine = (example: string) => example.split('\n')[0];
