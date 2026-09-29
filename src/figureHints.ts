// Quiet hints at the end of figure lines in the editor:
//   /trinagle ABC right at C        → /triangle
//   /triangle ABC right at D        D isn't a vertex of ABC
// A problem is only shown once the cursor has left the line, so nothing
// flickers while you are still typing it. Never a popup.

import { RangeSetBuilder } from '@codemirror/state';
import { Decoration, ViewPlugin, WidgetType, type DecorationSet, type EditorView, type ViewUpdate } from '@codemirror/view';
import { isFigureLine } from './markdown';
import { runFigureCached } from './figures';

class HintWidget extends WidgetType {
  constructor(readonly message: string, readonly kind: 'fix' | 'problem') { super(); }
  eq(other: HintWidget) { return other.message === this.message && other.kind === this.kind; }
  toDOM() {
    const span = document.createElement('span');
    span.className = `cm-fig-hint cm-fig-hint-${this.kind}`;
    span.textContent = this.message;
    span.setAttribute('aria-hidden', 'true');
    return span;
  }
  ignoreEvent() { return true; }
}

function build(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc;
  const cursorLine = doc.lineAt(view.state.selection.main.head).number;
  for (const { from, to } of view.visibleRanges) {
    for (let pos = from; pos <= to; ) {
      const line = doc.lineAt(pos);
      pos = line.to + 1;
      if (!isFigureLine(line.text)) continue;
      const run = runFigureCached(line.text);
      let hint: HintWidget | null = null;
      if (!run.output.ok && line.number !== cursorLine) hint = new HintWidget(run.output.hint, 'problem');
      else if (run.command && run.match !== 'exact') hint = new HintWidget(`→ /${run.command}`, 'fix');
      if (hint) builder.add(line.to, line.to, Decoration.widget({ widget: hint, side: 1 }));
    }
  }
  return builder.finish();
}

export const figureHints = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) { this.decorations = build(view); }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged || u.selectionSet) this.decorations = build(u.view);
    }
  },
  { decorations: (v) => v.decorations },
);
