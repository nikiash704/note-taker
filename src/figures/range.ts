// Reading ranges like "from -pi to pi", "-pi..pi", "[0, 2pi]", "x = 0 to 1".

import { parseNumber } from './expr';
import type { ArgTools } from './types';

const RANGE_WORDS = ['from', 'on', 'over', 'for', 'between'] as const;

export interface SplitRange {
  body: string;
  range: [number, number] | null;
  /** Set when a range was written but couldn't be read. */
  error?: string;
  corrections: string[];
}

/** Split "sin x from -pi to pi" into the body "sin x" and the range [-π, π]. */
export function splitRange(args: string, tools: ArgTools, variable = 'x'): SplitRange {
  const corrections: string[] = [];
  const words = args.split(/\s+/);

  // 1. A keyword such as "from" (or a typo of one, like "form"), last one wins.
  for (let i = words.length - 1; i > 0; i--) {
    const w = words[i].toLowerCase();
    const fixed = RANGE_WORDS.includes(w as never) ? w : w.length >= 3 ? tools.fixWord(w, RANGE_WORDS) : null;
    if (!fixed) continue;
    if (fixed !== w) corrections.push(`${words[i]} → ${fixed}`);
    const body = words.slice(0, i).join(' ');
    let rangeText = words.slice(i + 1).join(' ');
    rangeText = rangeText.replace(new RegExp(`^${variable}\\s*(=|∈|in\\b)\\s*`, 'i'), '');
    const range = readRange(rangeText, tools);
    return range
      ? { body, range, corrections }
      : { body, range: null, corrections, error: `Couldn't read the range “${rangeText}”. Try: from -2 to 2` };
  }

  // 2. A range at the very end without a keyword: "... [0, 2pi]", "... -pi..pi", "... 0 to 1".
  const tail = args.match(/(\[[^\]]*\]|\S+\s*(?:\.\.+|…)\s*\S+|\S+\s+to\s+\S+)\s*$/i);
  if (tail && tail.index! > 0) {
    const range = readRange(tail[1], tools);
    if (range) return { body: args.slice(0, tail.index).trim().replace(/\bx\s*=\s*$/, '').trim(), range, corrections };
  }
  return { body: args.trim(), range: null, corrections };
}

/** Read "a to b", "a..b", "[a, b]", "(a,b)", "a, b". */
export function readRange(text: string, tools: ArgTools): [number, number] | null {
  const inner = text.trim().replace(/^[[(]\s*/, '').replace(/\s*[\])]$/, '');
  const parts = inner.split(/\s*(?:\.\.+|…|\bto\b|\band\b|,|;)\s*/i).filter((p) => p !== '');
  if (parts.length !== 2) return null;
  const a = parseNumber(parts[0], tools.fixName);
  const b = parseNumber(parts[1], tools.fixName);
  if (a === null || b === null || a === b) return null;
  return a < b ? [a, b] : [b, a];
}
