// The rendered side of the screen. Re-rendering the whole note on every
// keystroke would get slow in a long lecture, so each block's element is
// cached by its source text: only blocks whose text changed are re-rendered.

import { splitBlocks, renderTextBlock, type Block } from './markdown';

export type FigureRenderer = (line: string) => HTMLElement;

export class Preview {
  private cache = new Map<string, HTMLElement[]>();
  private blocks: Block[] = [];
  private elements: HTMLElement[] = [];
  private active: HTMLElement | null = null;

  constructor(
    private root: HTMLElement,
    private renderFigure: FigureRenderer,
    onBlockClick: (line: number) => void,
  ) {
    root.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('button, a')) return;
      const el = target.closest<HTMLElement>('[data-from]');
      if (el) onBlockClick(Number(el.dataset.from));
    });
  }

  render(doc: string): void {
    const next = new Map<string, HTMLElement[]>();
    this.blocks = splitBlocks(doc);
    this.elements = this.blocks.map((block) => {
      const key = block.kind + '\u0000' + block.text;
      const el = this.cache.get(key)?.pop() ?? this.build(block);
      el.dataset.from = String(block.fromLine);
      el.dataset.to = String(block.toLine);
      const list = next.get(key) ?? [];
      list.push(el);
      next.set(key, list);
      return el;
    });
    this.cache = next;
    this.root.replaceChildren(...this.elements);
    if (this.blocks.length === 0) {
      this.root.innerHTML = '<p class="empty">Your rendered notes appear here.</p>';
    }
  }

  /** Highlight the block that contains `line` and keep it in view. */
  follow(line: number): void {
    const index = this.blocks.findIndex((b) => line >= b.fromLine && line <= b.toLine);
    const el = index >= 0 ? this.elements[index] : null;
    if (el === this.active) return;
    this.active?.classList.remove('active');
    this.active = el;
    if (el) {
      el.classList.add('active');
      el.scrollIntoView({ block: 'nearest' });
    }
  }

  private build(block: Block): HTMLElement {
    if (block.kind === 'figure') {
      const el = this.renderFigure(block.text);
      el.classList.add('block');
      return el;
    }
    const el = document.createElement('div');
    el.className = `block block-${block.kind}`;
    el.innerHTML = renderTextBlock(block);
    return el;
  }
}
