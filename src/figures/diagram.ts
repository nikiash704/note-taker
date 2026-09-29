// /diagram A -> B -> C
// /diagram Sets -F-> Groups; Groups -U-> Sets      labelled arrows, several chains
// /diagram A <-> B -- C <- D                      both ways, no arrow, backwards

import { svg, arrow, line, text, el, path, INK, round } from './svg';
import { fail, type FigureCommand } from './types';

type Direction = 'forward' | 'back' | 'both' | 'none';
interface Edge { from: string; to: string; dir: Direction; label: string }

// Arrow tokens. A labelled arrow like "-f->" must have a space before it so
// hyphenated names ("short-exact -> B") stay intact.
const ARROW = /(?:^|\s)-+([^-<>\s][^-<>]*?)-+>(?=\s|$)|\s*(<-+>|↔|<=>|⇔|<-+|←|<=|⇐|-+>|→|=>|⇒|—|--+)\s*/g;

function directionOf(token: string): Direction {
  if (/^(<-+>|↔|<=>|⇔)$/.test(token)) return 'both';
  if (/^(<-+|←|<=|⇐)$/.test(token)) return 'back';
  if (/^(—|--+)$/.test(token)) return 'none';
  return 'forward';
}

export const diagram: FigureCommand = {
  name: 'diagram',
  example: '/diagram A -> B -> C',
  description: 'Boxes and arrows. Label arrows with -f->, separate chains with ;',
  draw(args) {
    const nodes: string[] = [];
    const edges: Edge[] = [];
    const addNode = (n: string) => { if (!nodes.includes(n)) nodes.push(n); };

    for (const chain of args.split(/\s*[;|]\s*|,\s+(?=\S)/).filter((c) => c.trim())) {
      let last: string | null = null;
      let pending: { dir: Direction; label: string } | null = null;
      let pos = 0;
      const tokens: ({ node: string } | { dir: Direction; label: string })[] = [];
      for (const m of chain.matchAll(ARROW)) {
        tokens.push({ node: chain.slice(pos, m.index).trim() });
        tokens.push(m[1] !== undefined ? { dir: 'forward', label: m[1].trim() } : { dir: directionOf(m[2]), label: '' });
        pos = m.index! + m[0].length;
      }
      tokens.push({ node: chain.slice(pos).trim() });

      for (const tok of tokens) {
        if ('node' in tok) {
          if (!tok.node) return fail(`An arrow is missing a box at one end in “${chain.trim()}”. Try: ${diagram.example}`);
          addNode(tok.node);
          if (last !== null && pending) edges.push({ from: last, to: tok.node, ...pending });
          last = tok.node;
          pending = null;
        } else {
          pending = tok;
        }
      }
    }
    if (nodes.length === 0) return fail(`What should the diagram show? e.g. ${diagram.example}`);
    return { ok: true, svg: draw(nodes, edges), notes: [] };
  },
};

// ---- Layout: each box goes one column right of the boxes pointing to it ----------------

