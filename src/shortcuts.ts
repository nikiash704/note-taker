// Wires the equation shortcuts (snippets.ts) into CodeMirror:
//  - expand a shortcut as soon as its last key is typed
//  - Tab walks through the snippet's stops, then "tabs out" of brackets and math
//  - inside a matrix, Tab adds a column (&) and Enter adds a row (\\);
//    Enter on an empty row leaves the matrix
//  - Ctrl/Cmd+Z right after an expansion gives back what you typed

import { StateField, StateEffect, Prec, EditorSelection, type Extension } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { isolateHistory } from '@codemirror/commands';
import { findExpansion, parseTemplate } from './snippets';
import { mathAt, type MathRegion } from './mathRegions';
import { figureBlockAt } from './figureBlocks';

// ---- Remembered stops -------------------------------------------------------

interface Range { from: number; to: number }
interface Stops { list: Range[]; area: Range }

const setStops = StateEffect.define<Stops | null>();

const stopsField = StateField.define<Stops | null>({
  create: () => null,
  update(stops, tr) {
    for (const e of tr.effects) if (e.is(setStops)) return e.value;
    if (!stops) return null;
    if (tr.docChanged) {
      const map = (r: Range, left: -1 | 1): Range => ({
        from: tr.changes.mapPos(r.from, left),
        to: tr.changes.mapPos(r.to, 1),
      });
      stops = { list: stops.list.map((r) => map(r, 1)), area: map(stops.area, -1) };
    }
    // Moving the cursor away from the snippet forgets its stops.
    const head = tr.state.selection.main.head;
    if (head < stops.area.from || head > stops.area.to) return null;
    return stops;
  },
});

function insertSnippet(view: EditorView, from: number, to: number, template: string) {
  const { text, stops } = parseTemplate(template);
  const abs = stops.map((s) => ({ from: from + s.from, to: from + s.to }));
  const first = abs.shift() ?? { from: from + text.length, to: from + text.length };
  view.dispatch({
    changes: { from, to, insert: text },
    selection: EditorSelection.single(first.from, first.to),
    effects: setStops.of(abs.length ? { list: abs, area: { from, to: from + text.length } } : null),
    annotations: isolateHistory.of('full'),
    userEvent: 'input.complete',
    scrollIntoView: true,
  });
}

// ---- Expanding as you type ---------------------------------------------------

const expandOnInput = EditorView.inputHandler.of((view, from, to, text, insert) => {
  if (text.length !== 1 || from !== to || view.state.selection.ranges.length > 1) return false;
  const line = view.state.doc.lineAt(from);
  if (figureBlockAt(view.state.doc, line.number)) return false;

  const mode = mathAt(view.state.doc.toString(), from) ? 'math' : 'text';
  const before = line.text.slice(0, from - line.from) + text;
  const expansion = findExpansion(before, mode);
  if (!expansion) return false;

  // Two steps so undo can take back just the expansion.
  view.dispatch(insert());
  const end = from + 1;
  insertSnippet(view, end - expansion.length, end, expansion.template);
  return true;
});

// ---- Tab ------------------------------------------------------------------------

const OPENERS = '({[';
const CLOSERS = ')}]';

/** Position just after the bracket that closes the group the cursor is in. */
function closingBracketAfter(text: string, pos: number, limit: number): number | null {
  let depth = 0;
  for (let i = pos; i < limit; i++) {
    const c = text[i];
    if (c === '\\') {
      // "\{" and "\}" are literal braces, skip them.
      if (text[i + 1] === '{' || text[i + 1] === '}') i++;
      continue;
    }
    if (OPENERS.includes(c)) depth++;
    else if (CLOSERS.includes(c)) {
      if (depth === 0) return i + 1;
      depth--;
    }
  }
  return null;
}

/** Past the closing $ or $$ of the math region. */
function endOfMath(region: MathRegion): number {
  return region.closed ? region.to + (region.display ? 2 : 1) : region.to;
}

interface Env { name: string; bodyFrom: number; bodyTo: number }

const ENV = /\\(begin|end)\{(\w*matrix|cases|aligned|align\*?|array)\}/g;

