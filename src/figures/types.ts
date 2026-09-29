// Shared shapes for figure commands.

export interface FigureOk {
  ok: true;
  svg: string;
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
}

export interface FigureCommand {
  name: string;
  /** Shown in hints and the help panel. */
  example: string;
  description: string;
  draw: (args: string, tools: ArgTools) => FigureOutput;
}

export const fail = (hint: string): FigureFail => ({ ok: false, hint });
