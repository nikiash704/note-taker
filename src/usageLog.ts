// A local log of how figure commands get used, to answer the prototype's two
// questions: are commands fast enough to type during a lecture, and does the
// typo tolerance keep up? Nothing leaves the browser. See it at /stats.
//
// A command is "committed" when the cursor leaves its line (Enter, arrows,
// clicking elsewhere) or the editor loses focus. We then record how long it
// took to type, whether it drew, and what was auto-corrected.

import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { isFigureLine } from './markdown';
import { runFigureCached, type MatchKind } from './figures';
import { readJSON, writeJSON } from './storage';

export interface LogEntry {
  /** When the command was committed (ms since 1970). */
  at: number;
  line: string;
  typed: string;
  command: string | null;
  match: MatchKind | null;
  ok: boolean;
  hint?: string;
  /** Auto-corrections made, e.g. ["/trinagle → /triangle", "rigth → right"]. */
  corrections: string[];
  /** First keystroke to last keystroke on the line. */
  typingMs: number;
  /** Time to read the command and draw it. */
  parseMs: number;
  /** Number of edits (keystrokes, pastes, expansions) on the line. */
  edits: number;
  /** True if this line was committed before and failed then. */
  fixedByUser: boolean;
}

const LOG_KEY = 'nt.log';
const MAX_ENTRIES = 5000;

export function readLog(): LogEntry[] {
  return readJSON<LogEntry[]>(LOG_KEY, []);
}

export function clearLog(): void {
  writeJSON(LOG_KEY, []);
}

function append(entry: LogEntry): void {
  const log = readLog();
  log.push(entry);
  writeJSON(LOG_KEY, log.slice(-MAX_ENTRIES));
}

interface Active {
  pos: number;        // start of the line being edited (kept up to date as text changes)
  startedAt: number;
  lastEditAt: number;
  edits: number;
}

export function usageTracker(): Extension {
  let active: Active | null = null;
  // Lines (by start position) whose last commit failed, to spot user fixes.
  let failedAt = new Set<number>();

  function commit(view: EditorView) {
    if (!active) return;
    const { pos, startedAt, lastEditAt, edits } = active;
    active = null;
    if (pos > view.state.doc.length) return;
    const line = view.state.doc.lineAt(pos);
    if (!isFigureLine(line.text)) return;

    const run = runFigureCached(line.text);
    const corrections = run.output.ok
      ? run.output.notes.filter((n) => n.includes('→'))
      : [];
    append({
      at: Date.now(),
      line: line.text.trim(),
      typed: run.typed,
      command: run.command,
      match: run.match,
      ok: run.output.ok,
      hint: run.output.ok ? undefined : run.output.hint,
      corrections,
      typingMs: Math.round(lastEditAt - startedAt),
      parseMs: Math.round(run.ms * 100) / 100,
      edits,
      fixedByUser: run.output.ok && failedAt.has(line.from),
    });
    if (run.output.ok) failedAt.delete(line.from);
    else failedAt.add(line.from);
  }

  return EditorView.updateListener.of((u) => {
    if (u.docChanged) {
      if (active) active.pos = u.changes.mapPos(active.pos);
      failedAt = new Set([...failedAt].map((p) => u.changes.mapPos(p)));
    }
    const head = u.state.selection.main.head;
    const line = u.state.doc.lineAt(head);

    // Left the line (or the editor)? Then the command is done.
    if (active) {
      const activeLine = u.state.doc.lineAt(Math.min(active.pos, u.state.doc.length));
      const leftLine = activeLine.from !== line.from;
      const leftEditor = u.focusChanged && !u.view.hasFocus;
      if (leftLine || leftEditor) commit(u.view);
    }

    // Start timing from the very first "/" typed on the line.
    const typed = u.transactions.some((tr) => tr.docChanged && (tr.isUserEvent('input') || tr.isUserEvent('delete')));
    if (typed && line.text.startsWith('/')) {
      const now = performance.now();
      if (active && active.pos === line.from) {
        active.lastEditAt = now;
        active.edits++;
      } else {
        active = { pos: line.from, startedAt: now, lastEditAt: now, edits: 1 };
      }
    }
  });
}
