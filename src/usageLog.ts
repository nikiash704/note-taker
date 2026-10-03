// A local log of how figure commands get used, to answer the prototype's two
// questions: are commands fast enough to type during a lecture, and does the
// typo tolerance keep up? Nothing leaves the browser. See it at /stats.
//
// A command is "committed" when the cursor leaves its line (Enter, arrows,
// clicking elsewhere) or the editor loses focus. We then record how long it
// took to type, whether it drew, and what was auto-corrected.

import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { figureBlockAt } from './figureBlocks';
import { computeField } from './suggestions';
import { runFigureCached } from './figures';
import { appendLog } from './logStore';

interface Active {
  pos: number;        // start of the figure being edited (kept up to date as text changes)
  startedAt: number;
  lastEditAt: number;
  edits: number;
  suggestionsAccepted: number;
}

export function usageTracker(): Extension {
  let active: Active | null = null;
  // Figures (by start position) whose last commit failed, to spot user fixes.
  let failedAt = new Set<number>();

  function commit(view: EditorView) {
    if (!active) return;
    const { pos, startedAt, lastEditAt, edits, suggestionsAccepted } = active;
    active = null;
    if (pos > view.state.doc.length) return;
    const block = figureBlockAt(view.state.doc, view.state.doc.lineAt(pos).number);
    if (!block) return;

    const run = runFigureCached(block.text);
    const corrections = run.output.ok ? run.output.notes.filter((n) => n.includes('→')) : [];
    appendLog({
      at: Date.now(),
      line: block.text.replace(/\n\s*/g, ' ').trim(),
      typed: run.typed,
      command: run.command,
      match: run.match,
      ok: run.output.ok,
      hint: run.output.ok ? undefined : run.output.hint,
      corrections,
      typingMs: Math.round(lastEditAt - startedAt),
      parseMs: Math.round(run.ms * 100) / 100,
      edits,
      fixedByUser: run.output.ok && failedAt.has(block.from),
      lines: block.toLine - block.fromLine + 1,
      suggestionsAccepted,
      compute: view.state.field(computeField),
    });
    if (run.output.ok) failedAt.delete(block.from);
    else failedAt.add(block.from);
  }

  return EditorView.updateListener.of((u) => {
    if (u.docChanged) {
      if (active) active.pos = u.changes.mapPos(active.pos, -1);
      failedAt = new Set([...failedAt].map((p) => u.changes.mapPos(p, -1)));
    }
    const { doc } = u.state;
    const line = doc.lineAt(u.state.selection.main.head);
    const block = figureBlockAt(doc, line.number);

    // Left the figure (or the editor)? Then the command is done.
    if (active) {
      const leftFigure = !block || block.from !== doc.lineAt(Math.min(active.pos, doc.length)).from;
      const leftEditor = u.focusChanged && !u.view.hasFocus;
      if (leftFigure || leftEditor) commit(u.view);
    }

    // Start timing from the very first "/" typed on the line.
    const typed = u.transactions.some((tr) => tr.docChanged && (tr.isUserEvent('input') || tr.isUserEvent('delete')));
    const accepted = u.transactions.some((tr) => tr.isUserEvent('input.suggestion'));
    const start = block?.from ?? (line.text.startsWith('/') ? line.from : null);
    if (typed && start !== null) {
      const now = performance.now();
      if (active && active.pos === start) {
        active.lastEditAt = now;
        active.edits++;
        if (accepted) active.suggestionsAccepted++;
      } else {
        active = { pos: start, startedAt: now, lastEditAt: now, edits: 1, suggestionsAccepted: accepted ? 1 : 0 };
      }
    }
  });
}
