// The "Cheat sheet" panel: how figures work, every command grouped by
// subject (examples in the multi-line style), and the equation shortcuts.

import { COMMANDS, SYNONYMS } from './figures';
import { escapeHtml, renderInline } from './markdown';

// Results are Markdown: $…$ is rendered as math.
const SHORTCUTS: [string, string][] = [
  ['mk / dm', 'start inline / display math'],
  ['x/', '$\\frac{x}{\\square}$, also (a+b)/'],
  ['Tab', 'next box, then out of the bracket, then out of the math'],
  ['@a @b @t @l …', '$\\alpha\\ \\beta\\ \\theta\\ \\lambda$ … (capital for $\\Gamma\\ \\Delta\\ \\Sigma$ …)'],
  ['xbar xhat xvec xdot', '$\\bar{x}\\ \\hat{x}\\ \\vec{x}\\ \\dot{x}$'],
  ['sqrt int sum prod lim', '$\\sqrt{\\square}\\ \\int_a^b\\ \\sum_{i=1}^n\\ \\prod\\ \\lim_{n\\to\\infty}$'],
  ['par ddx', '$\\frac{\\partial}{\\partial}\\ \\ \\frac{d}{dx}$'],
  ['grad div curl', '$\\nabla\\ \\ \\nabla\\cdot\\ \\ \\nabla\\times$'],
  ['mat bmat vmat cases align', 'matrices and environments: Tab = next column, Enter = next row, Enter on an empty row = done'],
  ['sin cos ln exp …', '$\\sin\\ \\cos\\ \\ln\\ \\exp$ …'],
  ['xsr xcb xrd x__', '$x^2\\ \\ x^3\\ \\ x^{\\square}\\ \\ x_{\\square}$'],
  ['Ainv Atp Adag', '$A^{-1}\\ \\ A^{\\top}\\ \\ A^{\\dagger}$'],
  ['tr rank ker span det', '$\\operatorname{tr}\\ \\operatorname{rank}\\ \\operatorname{ker}\\ \\operatorname{span}\\ \\det$'],
  ['norm abs ceil floor << >>', '$\\|\\cdot\\|\\ \\ |\\cdot|\\ \\ \\lceil\\cdot\\rceil\\ \\ \\lfloor\\cdot\\rfloor\\ \\ \\langle\\cdot\\rangle$'],
  ['-> => <= >= != |->', '$\\to\\ \\implies\\ \\le\\ \\ge\\ \\neq\\ \\mapsto$'],
  ['=== ~~ sim propto', '$\\equiv\\ \\approx\\ \\sim\\ \\propto$'],
  ['ooo xx ** ...', '$\\infty\\ \\times\\ \\cdot\\ \\dots$'],
  ['RR NN ZZ QQ CC', '$\\mathbb{R}\\ \\mathbb{N}\\ \\mathbb{Z}\\ \\mathbb{Q}\\ \\mathbb{C}$'],
  ['inn notin sub sps', '$\\in\\ \\notin\\ \\subseteq\\ \\supseteq$'],
  ['cup cap sm empty', '$\\cup\\ \\cap\\ \\setminus\\ \\emptyset$'],
  ['EE AA iff', '$\\exists\\ \\forall\\ \\iff$'],
  ['mod pmod iso nsub', '$\\bmod\\ \\ \\pmod{n}\\ \\ \\cong\\ \\ \\trianglelefteq$'],
  ['oplus otimes circ', '$\\oplus\\ \\otimes\\ \\circ$'],
  ['sup inf lsup linf', '$\\sup\\ \\inf\\ \\limsup\\ \\liminf$'],
  ['conj Re Im arg', '$\\overline{z}\\ \\operatorname{Re}\\ \\operatorname{Im}\\ \\arg$'],
  ['EV Pr Var Cov iid', '$\\mathbb{E}[\\cdot]\\ \\Pr\\ \\operatorname{Var}\\ \\operatorname{Cov}\\ \\overset{\\text{iid}}{\\sim}$'],
  ['inj surj', '$\\hookrightarrow\\ \\twoheadrightarrow$'],
  ['bf cal frak binom', '$\\mathbf{v}\\ \\mathcal{A}\\ \\mathfrak{g}\\ \\binom{n}{k}$'],
  ['Cmd/Ctrl+Z', 'undo an expansion you didn’t want'],
];

export function cheatSheetHtml(): string {
  const synonymsFor = (name: string) =>
    Object.entries(SYNONYMS).filter(([, target]) => target === name).map(([s]) => '/' + s).slice(0, 5);
  const areas = [...new Set(COMMANDS.map((c) => c.area))];

  return `
    <input class="cheat-search" id="cheat-search" type="search" placeholder="Filter: matrix, venn, normal…" aria-label="Filter the cheat sheet">
    <h3>How figures work</h3>
    <ul class="cheat-how">
      <li>A line starting with <code>/</code> is a figure. Extra details go on <code>+</code> lines below it (<kbd>Shift+Enter</kbd> starts one) — or on the same line after <code>;</code>.</li>
      <li>Typos are fine: /trinagle, /plto, “rigth at C”.</li>
      <li><b>Compute</b> (top bar): when on, answers such as determinants, row operations, truth tables or probabilities appear as faint suggestions. <kbd>Tab</kbd> accepts, <kbd>Esc</kbd> hides. Nothing is written unless you accept.</li>
      <li><a href="/gallery" target="_blank">See every command drawn →</a></li>
    </ul>
    ${areas.map((area) => `
      <section class="cheat-area" data-area="${escapeHtml(area)}">
        <h3>${escapeHtml(area)}</h3>
        <dl>
          ${COMMANDS.filter((c) => c.area === area).map((c) => `
            <div class="cheat-cmd" data-search="${escapeHtml(`${c.name} ${synonymsFor(c.name).join(' ')} ${c.description}`.toLowerCase())}">
              <dt><pre>${escapeHtml(c.example)}</pre></dt>
              <dd>${escapeHtml(c.description)}${synonymsFor(c.name).length ? ` <span class="muted">Also ${synonymsFor(c.name).join(', ')}.</span>` : ''}</dd>
            </div>`).join('')}
        </dl>
      </section>`).join('')}
    <section class="cheat-area" data-area="shortcuts">
      <h3>Inside math ($…$)</h3>
      <dl class="compact">
        ${SHORTCUTS.map(([keys, result]) => `<div class="cheat-cmd" data-search="${escapeHtml(`${keys} ${result}`.toLowerCase())}"><dt><code>${escapeHtml(keys)}</code></dt><dd>${renderInline(result)}</dd></div>`).join('')}
      </dl>
    </section>
    <p class="muted">Ctrl+/ toggles this panel. Cmd/Ctrl+S downloads the note.</p>
  `;
}

/** Wire up the filter box once the panel is in the page. */
export function wireCheatSheet(root: HTMLElement): void {
  const input = root.querySelector<HTMLInputElement>('#cheat-search');
  input?.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    root.querySelectorAll<HTMLElement>('.cheat-cmd').forEach((el) => {
      el.hidden = !!q && !el.dataset.search!.includes(q);
    });
    root.querySelectorAll<HTMLElement>('.cheat-area').forEach((sec) => {
      sec.hidden = !!q && !sec.querySelector('.cheat-cmd:not([hidden])');
    });
  });
}
