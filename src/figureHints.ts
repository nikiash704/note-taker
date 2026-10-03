// Quiet hints at the end of figure commands in the editor:
//   /trinagle ABC right at C        → /triangle
//   /triangle ABC right at D        D isn't a vertex of ABC
// A problem is only shown once the cursor has left the figure, so nothing
// flickers while you are still typing it. Never a popup.

import { RangeSetBuilder } from '@codemirror/state';
import { Decoration, ViewPlugin, WidgetType, type DecorationSet, type EditorView, type ViewUpdate } from '@codemirror/view';
import { figureBlocksIn } from './figureBlocks';
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
  const { doc } = view.state;
  const cursorLine = doc.lineAt(view.state.selection.main.head).number;
  const seen = new Set<number>();
  for (const { from, to } of view.visibleRanges) {
    for (const block of figureBlocksIn(doc, from, to)) {
      if (seen.has(block.from)) continue;
      seen.add(block.from);
      const run = runFigureCached(block.text);
      const inside = cursorLine >= block.fromLine && cursorLine <= block.toLine;
      let hint: HintWidget | null = null;
      if (!run.output.ok && !inside) hint = new HintWidget(run.output.hint, 'problem');
      else if (run.command && (run.match === 'typo' || run.match === 'prefix')) hint = new HintWidget(`→ /${run.command}`, 'fix');
      if (hint) builder.add(doc.line(block.fromLine).to, doc.line(block.fromLine).to, Decoration.widget({ widget: hint, side: 1 }));
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
