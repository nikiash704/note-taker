// Blocks of maths text:
//   /table x | f(x) + 0 | 1 + 1 | e          (first row is the header)
//   /cases f(x) = x^2 if x < 0 + 0 otherwise
//   /align (a+b)^2 = (a+b)(a+b) + = a^2 + 2ab + b^2
//   /def /thm /lemma /prop /cor /proof /ex /note /rem   (boxed statements; a proof ends with ∎)

import { splitClauses, splitTopLevel, toTex } from './args';
import { fail, firstLine, type FigureCommand } from './types';
import { renderInline, renderMath } from '../markdown';
import { escapeHtml } from '../html';

/** Does a table cell look like maths (numbers, single letters, f(x)…) rather than words? */
function looksMathy(cell: string): boolean {
  if (/\$/.test(cell)) return false;
  const words = cell.match(/[A-Za-z]{3,}/g) ?? [];
  const mathWords = /^(sin|cos|tan|ln|log|exp|lim|sqrt|pi|max|min|det|inf|infty|theta|alpha|beta|gamma|lambda|sigma|mu|delta)$/i;
  return words.every((w) => mathWords.test(w));
}

export const table: FigureCommand = {
  name: 'table',
  area: 'Blocks',
  example: '/table x | 0 | π/2 | π\n  + sin x | 0 | 1 | 0\n  + cos x | 1 | 0 | −1',
  description: 'A table: one row per line, cells separated by “|” (or commas). The first row is the header. Maths in cells is typeset; words stay words.',
  draw(args) {
    const rows = splitClauses(args).map((r) => (r.includes('|') ? r.split('|') : splitTopLevel(r, ',')).map((c) => c.trim()));
    if (!rows.length) return fail(`Which rows? e.g. ${firstLine(table.example)}`);
    const width = Math.max(...rows.map((r) => r.length));
    const cell = (c: string, header: boolean) => {
      const tag = header ? 'th' : 'td';
      if (!c) return `<${tag}></${tag}>`;
      const inner = /\$/.test(c) ? renderInline(c) : looksMathy(c) ? renderMath(toTex(c), false) : escapeHtml(c);
      return `<${tag}>${inner}</${tag}>`;
    };
    const html = `<table class="nt-table">${rows.map((r, i) => `<tr>${Array.from({ length: width }, (_, j) => cell(r[j] ?? '', i === 0)).join('')}</tr>`).join('')}</table>`;
    const latex = `\\begin{array}{${'c'.repeat(width).split('').join('|')}} ${rows.map((r, i) => r.map((c) => (looksMathy(c) ? toTex(c) : `\\text{${c.replace(/[{}\\]/g, '')}}`)).join(' & ') + (i === 0 ? ' \\\\ \\hline' : ' \\\\')).join(' ')} \\end{array}`;
    return { ok: true, html, latex, notes: [] };
  },
};

export const cases: FigureCommand = {
  name: 'cases',
  area: 'Blocks',
  example: '/cases |x| = x if x >= 0\n  + -x if x < 0',
  description: 'A definition by cases with a brace. Each case: “formula if condition”, “formula, condition” or “formula otherwise”.',
  draw(args) {
    const clauses = splitClauses(args);
    if (!clauses.length) return fail(`Which cases? e.g. ${firstLine(cases.example)}`);
    let lhs = '';
    const first = clauses[0].match(/^\s*([A-Za-z|][^=<>]*?)\s*=(?![=<>])\s*(.*)$/);
    if (first && !/\b(if|for|when|otherwise)\b/.test(first[1])) {
      lhs = first[1];
      clauses[0] = first[2];
    }
    const rows = clauses.filter((c) => c.trim()).map((c) => {
      const other = c.match(/^(.*?)[,\s]+(otherwise|else|elsewhere)\s*$/i);
      if (other) return `${toTex(other[1].trim())} & \\text{${other[2]}}`;
      const m = c.match(/^(.*?)(?:,\s*|\s+)(if|for|when|where)\s+(.+)$/i) ?? c.match(/^(.*?),\s*(.+)$/);
      if (!m) return `${toTex(c)} &`;
      return m.length === 4 ? `${toTex(m[1].trim())} & \\text{${m[2]} } ${toTex(m[3].trim())}` : `${toTex(m[1].trim())} & ${toTex(m[2].trim())}`;
    });
    const latex = `${lhs ? `${toTex(lhs)} = ` : ''}\\begin{cases} ${rows.join(' \\\\ ')} \\end{cases}`;
    return { ok: true, latex, notes: [] };
  },
};

