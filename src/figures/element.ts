// Turns a figure command line into the element shown in the preview:
// the drawing plus a download button, or a quiet hint.

import { runFigure } from './index';
import { downloadFile } from '../storage';
import { escapeHtml } from '../markdown';

let downloads = 0;

export function figureElement(line: string): HTMLElement {
  const run = runFigure(line);
  const el = document.createElement('figure');
  el.className = 'figure';

  if (!run.output.ok) {
    el.classList.add('figure-failed');
    el.innerHTML = `<div class="fig-hint"><code>${escapeHtml(line.trim())}</code> — ${escapeHtml(run.output.hint)}</div>`;
    return el;
  }

  const { svg, notes } = run.output;
  el.innerHTML = svg;
  if (notes.length) {
    const note = document.createElement('figcaption');
    note.className = 'fig-note';
    note.textContent = notes.join(' · ');
    el.append(note);
  }

  const tools = document.createElement('div');
  tools.className = 'fig-tools';
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Download SVG';
  button.title = 'Download this figure as an SVG file';
  button.addEventListener('click', () => {
    // currentColor has no page to inherit from in a standalone file: make it black.
    const standalone = svg.replace('<svg ', '<svg color="#111" ');
    downloadFile(`${run.command}-${++downloads}.svg`, standalone, 'image/svg+xml');
  });
  tools.append(button);
  el.append(tools);
  return el;
}
