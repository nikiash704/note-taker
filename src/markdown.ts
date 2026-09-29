// A deliberately small Markdown reader. It only understands what lecture
// notes need: headings, paragraphs, lists, quotes, $inline$ and $$display$$
// math, and figure command lines (lines starting with "/").

import katex from 'katex';
import { escapeHtml } from './html';

export { escapeHtml };

export type BlockKind = 'heading' | 'para' | 'list' | 'quote' | 'math' | 'figure' | 'rule';

export interface Block {
  kind: BlockKind;
  /** First and last line numbers (1-based, like CodeMirror) the block covers. */
  fromLine: number;
  toLine: number;
  text: string;
}

const HEADING = /^#{1,6}\s/;
const LIST_ITEM = /^\s*([-*+]|\d+[.)])\s/;
const QUOTE = /^>\s?/;
const RULE = /^(-{3,}|\*{3,})\s*$/;

export function isFigureLine(line: string): boolean {
  return /^\/[A-Za-z]/.test(line);
}

/** Cut a document into blocks. Line numbers are kept so the preview can follow the cursor. */
export function splitBlocks(doc: string): Block[] {
  const lines = doc.split('\n');
  const blocks: Block[] = [];
  let i = 0;

  const push = (kind: BlockKind, start: number, end: number) =>
    blocks.push({ kind, fromLine: start + 1, toLine: end + 1, text: lines.slice(start, end + 1).join('\n') });

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === '') {
      i++;
    } else if (trimmed.startsWith('$$')) {
      // Display math runs until a line that closes it (possibly the same line).
      let end = i;
      const closesOnSameLine = trimmed.length > 2 && trimmed.slice(2).includes('$$');
      if (!closesOnSameLine) {
        end = i + 1;
        while (end < lines.length && !lines[end].includes('$$')) end++;
        end = Math.min(end, lines.length - 1);
      }
      push('math', i, end);
      i = end + 1;
    } else if (isFigureLine(line)) {
      push('figure', i, i);
      i++;
    } else if (HEADING.test(line)) {
      push('heading', i, i);
      i++;
    } else if (RULE.test(trimmed)) {
      push('rule', i, i);
      i++;
    } else if (LIST_ITEM.test(line) || QUOTE.test(line)) {
      const kind = QUOTE.test(line) ? 'quote' : 'list';
      const pattern = kind === 'quote' ? QUOTE : LIST_ITEM;
      let end = i;
      // Keep going while lines are items (or indented continuations of one).
      while (
        end + 1 < lines.length &&
        lines[end + 1].trim() !== '' &&
        (pattern.test(lines[end + 1]) || /^\s+\S/.test(lines[end + 1]))
      ) end++;
      push(kind, i, end);
      i = end + 1;
    } else {
      let end = i;
      while (end + 1 < lines.length && startsParagraphLine(lines[end + 1])) end++;
      push('para', i, end);
      i = end + 1;
    }
  }
  return blocks;
}

function startsParagraphLine(line: string): boolean {
  const t = line.trim();
  return t !== '' && !t.startsWith('$$') && !isFigureLine(line) && !HEADING.test(line) &&
    !LIST_ITEM.test(line) && !QUOTE.test(line) && !RULE.test(t);
}

// ---------------------------------------------------------------------------
// Rendering


export function renderMath(tex: string, displayMode: boolean): string {
  return katex.renderToString(tex, { displayMode, throwOnError: false, strict: 'ignore', output: 'html' });
}

/** Render one line or paragraph of text: `code`, $math$, **bold**, *italic*. */
export function renderInline(text: string): string {
  let out = '';
  let i = 0;
  let plain = '';
  const flush = () => {
    out += renderEmphasis(escapeHtml(plain));
    plain = '';
  };

  while (i < text.length) {
    const c = text[i];
    if (c === '\\' && text[i + 1] === '$') {
      plain += '$';
      i += 2;
    } else if (c === '`') {
      const end = text.indexOf('`', i + 1);
      if (end === -1) { plain += c; i++; continue; }
      flush();
      out += `<code>${escapeHtml(text.slice(i + 1, end))}</code>`;
      i = end + 1;
    } else if (c === '$') {
      const display = text[i + 1] === '$';
      const open = display ? 2 : 1;
      const end = findClosingDollar(text, i + open, display);
      if (end === -1) { plain += text.slice(i); break; }
      flush();
      out += renderMath(text.slice(i + open, end), display);
      i = end + open;
    } else {
      plain += c;
      i++;
    }
  }
  flush();
  return out;
}

function findClosingDollar(text: string, from: number, display: boolean): number {
  for (let j = from; j < text.length; j++) {
    if (text[j] === '\\') { j++; continue; }
    if (text[j] === '$' && (!display || text[j + 1] === '$')) return j;
  }
  return -1;
}

function renderEmphasis(html: string): string {
  return html
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/\n/g, ' ');
}

/** Render a non-figure block to HTML. */
export function renderTextBlock(block: Block): string {
  const t = block.text;
  switch (block.kind) {
    case 'heading': {
      const level = t.match(/^#+/)![0].length;
      return `<h${level}>${renderInline(t.slice(level).trim())}</h${level}>`;
    }
    case 'math': {
      const body = t.trim().replace(/^\$\$/, '').replace(/\$\$$/, '');
      return renderMath(body, true);
    }
    case 'list': {
      const ordered = /^\s*\d/.test(t);
      const items: string[] = [];
      for (const line of t.split('\n')) {
        if (LIST_ITEM.test(line)) items.push(line.replace(LIST_ITEM, ''));
        else items[items.length - 1] += '\n' + line.trim();
      }
      const tag = ordered ? 'ol' : 'ul';
      return `<${tag}>${items.map((it) => `<li>${renderInline(it)}</li>`).join('')}</${tag}>`;
    }
    case 'quote':
      return `<blockquote>${renderInline(t.split('\n').map((l) => l.replace(QUOTE, '')).join('\n'))}</blockquote>`;
    case 'rule':
      return '<hr>';
    default:
      return `<p>${renderInline(t)}</p>`;
  }
}
