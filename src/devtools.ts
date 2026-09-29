// Development-only helper (never included in the production build).
// `window.__nt.type("mk@a\t")` replays keystrokes through CodeMirror's real
// input and key handlers, so shortcuts can be checked from the console.
// "\t" = Tab, "\n" = Enter, "\x1b" = Escape.

import { EditorView, runScopeHandlers } from '@codemirror/view';

export function installDevtools(view: EditorView) {
  const KEYS: Record<string, string> = { '\t': 'Tab', '\n': 'Enter', '\x1b': 'Escape' };

  function typeChar(ch: string) {
    const { from, to } = view.state.selection.main;
    const insert = () =>
      view.state.update({ changes: { from, to, insert: ch }, selection: { anchor: from + ch.length }, userEvent: 'input.type' });
    for (const handler of view.state.facet(EditorView.inputHandler)) {
      if (handler(view, from, to, ch, insert)) return;
    }
    view.dispatch(insert());
  }

  function type(keys: string) {
    for (const ch of keys) {
      const key = KEYS[ch];
      if (key) {
        const event = new KeyboardEvent('keydown', { key });
        if (!runScopeHandlers(view, event, 'editor')) typeChar(ch);
      } else {
        typeChar(ch);
      }
    }
    return view.state.doc.toString();
  }

  (window as unknown as { __nt: unknown }).__nt = { view, type };
}
