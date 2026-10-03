// Suggested answers, like suggestions in an email app.
//
// When Compute is on and the cursor is in a block such as /det or /rref, the
// app works out the answer and shows it as faint "+ …" lines under the block.
// Nothing is written into the note until you press Tab (or click "accept").
// Esc hides the suggestion for that block.
//
// Also here: Shift+Enter on a figure line starts a "+ " line below it.

import { StateField, StateEffect, Prec, type Extension, type EditorState } from '@codemirror/state';
import { Decoration, EditorView, WidgetType, keymap, type DecorationSet } from '@codemirror/view';
import { figureBlockAt } from './figureBlocks';
import { suggestFor } from './figures';
import { readJSON, writeJSON } from './storage';

// ---- The Compute switch ---------------------------------------------------------

const COMPUTE_KEY = 'nt.compute';

export function loadCompute(): boolean {
  return readJSON<boolean>(COMPUTE_KEY, false);
}

export const setCompute = StateEffect.define<boolean>();

export const computeField = StateField.define<boolean>({
  create: () => loadCompute(),
  update(on, tr) {
    for (const e of tr.effects) if (e.is(setCompute)) {
      writeJSON(COMPUTE_KEY, e.value);
      return e.value;
    }
    return on;
  },
});

// ---- Which suggestion is showing ----------------------------------------------------

interface Showing {
  /** Where to insert: the end of the block's last line. */
  at: number;
  lines: string[];
  blockText: string;
}

const dismiss = StateEffect.define<string>();

/** Blocks (by their text) whose suggestion was dismissed with Esc. */
const dismissedField = StateField.define<Set<string>>({
  create: () => new Set(),
  update(set, tr) {
    for (const e of tr.effects) if (e.is(dismiss)) return new Set(set).add(e.value);
    return set;
  },
});

function currentSuggestion(state: EditorState): Showing | null {
  if (!state.field(computeField)) return null;
  const head = state.selection.main.head;
  const block = figureBlockAt(state.doc, state.doc.lineAt(head).number);
  if (!block || state.field(dismissedField).has(block.text)) return null;
  const lines = suggestFor(block.text);
  return lines ? { at: block.to, lines, blockText: block.text } : null;
}

class GhostWidget extends WidgetType {
  constructor(readonly lines: string[]) { super(); }
  eq(other: GhostWidget) { return other.lines.join('\n') === this.lines.join('\n'); }
  toDOM(view: EditorView) {
    const wrap = document.createElement('div');
    wrap.className = 'cm-ghost';
    for (const l of this.lines) {
      const row = document.createElement('div');
      row.className = 'cm-ghost-line';
      row.textContent = `  + ${l}`;
      wrap.append(row);
    }
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'cm-ghost-chip';
    chip.innerHTML = '<kbd>Tab</kbd> accept · <kbd>Esc</kbd> hide';
    chip.addEventListener('mousedown', (e) => {
      e.preventDefault();
      accept(view);
    });
    wrap.append(chip);
    return wrap;
  }
  ignoreEvent() { return false; }
}

const ghostField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(_deco, tr) {
    const s = currentSuggestion(tr.state);
    if (!s) return Decoration.none;
    return Decoration.set([Decoration.widget({ widget: new GhostWidget(s.lines), side: 1, block: true }).range(s.at)]);
  },
  provide: (f) => EditorView.decorations.from(f),
});

/** Write the suggested lines into the note. */
function accept(view: EditorView): boolean {
  const s = currentSuggestion(view.state);
  if (!s) return false;
  const insert = s.lines.map((l) => `\n  + ${l}`).join('');
  view.dispatch({
    changes: { from: s.at, insert },
    selection: { anchor: s.at + insert.length },
    userEvent: 'input.suggestion',
    scrollIntoView: true,
  });
  return true;
}

function hide(view: EditorView): boolean {
  const s = currentSuggestion(view.state);
  if (!s) return false;
  view.dispatch({ effects: dismiss.of(s.blockText) });
  return true;
}

/** Shift+Enter inside a figure block: a new "+ " line, so the figure continues. */
function continueFigure(view: EditorView): boolean {
  const { state } = view;
  const line = state.doc.lineAt(state.selection.main.head);
  if (!figureBlockAt(state.doc, line.number)) return false;
  const insert = '\n  + ';
  view.dispatch({
    changes: { from: line.to, insert },
    selection: { anchor: line.to + insert.length },
    userEvent: 'input',
    scrollIntoView: true,
  });
  return true;
}

export function suggestions(): Extension {
  return [
    computeField,
    dismissedField,
    ghostField,
    Prec.highest(keymap.of([
      { key: 'Tab', run: accept },
      { key: 'Escape', run: hide },
      { key: 'Shift-Enter', run: continueFigure },
    ])),
  ];
}
