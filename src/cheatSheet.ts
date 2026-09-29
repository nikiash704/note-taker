// The "Cheat sheet" panel: every figure command and the main equation shortcuts.

import { COMMANDS, SYNONYMS } from './figures';
import { escapeHtml, renderInline } from './markdown';

// Results are Markdown: $…$ is rendered as math.
const SHORTCUTS: [string, string][] = [
  ['mk / dm', 'start inline / display math'],
  ['x/', '$\\frac{x}{\\square}$, also (a+b)/'],
  ['Tab', 'next box, then out of the bracket, then out of the math'],
  ['@a @b @t @l', '$\\alpha\\ \\beta\\ \\theta\\ \\lambda$ …'],
  ['xbar xhat xvec xdot', '$\\bar{x}\\ \\hat{x}\\ \\vec{x}\\ \\dot{x}$'],
  ['sqrt int sum lim', '$\\sqrt{\\square}\\ \\int_a^b\\ \\sum_{i=1}^n\\ \\lim_{n\\to\\infty}$'],
  ['mat bmat vmat', 'matrix: Tab = next column, Enter = next row, Enter on an empty row = done'],
  ['sin cos ln exp', '$\\sin\\ \\cos\\ \\ln\\ \\exp$ …'],
  ['xsr xcb xrd', '$x^2\\ \\ x^3\\ \\ x^{\\square}$'],
  ['-> => <= >= !=', '$\\to\\ \\implies\\ \\le\\ \\ge\\ \\neq$'],
  ['ooo xx ** ...', '$\\infty\\ \\times\\ \\cdot\\ \\dots$'],
  ['RR NN ZZ QQ', '$\\mathbb{R}\\ \\mathbb{N}\\ \\mathbb{Z}\\ \\mathbb{Q}$'],
  ['inn notin EE AA', '$\\in\\ \\notin\\ \\exists\\ \\forall$'],
  ['Cmd/Ctrl+Z', 'undo an expansion you didn’t want'],
];

export function cheatSheetHtml(): string {
  const synonymsFor = (name: string) =>
    Object.entries(SYNONYMS).filter(([, target]) => target === name).map(([s]) => '/' + s).slice(0, 4);

  return `
    <h3>Figures <span class="muted">a line starting with /</span></h3>
    <dl>
      ${COMMANDS.map((c) => `
        <dt><code>${escapeHtml(c.example)}</code></dt>
        <dd>${escapeHtml(c.description)}${synonymsFor(c.name).length ? ` <span class="muted">Also ${synonymsFor(c.name).join(', ')}.</span>` : ''}</dd>`).join('')}
    </dl>
    <p class="muted">Typos are fine: /trinagle, /plto, “rigth at C”, “form -pi to pi”.</p>
    <h3>Inside math</h3>
    <dl class="compact">
      ${SHORTCUTS.map(([keys, result]) => `<dt><code>${escapeHtml(keys)}</code></dt><dd>${renderInline(result)}</dd>`).join('')}
    </dl>
    <p class="muted">Ctrl+/ toggles this panel. Cmd/Ctrl+S downloads the note.</p>
  `;
}