const REL = /(<=>|=>|<=|>=|!=|≤|≥|≠|≈|≡|=|<|>|\\le\b|\\ge\b|\\approx\b|\\equiv\b)/;

export const align: FigureCommand = {
  name: 'align',
  area: 'Blocks',
  example: '/align (a + b)^2 = (a + b)(a + b)\n  + = a^2 + ab + ba + b^2\n  + = a^2 + 2ab + b^2 [since ab = ba]',
  description: 'A chain of equalities lined up on “=”. Lines starting with =, <, ≤ … continue the chain; [a reason] adds a note on the right.',
  draw(args) {
    const lines = splitClauses(args);
    if (!lines.length) return fail(`Which steps? e.g. ${firstLine(align.example)}`);
    const rows = lines.map((l) => {
      const reason = l.match(/\s*\[([^\]]*)\]\s*$/);
      const body = reason ? l.slice(0, reason.index) : l;
      const note = reason ? ` && \\text{(${reason[1].replace(/[{}\\]/g, '')})}` : '';
      const m = body.match(REL);
      if (!m) return `& ${toTex(body)}${note}`;
      const at = m.index!;
      return `${toTex(body.slice(0, at).trim())} &${toTex(body.slice(at).trim())}${note}`;
    });
    return { ok: true, latex: `\\begin{aligned} ${rows.join(' \\\\ ')} \\end{aligned}`, notes: [] };
  },
};

// ---- Theorem-style boxes --------------------------------------------------------------------------

const KINDS: Record<string, string> = {
  def: 'Definition', thm: 'Theorem', lemma: 'Lemma', prop: 'Proposition', cor: 'Corollary',
  proof: 'Proof', ex: 'Example', note: 'Note', rem: 'Remark',
};

function callout(name: string): FigureCommand {
  const title = KINDS[name];
  return {
    name,
    area: 'Blocks',
    example: name === 'proof'
      ? '/proof Suppose √2 = p/q in lowest terms.\n  + Then $p^2 = 2q^2$, so p is even…\n  + …so q is even too, a contradiction.'
      : name === 'thm' ? '/thm [Bolzano] Every bounded sequence in $\\mathbb{R}$\n  + has a convergent subsequence.'
      : `/${name} ${name === 'def' ? 'A group is a set with an associative operation, an identity and inverses.' : 'Text with $math$ inside.'}`,
    description: `A boxed ${title.toLowerCase()}. Optional name in [brackets]; “+” lines continue it${name === 'proof' ? '; it ends with ∎' : ''}. $math$ works inside.`,
    draw(args) {
      const lines = args.split('\n').map((l) => l.trim()).filter(Boolean);
      if (!lines.length) return fail(`Write the ${title.toLowerCase()} after /${name}`);
      const named = lines[0].match(/^\[([^\]]*)\]\s*(.*)$/) ?? lines[0].match(/^\(([^)]*)\)\s*(.*)$/);
      const label = named ? `${title} (${escapeHtml(named[1])})` : title;
      if (named) lines[0] = named[2];
      // A "+" line continues the sentence unless the previous line ended one.
      const grouped: string[] = [];
      for (const l of lines.filter(Boolean)) {
        if (grouped.length && !/[.!?:…]$/.test(grouped[grouped.length - 1])) grouped[grouped.length - 1] += ` ${l}`;
        else grouped.push(l);
      }
      const paras = grouped.map((l) => `<p>${renderInline(l)}</p>`).join('');
      const qed = name === 'proof' ? '<span class="qed">∎</span>' : '';
      const html = `<div class="callout callout-${name}"><div class="callout-title">${label}</div>${paras.replace(/<\/p>$/, `${qed}</p>`)}</div>`;
      return { ok: true, html, notes: [] };
    },
  };
}

export const CALLOUTS = Object.keys(KINDS).map(callout);
export const BLOCK_COMMANDS: FigureCommand[] = [table, cases, align, ...CALLOUTS];