function columns(nodes: string[], edges: Edge[]): Map<string, number> {
  const col = new Map(nodes.map((n) => [n, 0]));
  // Longest-path layering; the pass limit keeps cycles from looping forever.
  for (let pass = 0; pass < nodes.length; pass++) {
    let changed = false;
    for (const e of edges) {
      const [a, b] = e.dir === 'back' ? [e.to, e.from] : [e.from, e.to];
      if (a === b) continue;
      if (col.get(b)! < col.get(a)! + 1 && col.get(a)! + 1 < nodes.length) {
        col.set(b, col.get(a)! + 1);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return col;
}

function draw(nodes: string[], edges: Edge[]): string {
  const col = columns(nodes, edges);
  const H = 36, GAP_X = 70, GAP_Y = 26, PAD = 16;
  const widthOf = (n: string) => Math.max(44, n.length * 8.4 + 26);

  const byCol: string[][] = [];
  for (const n of nodes) (byCol[col.get(n)!] ??= []).push(n);
  const colWidth = byCol.map((ns) => Math.max(...(ns ?? []).map(widthOf), 0));
  const tallest = Math.max(...byCol.map((ns) => (ns ?? []).length));
  const height = tallest * H + (tallest - 1) * GAP_Y + 2 * PAD + 20;

  // Centre of every box.
  const at = new Map<string, { x: number; y: number; w: number }>();
  let x = PAD;
  byCol.forEach((ns, c) => {
    if (!ns) return;
    const stack = ns.length * H + (ns.length - 1) * GAP_Y;
    ns.forEach((n, i) => {
      at.set(n, { x: x + colWidth[c] / 2, y: (height - stack) / 2 + i * (H + GAP_Y) + H / 2, w: widthOf(n) });
    });
    x += colWidth[c] + GAP_X;
  });
  const width = x - GAP_X + PAD;

  /** Where the line from box a towards point (tx, ty) leaves the box. */
  const exit = (n: string, tx: number, ty: number): [number, number] => {
    const b = at.get(n)!;
    const dx = tx - b.x, dy = ty - b.y;
    const s = Math.min(Math.abs((b.w / 2 + 3) / (dx || 1e-9)), Math.abs((H / 2 + 3) / (dy || 1e-9)));
    return [b.x + dx * s, b.y + dy * s];
  };

  let body = '';
  for (const e of edges) {
    const a = at.get(e.from)!, b = at.get(e.to)!;
    const twoWay = edges.some((o) => o.from === e.to && o.to === e.from && o.dir !== 'none');
    const backwards = col.get(e.from)! >= col.get(e.to)! && e.dir !== 'back' && a.y === b.y;
    let lx: number, ly: number;
    if (backwards || (twoWay && e.dir !== 'both')) {
      // Curve so it doesn't overlap another arrow or pass through boxes.
      const bend = backwards ? -(H / 2 + 34) : -18;
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 + bend * 2;
      const [x1, y1] = exit(e.from, mx, my), [x2, y2] = exit(e.to, mx, my);
      body += path(`M${round(x1)},${round(y1)} Q${round(mx)},${round(my)} ${round(x2)},${round(y2)}`, { 'stroke-width': 1.5 });
      if (e.dir !== 'none') {
        const [hx, hy, fx, fy] = e.dir === 'back' ? [x1, y1, mx, my] : [x2, y2, mx, my];
        const t = 0.15;
        body += arrow(hx + (fx - hx) * t, hy + (fy - hy) * t, hx, hy, { 'stroke-width': 1.5 });
      }
      [lx, ly] = [mx, (my + (a.y + b.y) / 2) / 2 - 4];
    } else {
      const [x1, y1] = exit(e.from, b.x, b.y), [x2, y2] = exit(e.to, a.x, a.y);
      if (e.dir === 'forward') body += arrow(x1, y1, x2, y2, { 'stroke-width': 1.5 });
      else if (e.dir === 'back') body += arrow(x2, y2, x1, y1, { 'stroke-width': 1.5 });
      else if (e.dir === 'both') {
        const [mx, my] = [(x1 + x2) / 2, (y1 + y2) / 2];
        body += arrow(mx, my, x2, y2, { 'stroke-width': 1.5 }) + arrow(mx, my, x1, y1, { 'stroke-width': 1.5 });
      } else body += line(x1, y1, x2, y2, { 'stroke-width': 1.5 });
      [lx, ly] = [(x1 + x2) / 2, (y1 + y2) / 2 - 8];
    }
    if (e.label) body += text(lx, ly, e.label, { 'font-size': 13, 'font-style': 'italic', 'text-anchor': 'middle' });
  }

  for (const [n, b] of at) {
    body += el('rect', {
      x: b.x - b.w / 2, y: b.y - H / 2, width: b.w, height: H, rx: 8,
      fill: INK, 'fill-opacity': 0.05, stroke: INK, 'stroke-width': 1.4,
    });
    body += text(b.x, b.y + 5, n, { 'font-size': 15, 'text-anchor': 'middle' });
  }
  return svg(width, height, body, `Diagram of ${nodes.join(', ')}`);
}
