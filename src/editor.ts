// The CodeMirror editor: plain Markdown text, with math and figure lines
// tinted so you can see at a glance what will be rendered.

import { EditorState, RangeSetBuilder, type Extension } from '@codemirror/state';
import {
  EditorView, Decoration, ViewPlugin, keymap, drawSelection, highlightActiveLine,
  placeholder, type DecorationSet, type ViewUpdate,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { tags } from '@lezer/highlight';
import { findMathRegions } from './mathRegions';
import { isFigureLine } from './markdown';

const mathMark = Decoration.mark({ class: 'cm-math' });
const figureLine = Decoration.line({ class: 'cm-figure-line' });

/** Tint $math$ and /figure lines inside the visible part of the editor. */
const tint = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = this.build(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged) this.decorations = this.build(u.view);
    }
    build(view: EditorView): DecorationSet {
      const doc = view.state.doc;
      const { from: vFrom, to: vTo } = view.viewport;
      const marks: { from: number; to: number; deco: Decoration }[] = [];

      for (const r of findMathRegions(doc.toString())) {
        if (r.to < vFrom) continue;
        if (r.from > vTo) break;
        if (r.to > r.from) marks.push({ from: r.from, to: r.to, deco: mathMark });
      }
      for (let pos = vFrom; pos <= vTo; ) {
        const line = doc.lineAt(pos);
        if (isFigureLine(line.text)) marks.push({ from: line.from, to: line.from, deco: figureLine });
        pos = line.to + 1;
      }

      marks.sort((a, b) => a.from - b.from || (a.deco === figureLine ? -1 : 1));
      const builder = new RangeSetBuilder<Decoration>();
      for (const m of marks) builder.add(m.from, m.to, m.deco);
      return builder.finish();
    }
  },
  { decorations: (v) => v.decorations },
);

const highlight = HighlightStyle.define([
  { tag: tags.heading1, fontWeight: '700', fontSize: '1.3em' },
  { tag: tags.heading2, fontWeight: '700', fontSize: '1.15em' },
  { tag: [tags.heading3, tags.heading4, tags.heading5, tags.heading6], fontWeight: '700' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.monospace, color: 'var(--muted)' },
  { tag: [tags.processingInstruction, tags.meta], color: 'var(--faint)' },
  { tag: tags.quote, color: 'var(--muted)' },
]);

export interface EditorOptions {
  parent: HTMLElement;
  doc: string;
  onChange: (doc: string) => void;
  onCursorLine: (line: number) => void;
  /** Extra behaviour added by later features (shortcuts, figure hints, logging). */
  extensions?: Extension[];
}

export function createEditor(opts: EditorOptions): EditorView {
  const listener = EditorView.updateListener.of((u) => {
    if (u.docChanged) opts.onChange(u.state.doc.toString());
    if (u.docChanged || u.selectionSet) opts.onCursorLine(u.state.doc.lineAt(u.state.selection.main.head).number);
  });

  return new EditorView({
    parent: opts.parent,
    state: EditorState.create({
      doc: opts.doc,
      extensions: [
        // Feature extensions go first so their keys (Tab, Enter) win.
        ...(opts.extensions ?? []),
        history(),
        drawSelection(),
        highlightActiveLine(),
        closeBrackets(),
        markdown(),
        syntaxHighlighting(highlight),
        EditorView.lineWrapping,
        placeholder('Type notes. $x^2$ for math, /plot sin x from -pi to pi for figures.'),
        keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
        tint,
        listener,
      ],
    }),
  });
}