/** The matrix-like environment the cursor is inside, if any. */
function envAt(text: string, pos: number, region: MathRegion): Env | null {
  const inside = text.slice(region.from, region.to);
  const offset = pos - region.from;
  const opened: { name: string; bodyFrom: number }[] = [];
  for (const m of inside.matchAll(ENV)) {
    const at = m.index!;
    if (m[1] === 'begin') {
      opened.push({ name: m[2], bodyFrom: at + m[0].length });
    } else {
      const env = opened.pop();
      if (env && env.bodyFrom <= offset && at >= offset) {
        return { name: env.name, bodyFrom: region.from + env.bodyFrom, bodyTo: region.from + at };
      }
    }
  }
  // Unclosed environment: its body runs to the end of the math.
  const current = opened.filter((e) => e.bodyFrom <= offset).pop();
  return current ? { name: current.name, bodyFrom: region.from + current.bodyFrom, bodyTo: region.to } : null;
}

function tab(view: EditorView): boolean {
  const state = view.state;
  const sel = state.selection.main;
  const text = state.doc.toString();
  const region = mathAt(text, sel.head);
  const stops = state.field(stopsField);
  const env = region ? envAt(text, sel.head, region) : null;
  const next = stops?.list[0];

  // 1. Next snippet stop (unless it would jump out of the matrix we're filling).
  if (next && (!env || next.from <= env.bodyTo)) {
    const rest = stops!.list.slice(1);
    view.dispatch({
      selection: EditorSelection.single(next.from, next.to),
      effects: setStops.of(rest.length ? { ...stops!, list: rest } : null),
      scrollIntoView: true,
    });
    return true;
  }
  if (!region) return false; // plain text: normal indent

  // 2. Inside a matrix: leave a bracket first, otherwise add a column.
  const limit = env ? env.bodyTo : region.to;
  const out = closingBracketAfter(text, sel.head, limit);
  if (out !== null) {
    view.dispatch({ selection: { anchor: out } });
    return true;
  }
  if (env) {
    view.dispatch(state.replaceSelection(' & '));
    return true;
  }

  // 3. Tab out of the math altogether.
  view.dispatch({ selection: { anchor: endOfMath(region) }, effects: setStops.of(null) });
  return true;
}

// ---- Enter inside a matrix ------------------------------------------------------------

function enter(view: EditorView): boolean {
  const state = view.state;
  const sel = state.selection.main;
  if (!sel.empty) return false;
  const text = state.doc.toString();
  const region = mathAt(text, sel.head);
  const env = region && envAt(text, sel.head, region);
  if (!region || !env) return false;

  const body = text.slice(env.bodyFrom, env.bodyTo);
  const offset = sel.head - env.bodyFrom;
  const prevSep = body.lastIndexOf('\\\\', offset - 1);
  const rowStart = prevSep === -1 ? 0 : prevSep + 2;
  const nextSep = body.indexOf('\\\\', offset);
  const rowEnd = nextSep === -1 ? body.length : nextSep;
  const rowIsEmpty = body.slice(rowStart, rowEnd).trim() === '';

  if (rowIsEmpty) {
    // Leave the matrix: drop the empty row and jump past \end{…}.
    const endTag = `\\end{${env.name}}`;
    const removeFrom = prevSep === -1 ? sel.head : env.bodyFrom + body.slice(0, prevSep).trimEnd().length;
    const removeTo = prevSep === -1 ? sel.head : env.bodyFrom + rowEnd;
    const keep = prevSep === -1 ? '' : ' ';
    const afterEnd = removeFrom + keep.length + (env.bodyTo - removeTo) + endTag.length;
    view.dispatch({
      changes: { from: removeFrom, to: removeTo, insert: keep },
      selection: { anchor: Math.min(afterEnd, text.length) },
      effects: setStops.of(null),
    });
    return true;
  }

  const line = state.doc.lineAt(sel.head);
  const indent = line.text.match(/^\s*/)![0];
  view.dispatch(state.replaceSelection(region.display ? ` \\\\\n${indent}` : ' \\\\ '));
  return true;
}

// ---- Put it together --------------------------------------------------------------------

export function equationShortcuts(): Extension {
  return [
    stopsField,
    expandOnInput,
    Prec.high(
      keymap.of([
        { key: 'Tab', run: tab },
        { key: 'Enter', run: enter },
        {
          key: 'Escape',
          run: (view) => {
            if (!view.state.field(stopsField)) return false;
            view.dispatch({ effects: setStops.of(null) });
            return true;
          },
        },
      ]),
    ),
  ];
}
