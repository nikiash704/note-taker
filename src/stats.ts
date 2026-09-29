// The hidden /stats page: what the usage log says about the prototype's
// two questions. Everything here is read from this browser's localStorage.

import { readLog, clearLog, type LogEntry } from './logStore';
import { downloadFile } from './storage';
import { escapeHtml } from './html';

const BUDGET_MS = 10;

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function percentile(xs: number[], p: number): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '–');

function toCSV(log: LogEntry[]): string {
  const cols: (keyof LogEntry)[] = ['at', 'line', 'typed', 'command', 'match', 'ok', 'hint', 'corrections', 'typingMs', 'parseMs', 'edits', 'fixedByUser'];
  const cell = (v: unknown) => {
    const s = Array.isArray(v) ? v.join('; ') : v === undefined || v === null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...log.map((e) => cols.map((c) => cell(c === 'at' ? new Date(e.at).toISOString() : e[c])).join(','))].join('\n');
}

export function renderStats(root: HTMLElement): void {
  document.title = 'Usage stats · Note taker';
  const log = readLog();
  const ok = log.filter((e) => e.ok);
  const failed = log.filter((e) => !e.ok);
  const corrected = log.filter((e) => e.corrections.length > 0);
  const fixedByUser = log.filter((e) => e.fixedByUser);
  const typing = log.map((e) => e.typingMs);
  const parse = log.map((e) => e.parseMs);
  const overBudget = parse.filter((ms) => ms > BUDGET_MS).length;

  const byCommand = new Map<string, LogEntry[]>();
  for (const e of log) {
    const key = e.command ?? `/${e.typed} (unknown)`;
    byCommand.set(key, [...(byCommand.get(key) ?? []), e]);
  }

  const card = (label: string, value: string, sub = '') =>
    `<div class="stat"><div class="stat-value">${value}</div><div class="stat-label">${label}</div>${sub ? `<div class="stat-sub">${sub}</div>` : ''}</div>`;

  root.innerHTML = `
    <header class="bar">
      <div class="brand"><span class="logo" aria-hidden="true"></span>Note taker · usage stats</div>
      <div class="actions">
        <button class="btn" id="csv">Download CSV</button>
        <button class="btn" id="json">Download JSON</button>
        <button class="btn" id="clear">Clear log</button>
        <a class="btn primary" href="/">Back to notes</a>
      </div>
    </header>
    <main class="stats">
      <p class="lede">Stored only in this browser. A command is logged when the cursor leaves its line.</p>
      ${log.length === 0 ? '<p class="empty-state">No figure commands logged yet. Type a few /plot or /triangle lines in your notes, then come back.</p>' : `
      <h2>Q1 · Fast enough to keep up?</h2>
      <div class="stat-row">
        ${card('commands logged', String(log.length))}
        ${card('drew first time', pct(ok.length - fixedByUser.length, log.length), `${failed.length} failed`)}
        ${card('median typing time', seconds(median(typing)), `90% under ${seconds(percentile(typing, 90))}`)}
        ${card('fixed by retyping', String(fixedByUser.length), 'failed, then edited until it drew')}
      </div>
      <h2>Q2 · Does typo tolerance feel instant?</h2>
      <div class="stat-row">
        ${card('auto-corrected', String(corrected.length), pct(corrected.length, log.length) + ' of commands')}
        ${card('median read + draw', `${median(parse).toFixed(2)} ms`, `budget ${BUDGET_MS} ms`)}
        ${card('slowest', `${Math.max(...parse).toFixed(2)} ms`)}
        ${card('over budget', String(overBudget), overBudget ? 'check these below' : 'none')}
      </div>

      <h2>By command</h2>
      <table>
        <thead><tr><th>Command</th><th>Uses</th><th>Failed</th><th>Corrected</th><th>Median typing</th><th>Median draw</th></tr></thead>
        <tbody>${[...byCommand].sort((a, b) => b[1].length - a[1].length).map(([name, es]) => `
          <tr><td><code>/${escapeHtml(name)}</code></td><td>${es.length}</td><td>${es.filter((e) => !e.ok).length}</td>
          <td>${es.filter((e) => e.corrections.length).length}</td><td>${seconds(median(es.map((e) => e.typingMs)))}</td>
          <td>${median(es.map((e) => e.parseMs)).toFixed(2)} ms</td></tr>`).join('')}
        </tbody>
      </table>

      <div class="two-col">
        <section>
          <h2>Failed commands</h2>
          ${failed.length ? `<ul class="plain">${failed.slice(-30).reverse().map((e) => `<li><code>${escapeHtml(e.line)}</code><br><span class="muted">${escapeHtml(e.hint ?? '')}</span></li>`).join('')}</ul>` : '<p class="muted">None.</p>'}
        </section>
        <section>
          <h2>Corrections</h2>
          ${corrected.length ? `<ul class="plain">${corrected.slice(-30).reverse().map((e) => `<li><code>${escapeHtml(e.line)}</code><br><span class="muted">${escapeHtml(e.corrections.join(' · '))}</span></li>`).join('')}</ul>` : '<p class="muted">None.</p>'}
        </section>
      </div>

      <h2>Latest 100</h2>
      <table>
        <thead><tr><th>When</th><th>Command</th><th>Result</th><th>Typing</th><th>Draw</th><th>Edits</th></tr></thead>
        <tbody>${log.slice(-100).reverse().map((e) => `
          <tr class="${e.ok ? '' : 'bad'}"><td class="muted">${new Date(e.at).toLocaleString()}</td><td><code>${escapeHtml(e.line)}</code></td>
          <td>${e.ok ? (e.corrections.length ? 'drawn, corrected' : 'drawn') : 'failed'}${e.fixedByUser ? ' (after retry)' : ''}</td>
          <td>${seconds(e.typingMs)}</td><td class="${e.parseMs > BUDGET_MS ? 'bad' : ''}">${e.parseMs.toFixed(2)} ms</td><td>${e.edits}</td></tr>`).join('')}
        </tbody>
      </table>`}
    </main>
  `;

  const stamp = new Date().toISOString().slice(0, 10);
  root.querySelector('#csv')!.addEventListener('click', () => downloadFile(`note-taker-log-${stamp}.csv`, toCSV(readLog()), 'text/csv'));
  root.querySelector('#json')!.addEventListener('click', () =>
    downloadFile(`note-taker-log-${stamp}.json`, JSON.stringify(readLog(), null, 2), 'application/json'));

  // Two clicks to clear, instead of a confirm() dialog.
  const clear = root.querySelector<HTMLButtonElement>('#clear')!;
  clear.addEventListener('click', () => {
    if (clear.dataset.armed) {
      clearLog();
      renderStats(root);
    } else {
      clear.dataset.armed = '1';
      clear.textContent = 'Click again to clear';
      setTimeout(() => { delete clear.dataset.armed; clear.textContent = 'Clear log'; }, 3000);
    }
  });
}
