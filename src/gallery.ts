// The /gallery page: every figure command with its example, drawn.

import { COMMANDS } from './figures';
import { figureElement } from './figures/element';
import { escapeHtml } from './html';

export function renderGallery(root: HTMLElement): void {
  document.title = 'Gallery · Note taker';
  const areas = [...new Set(COMMANDS.map((c) => c.area))];
  root.innerHTML = `
    <header class="bar">
      <div class="brand"><span class="logo" aria-hidden="true"></span>Note taker · gallery</div>
      <div class="actions"><a class="btn primary" href="/">Back to notes</a></div>
    </header>
    <main class="gallery">
      <p class="lede">Every figure command with an example. Type the grey text into a note to get the drawing.
      One line with “;” works the same as the “+” lines.</p>
      ${areas.map((area) => `<h2>${escapeHtml(area)}</h2><div class="gallery-grid" data-area="${escapeHtml(area)}"></div>`).join('')}
    </main>`;
  for (const cmd of COMMANDS) {
    const grid = root.querySelector<HTMLElement>(`.gallery-grid[data-area="${CSS.escape(cmd.area)}"]`)!;
    const card = document.createElement('section');
    card.className = 'gallery-card paper';
    card.innerHTML = `<h3>/${escapeHtml(cmd.name)}</h3><p class="muted">${escapeHtml(cmd.description)}</p><pre>${escapeHtml(cmd.example)}</pre>`;
    card.append(figureElement(cmd.example));
    grid.append(card);
  }
}
