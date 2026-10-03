// Turns a figure block into the element shown in the preview: a drawing
// (with Download SVG), a maths block (with Copy LaTeX), or a quiet hint.

import { runFigureCached } from './index';
import { downloadFile } from '../storage';
import { escapeHtml, renderMath } from '../markdown';

let downloads = 0;

function toolButton(label: string, title: string, onClick: (button: HTMLButtonElement) => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.title = title;
  button.addEventListener('click', () => onClick(button));
  return button;
}

export function figureElement(block: string): HTMLElement {
  const run = runFigureCached(block);
  const el = document.createElement('figure');
  el.className = 'figure';

  if (!run.output.ok) {
    el.classList.add('figure-failed');
    const firstLine = block.split('\n')[0].trim();
    el.innerHTML = `<div class="fig-hint"><code>${escapeHtml(firstLine)}</code> — ${escapeHtml(run.output.hint)}</div>`;
    return el;
  }

  const { svg, latex, html, notes } = run.output;
  const tools = document.createElement('div');
  tools.className = 'fig-tools';

  if (svg) {
    el.innerHTML = svg;
    tools.append(toolButton('Download SVG', 'Download this figure as an SVG file', () => {
      // currentColor has no page to inherit from in a standalone file: make it black.
      const standalone = svg.replace('<svg ', '<svg color="#111" ');
      downloadFile(`${run.command}-${++downloads}.svg`, standalone, 'image/svg+xml');
    }));
  } else if (latex) {
    el.classList.add('figure-math');
    el.innerHTML = renderMath(latex, true);
    tools.append(toolButton('Copy LaTeX', 'Copy the LaTeX source of this block', (button) => {
      navigator.clipboard?.writeText(latex).then(() => {
        button.textContent = 'Copied';
        setTimeout(() => (button.textContent = 'Copy LaTeX'), 1200);
      });
    }));
  } else if (html) {
    el.classList.add('figure-html');
    el.innerHTML = html;
  }

  if (notes.length) {
    const note = document.createElement('figcaption');
    note.className = 'fig-note';
    note.textContent = notes.join(' · ');
    el.append(note);
  }
  if (tools.childElementCount) el.append(tools);
  return el;
}
