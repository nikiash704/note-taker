// A figure block is a command line ("/plot …") plus the "+ …" lines right
// below it. Editor features (hints, suggestions, the usage log) use these
// helpers to find the block around the cursor.

import type { Text } from '@codemirror/state';
import { isFigureLine, isContinuationLine } from './markdown';

export interface FigureBlock {
  /** First and last line numbers (1-based). */
  fromLine: number;
  toLine: number;
  /** Document positions of the block's start and end. */
  from: number;
  to: number;
  text: string;
}

/** The figure block that contains the given line, if any. */
export function figureBlockAt(doc: Text, lineNo: number): FigureBlock | null {
  let start = lineNo;
  while (start > 1 && isContinuationLine(doc.line(start).text)) start--;
  if (!isFigureLine(doc.line(start).text)) return null;
  let end = start;
  while (end < doc.lines && isContinuationLine(doc.line(end + 1).text)) end++;
  if (lineNo > end) return null;
  const from = doc.line(start).from;
  const to = doc.line(end).to;
  return { fromLine: start, toLine: end, from, to, text: doc.sliceString(from, to) };
}

/** Every figure block that overlaps the range [from, to]. */
export function figureBlocksIn(doc: Text, from: number, to: number): FigureBlock[] {
  const blocks: FigureBlock[] = [];
  let lineNo = doc.lineAt(from).number;
  const last = doc.lineAt(to).number;
  while (lineNo <= last) {
    const block = figureBlockAt(doc, lineNo);
    if (block) {
      blocks.push(block);
      lineNo = block.toLine + 1;
    } else {
      lineNo++;
    }
  }
  return blocks;
}
