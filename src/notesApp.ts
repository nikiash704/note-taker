// The main screen: editor on the left, rendered notes on the right.

import { createEditor } from './editor';
import { equationShortcuts } from './shortcuts';
import { figureHints } from './figureHints';
import { usageTracker } from './usageLog';
import { suggestions, computeField, setCompute } from './suggestions';
import { Preview } from './preview';
import { loadNote, saveNote, downloadFile } from './storage';
import { figureElement } from './figures/element';
import { cheatSheetHtml } from './cheatSheet';
import { WELCOME_NOTE } from './welcome';

export function startNotes(app: HTMLElement): void {
  app.innerHTML = `
    <header class="bar">
      <div class="brand"><span class="logo" aria-hidden="true"></span>Note taker</div>
      <span class="status" id="status"></span>
      <div class="actions">
        <button class="btn" id="compute" title="When on, the app works out answers (determinants, row reduction, truth tables…) and suggests them under the command. Tab accepts. Nothing is written unless you accept." aria-pressed="false">Compute: off</button>
        <button class="btn" id="help" title="Show the shortcuts and figure commands (Ctrl+/)" aria-expanded="false">Cheat sheet</button>
        <label class="btn" title="Open a Markdown file">Open<input type="file" id="open" accept=".md,.markdown,.txt" hidden></label>
        <button class="btn primary" id="download" title="Download this note as Markdown (Ctrl/Cmd+S)">Download .md</button>
      </div>
    </header>
    <main class="panes">
      <section class="pane editor-pane" id="editor" aria-label="Editor"></section>
      <section class="pane preview-pane" aria-label="Rendered notes">
        <aside class="cheat" id="cheat" hidden>${cheatSheetHtml()}</aside>
        <article id="preview" class="paper"></article>
      </section>
    </main>
  `;

  const status = app.querySelector<HTMLSpanElement>('#status')!;

  const preview = new Preview(app.querySelector('#preview')!, figureElement, (line) => {
    const pos = editor.state.doc.line(Math.min(line, editor.state.doc.lines)).from;
    editor.dispatch({ selection: { anchor: pos }, scrollIntoView: true });
    editor.focus();
  });

  // Rendering and saving are batched so fast typing never waits on them.
  let renderQueued = false;
  let saveTimer = 0;
  let cursorLine = 1;

  function scheduleRender(doc: string) {
    if (!renderQueued) {
      renderQueued = true;
      requestAnimationFrame(() => {
        renderQueued = false;
        preview.render(editor.state.doc.toString());
        preview.follow(cursorLine);
      });
    }
    clearTimeout(saveTimer);
    status.textContent = 'Editing…';
    saveTimer = window.setTimeout(() => {
      status.textContent = saveNote(doc) ? 'Saved in this browser' : 'Not saved (storage blocked)';
    }, 400);
  }

  const editor = createEditor({
    parent: app.querySelector('#editor')!,
    doc: loadNote() ?? WELCOME_NOTE,
    onChange: scheduleRender,
    extensions: [suggestions(), equationShortcuts(), figureHints, usageTracker()],
    onCursorLine: (line) => {
      cursorLine = line;
      preview.follow(line);
    },
  });

  preview.render(editor.state.doc.toString());
  status.textContent = 'Saved in this browser';
  editor.focus();

  // ---- Toolbar ---------------------------------------------------------------

  function noteFilename(): string {
    const heading = editor.state.doc.toString().match(/^#\s+(.+)$/m)?.[1] ?? 'notes';
    const slug = heading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'notes';
    return `${slug}-${new Date().toISOString().slice(0, 10)}.md`;
  }

  function downloadNote() {
    downloadFile(noteFilename(), editor.state.doc.toString(), 'text/markdown');
  }

  // Compute switch: answers are only ever suggested, never written by themselves.
  const compute = app.querySelector<HTMLButtonElement>('#compute')!;
  const showCompute = () => {
    const on = editor.state.field(computeField);
    compute.textContent = `Compute: ${on ? 'on' : 'off'}`;
    compute.classList.toggle('on', on);
    compute.setAttribute('aria-pressed', String(on));
  };
  showCompute();
  compute.addEventListener('click', () => {
    editor.dispatch({ effects: setCompute.of(!editor.state.field(computeField)) });
    showCompute();
    editor.focus();
  });

  // The cheat sheet slides over the preview; it never takes focus from the editor.
  const help = app.querySelector<HTMLButtonElement>('#help')!;
  const cheat = app.querySelector<HTMLElement>('#cheat')!;
  function toggleHelp() {
    cheat.hidden = !cheat.hidden;
    help.classList.toggle('on', !cheat.hidden);
    help.setAttribute('aria-expanded', String(!cheat.hidden));
  }
  help.addEventListener('click', () => { toggleHelp(); editor.focus(); });

  app.querySelector('#download')!.addEventListener('click', downloadNote);
  window.addEventListener('keydown', (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 's') {
      e.preventDefault();
      downloadNote();
    } else if (mod && e.key === '/') {
      e.preventDefault();
      toggleHelp();
    }
  });

  app.querySelector<HTMLInputElement>('#open')!.addEventListener('change', async (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const text = await file.text();
    editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: text } });
    input.value = '';
    editor.focus();
  });

  if (import.meta.env.DEV) {
    import('./devtools').then(({ installDevtools }) => installDevtools(editor));
  }
}
