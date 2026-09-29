import 'katex/dist/katex.min.css';
import './style.css';
import { createEditor } from './editor';
import { Preview } from './preview';
import { loadNote, saveNote, downloadFile } from './storage';
import { escapeHtml } from './markdown';
import { WELCOME_NOTE } from './welcome';

const app = document.querySelector<HTMLDivElement>('#app')!;

app.innerHTML = `
  <header class="bar">
    <div class="brand"><span class="logo" aria-hidden="true"></span>Note taker</div>
    <span class="status" id="status"></span>
    <div class="actions">
      <label class="btn" title="Open a Markdown file">Open<input type="file" id="open" accept=".md,.markdown,.txt" hidden></label>
      <button class="btn primary" id="download" title="Download this note as Markdown (Ctrl/Cmd+S)">Download .md</button>
    </div>
  </header>
  <main class="panes">
    <section class="pane editor-pane" id="editor" aria-label="Editor"></section>
    <section class="pane preview-pane" aria-label="Rendered notes"><article id="preview" class="paper"></article></section>
  </main>
`;

const status = document.querySelector<HTMLSpanElement>('#status')!;

function renderFigurePlaceholder(line: string): HTMLElement {
  const el = document.createElement('figure');
  el.className = 'figure';
  el.innerHTML = `<code>${escapeHtml(line)}</code>`;
  return el;
}

const preview = new Preview(document.querySelector('#preview')!, renderFigurePlaceholder, (line) => {
  const pos = editor.state.doc.line(Math.min(line, editor.state.doc.lines)).from;
  editor.dispatch({ selection: { anchor: pos }, scrollIntoView: true });
  editor.focus();
});

// Rendering and saving are batched so fast typing never waits on them.
let renderQueued = false;
let saveTimer = 0;
let cursorLine = 1;

function scheduleRender(doc: string) {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    preview.render(editor.state.doc.toString());
    preview.follow(cursorLine);
  });
  clearTimeout(saveTimer);
  status.textContent = 'Editing…';
  saveTimer = window.setTimeout(() => {
    status.textContent = saveNote(doc) ? 'Saved' : 'Not saved (storage blocked)';
  }, 400);
}

const editor = createEditor({
  parent: document.querySelector('#editor')!,
  doc: loadNote() ?? WELCOME_NOTE,
  onChange: scheduleRender,
  onCursorLine: (line) => {
    cursorLine = line;
    preview.follow(line);
  },
});

preview.render(editor.state.doc.toString());
status.textContent = 'Saved';
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

document.querySelector('#download')!.addEventListener('click', downloadNote);
window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    downloadNote();
  }
});

document.querySelector<HTMLInputElement>('#open')!.addEventListener('change', async (e) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const text = await file.text();
  editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: text } });
  input.value = '';
  editor.focus();
});
