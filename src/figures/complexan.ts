// Complex analysis:
//   /complex 1 + i, 2e^(i pi/3)   (+ modulus, arg, conj)
//   /roots z^6 = 1
//   /contourpath circle |z| = 2 (+ poles 1, i)   · semicircle R=3 · keyhole · rectangle -2..2, 0..1
//   /conformal z^2                (+ disk, or x -1..1 y 0..2)

import { parseExpression, compileComplex, parseComplex, type C } from './expr';
import { readRange } from './range';
import { splitClauses, splitTopLevel, numParam, hasWord, fmt } from './args';
import {
  svg, makeFrame, drawAxes, path, line, text, circle, arrow, COLORS, INK, clipToBox, polyline, directionArrows,
  autoRange, DASHED, type Frame,
} from './svg';
import { fail, firstLine, type FigureCommand } from './types';
import { subscript } from './graphs';

type Pt = [number, number];

function argand(R: number, w = 400, h = 380): Frame {
  return makeFrame([-R, R], [-R, R], { equal: true, width: w, height: h });
}

const axes = (f: Frame) => drawAxes(f, { xLabel: 'Re', yLabel: 'Im' });

export const complex: FigureCommand = {
  name: 'complex',
  area: 'Complex analysis',
  example: '/complex z = 1 + i, w = 2e^(i pi/3)\n  + modulus\n  + arg',
  description: 'Complex numbers on the Argand plane as arrows. Options: modulus (circle and |z|), arg (angle θ), conj (the conjugate).',
  draw(args, tools) {
    const clauses = splitClauses(args);
    const opts = clauses.filter((c) => /^(modulus|mod|abs|arg|argument|angle|conj|conjugate|polar)$/i.test(c.trim()));
    const items: { name: string; z: C }[] = [];
    for (const c of clauses.filter((c) => !opts.includes(c))) {
      for (const part of splitTopLevel(c, ',')) {
        const m = part.match(/^\s*([A-Za-z]\w*)\s*[=:]\s*(.+)$/);
        const z = parseComplex(m ? m[2] : part, tools.fixName);
        if (!z) return fail(`Couldn't read the complex number “${part.trim()}”. Try 1 + i, 3 - 2i or 2e^(i pi/3)`);
        items.push({ name: m ? m[1] : '', z });
      }
    }
    if (!items.length) return fail(`Which numbers? e.g. ${firstLine(complex.example)}`);
    const want = (w: string) => opts.some((o) => o.toLowerCase().startsWith(w));
    const conj = want('conj'), modulus = want('mod') || want('abs') || want('polar'), argument = want('arg') || want('angle') || want('polar');
    const R = Math.max(1.5, ...items.map(({ z }) => Math.hypot(z[0], z[1]))) * 1.3;
    const frame = argand(R);
    let body = axes(frame);
    items.forEach(({ name, z }, i) => {
      const color = COLORS[i % COLORS.length];
      const [x, y] = z;
      const r = Math.hypot(x, y), th = Math.atan2(y, x);
      if (modulus) {
        body += circle(frame.sx(0), frame.sy(0), frame.sx(r) - frame.sx(0), { fill: 'none', stroke: color, 'stroke-width': 1, ...DASHED, 'stroke-opacity': 0.6 });
        body += text(frame.sx(x / 2) - 8 * Math.sin(th), frame.sy(y / 2) - 8 * Math.cos(th), `|${name || 'z'}|`, { 'font-size': 12, fill: color, 'text-anchor': 'middle' });
      }
      if (argument) {
        const rr = Math.min(0.35 * r, R * 0.18);
        const arc: Pt[] = Array.from({ length: 41 }, (_, k) => [rr * Math.cos((th * k) / 40), rr * Math.sin((th * k) / 40)]);
        body += path(polyline(frame, arc), { stroke: color, 'stroke-width': 1.3 });
        body += text(frame.sx(1.6 * rr * Math.cos(th / 2)), frame.sy(1.6 * rr * Math.sin(th / 2)) + 4, 'θ', { 'font-size': 13, fill: color, 'text-anchor': 'middle', 'font-style': 'italic' });
      }
      body += arrow(frame.sx(0), frame.sy(0), frame.sx(x), frame.sy(y), { stroke: color, 'stroke-width': 2.3 });
      body += line(frame.sx(x), frame.sy(y), frame.sx(x), frame.sy(0), { ...DASHED, stroke: color, 'stroke-width': 1, 'stroke-opacity': 0.5 });
      const label = `${name ? `${name} = ` : ''}${fmt(x, 3)} ${y < 0 ? '−' : '+'} ${fmt(Math.abs(y), 3)}i`;
      body += text(frame.sx(x) + (x >= 0 ? 6 : -6), frame.sy(y) - 6, label, { 'font-size': 13, fill: color, 'text-anchor': x >= 0 ? 'start' : 'end', 'font-style': 'italic' });
      if (conj) {
        body += arrow(frame.sx(0), frame.sy(0), frame.sx(x), frame.sy(-y), { stroke: color, 'stroke-width': 1.5, ...DASHED });
        body += text(frame.sx(x) + 6, frame.sy(-y) + 14, name ? `${name}̄` : 'z̄', { 'font-size': 13, fill: color, 'font-style': 'italic' });
      }
    });
    return { ok: true, svg: svg(frame.width, frame.height, body, 'Argand diagram'), notes: [] };
  },
};

export const roots: FigureCommand = {
  name: 'roots',
  area: 'Complex analysis',
  example: '/roots z^6 = 1',
  description: 'The n solutions of zⁿ = w: equally spaced on a circle, forming a regular polygon.',
  draw(args, tools) {
    const m = args.replace(/\s+/g, ' ').match(/z\s*\^\s*\{?(\d+)\}?\s*=\s*(.+)$/i) ?? args.trim().match(/^(\d+)(?:\s+(.+))?$/);
    if (!m) return fail(`Write it like ${roots.example}`);
    const n = Number(m[1]);
    if (n < 1 || n > 24) return fail('Use a power from 1 to 24');
    const w = parseComplex(m[2] ?? '1', tools.fixName);
    if (!w) return fail(`Couldn't read “${m[2]}”`);
    const r = Math.pow(Math.hypot(w[0], w[1]), 1 / n), th = Math.atan2(w[1], w[0]);
    const pts: Pt[] = Array.from({ length: n }, (_, k) => [r * Math.cos((th + 2 * Math.PI * k) / n), r * Math.sin((th + 2 * Math.PI * k) / n)]);
    const frame = argand(r * 1.45);
    let body = axes(frame);
    body += circle(frame.sx(0), frame.sy(0), frame.sx(r) - frame.sx(0), { fill: 'none', stroke: INK, 'stroke-width': 1, ...DASHED, 'stroke-opacity': 0.5 });
    if (n > 2) body += path(polyline(frame, pts, true), { stroke: COLORS[0], 'stroke-width': 1.5, fill: COLORS[0], 'fill-opacity': 0.08 });
    pts.forEach(([x, y], k) => {
      body += line(frame.sx(0), frame.sy(0), frame.sx(x), frame.sy(y), { 'stroke-width': 0.8, 'stroke-opacity': 0.35 });
      body += circle(frame.sx(x), frame.sy(y), 4.5, { fill: COLORS[1] });
      const ang = Math.atan2(y, x);
      body += text(frame.sx(x * 1.18) , frame.sy(y * 1.18) + 4, `z${subscript(k)}`, { 'font-size': 13, 'text-anchor': Math.cos(ang) > 0.3 ? 'start' : Math.cos(ang) < -0.3 ? 'end' : 'middle', 'font-style': 'italic' });
    });
    return { ok: true, svg: svg(frame.width, frame.height, body, `Roots of z^${n}`), notes: [] };
  },
};

// ---- Contours ---------------------------------------------------------------------------------

export const contourpath: FigureCommand = {
  name: 'contourpath',
  area: 'Complex analysis',
  example: '/contourpath semicircle R=3\n  + poles i, 2i, -1',
  description: 'An integration contour with its orientation: circle |z - a| = r, semicircle R=…, keyhole, rectangle a..b, c..d. “poles …” marks singularities with ×. Add “cw” for clockwise.',
  draw(args, tools) {
    const clauses = splitClauses(args);
    const poles: { z: C; label: string }[] = [];
    let shapeText = '';
    for (const c of clauses) {
      const pm = c.match(/^(?:poles?|singularit(?:y|ies)|points?)\s*[:=]?\s*(.+)$/i);
      if (pm) {
        for (const p of splitTopLevel(pm[1], ',')) {
          const z = parseComplex(p, tools.fixName);
          if (!z) return fail(`Couldn't read the pole “${p}”`);
          poles.push({ z, label: p.trim() });
        }
      } else shapeText += ` ${c}`;
    }
    const input = shapeText.trim();
    const cw = hasWord(input, 'cw') || hasWord(input, 'clockwise', tools);
    let pts: Pt[] = [];
    let R = 2;
    if (/keyhole/i.test(input)) {
      R = numParam(input, tools, 'R', 'r') ?? 2;
      const e = R * 0.18, d = R * 0.05;
      const a0 = Math.asin(d / R), a1 = Math.asin(d / e);
      for (let i = 0; i <= 30; i++) pts.push([e + ((R * Math.cos(a0) - e) * i) / 30, d]);
      for (let i = 0; i <= 200; i++) { const t = a0 + ((2 * Math.PI - 2 * a0) * i) / 200; pts.push([R * Math.cos(t), R * Math.sin(t)]); }
      for (let i = 0; i <= 30; i++) pts.push([R * Math.cos(a0) - ((R * Math.cos(a0) - e) * i) / 30, -d]);
      for (let i = 0; i <= 80; i++) { const t = 2 * Math.PI - a1 - ((2 * Math.PI - 2 * a1) * i) / 80; pts.push([e * Math.cos(t), e * Math.sin(t)]); }
    } else if (/semi|half/i.test(input)) {
      R = numParam(input, tools, 'R', 'r', 'radius') ?? 2;
      for (let i = 0; i <= 40; i++) pts.push([-R + (2 * R * i) / 40, 0]);
      for (let i = 0; i <= 120; i++) { const t = (Math.PI * i) / 120; pts.push([R * Math.cos(t), R * Math.sin(t)]); }
    } else if (/rect|box|square/i.test(input)) {
      const rest = input.replace(/^\s*(rectangle|rect|box|square)\s*/i, '');
      const parts = splitTopLevel(rest.replace(/\s+[x×]\s+/, ','), ',;');
      const xr = readRange(parts[0] ?? '-1..1', tools) ?? [-1, 1], yr = readRange(parts[1] ?? parts[0] ?? '-1..1', tools) ?? xr;
      pts = [[xr[0], yr[0]], [xr[1], yr[0]], [xr[1], yr[1]], [xr[0], yr[1]], [xr[0], yr[0]]].flatMap((p, i, arr) => {
        if (i === 0) return [p as Pt];
        const q = arr[i - 1];
        return Array.from({ length: 20 }, (_, k) => [q[0] + ((p[0] - q[0]) * (k + 1)) / 20, q[1] + ((p[1] - q[1]) * (k + 1)) / 20] as Pt);
      });
      R = Math.max(...pts.flat().map(Math.abs));
    } else {
      // Circle: "|z - 1| = 2", "r=2 centre 1+i", or just "circle".
      const m = input.match(/\|\s*z\s*([+-])?\s*([^|]*)\|\s*=\s*([^\s,;]+)/);
      let c: C = [0, 0];
      let r = numParam(input, tools, 'r', 'R', 'radius') ?? 1;
      if (m) {
        const centre = m[2].trim() ? parseComplex(`${m[1] === '+' ? '-' : ''}(${m[2]})`, tools.fixName) : [0, 0];
        const rr = parseComplex(m[3], tools.fixName);
        if (!centre || !rr) return fail(`Couldn't read the circle. Try: /contourpath circle |z - 1| = 2`);
        [c, r] = [centre as C, rr[0]];
      } else {
        const cm = input.match(/(?:centre|center|at)\s+(.+?)(?:\s+r\s*=|$)/i);
        if (cm) { const z = parseComplex(cm[1], tools.fixName); if (z) c = z; }
      }
      for (let i = 0; i <= 200; i++) { const t = (2 * Math.PI * i) / 200; pts.push([c[0] + r * Math.cos(t), c[1] + r * Math.sin(t)]); }
      R = Math.max(Math.abs(c[0]) + r, Math.abs(c[1]) + r);
    }
    if (cw) pts.reverse();
    const view = Math.max(R, ...poles.flatMap((p) => p.z.map(Math.abs))) * 1.3;
    const frame = argand(view);
    let body = axes(frame);
    body += path(polyline(frame, pts), { stroke: COLORS[0], 'stroke-width': 2.4, fill: COLORS[0], 'fill-opacity': 0.08 });
    body += directionArrows(frame, pts, 4, COLORS[0]);
    for (const p of poles) {
      const [x, y] = [frame.sx(p.z[0]), frame.sy(p.z[1])];
      body += line(x - 6, y - 6, x + 6, y + 6, { stroke: COLORS[1], 'stroke-width': 2.2 }) + line(x - 6, y + 6, x + 6, y - 6, { stroke: COLORS[1], 'stroke-width': 2.2 });
      body += text(x + 9, y - 7, p.label, { 'font-size': 12, fill: COLORS[1] });
    }
    return { ok: true, svg: svg(frame.width, frame.height, body, 'Contour'), notes: [cw ? 'clockwise' : 'anticlockwise (positive) orientation'] };
  },
};

// ---- Conformal maps ---------------------------------------------------------------------------

export const conformal: FigureCommand = {
  name: 'conformal',
  area: 'Complex analysis',
  example: '/conformal z^2\n  + x 0..1.5 y 0..1.5',
  description: 'A grid in the z-plane (left) and its image under w = f(z) (right). Domain: a rectangle “x a..b y c..d” (default the unit square around 0) or “disk”.',
  draw(args, tools) {
    const clauses = splitClauses(args);
    let fText = '';
    let xr: [number, number] = [-1, 1], yr: [number, number] = [-1, 1];
    let disk = false;
    for (const c of clauses) {
      if (/^disk|^disc|^unit disk/i.test(c.trim())) { disk = true; continue; }
      const m = c.match(/^x\s*(.+?)\s+y\s*(.+)$/i);
      if (m) { xr = readRange(m[1], tools) ?? xr; yr = readRange(m[2], tools) ?? yr; continue; }
      const mx = c.match(/^([xy])\s*(?:from|in|:)?\s*(.+)$/i);
      if (mx) { const r = readRange(mx[2], tools); if (r) { if (mx[1].toLowerCase() === 'x') xr = r; else yr = r; continue; } }
      fText = c.replace(/^\s*(w|f\(z\))\s*=\s*/i, '');
    }
    const parsed = parseExpression(fText, { vars: ['z'], complex: true, fixName: tools.fixName });
    if (!parsed.ok) return fail(`${parsed.message}. Try: ${firstLine(conformal.example)}`);
    const f = compileComplex(parsed.ast, ['z']);
    const lines: { pts: Pt[]; color: string }[] = [];
    const N = 8, S = 90;
    if (disk) {
      for (let k = 1; k <= 4; k++) lines.push({ color: COLORS[0], pts: Array.from({ length: S + 1 }, (_, i) => [(k / 4) * Math.cos((2 * Math.PI * i) / S), (k / 4) * Math.sin((2 * Math.PI * i) / S)]) });
      for (let k = 0; k < 12; k++) lines.push({ color: COLORS[1], pts: Array.from({ length: S + 1 }, (_, i) => [(i / S) * Math.cos((Math.PI * k) / 6), (i / S) * Math.sin((Math.PI * k) / 6)]) });
    } else {
      for (let k = 0; k <= N; k++) {
        const y = yr[0] + ((yr[1] - yr[0]) * k) / N, x = xr[0] + ((xr[1] - xr[0]) * k) / N;
        lines.push({ color: COLORS[0], pts: Array.from({ length: S + 1 }, (_, i) => [xr[0] + ((xr[1] - xr[0]) * i) / S, y]) });
        lines.push({ color: COLORS[1], pts: Array.from({ length: S + 1 }, (_, i) => [x, yr[0] + ((yr[1] - yr[0]) * i) / S]) });
      }
    }
    const images = lines.map((l) => ({ color: l.color, pts: l.pts.map(([x, y]) => f([x, y]) as Pt) }));
    const imgX = autoRange(images.flatMap((l) => l.pts.map((p) => p[0])), false) ?? [-1, 1];
    const imgY = autoRange(images.flatMap((l) => l.pts.map((p) => p[1])), false) ?? [-1, 1];
    const side = (r1: [number, number], r2: [number, number]): [[number, number], [number, number]] => {
      const c = [(r1[0] + r1[1]) / 2, (r2[0] + r2[1]) / 2];
      const h = Math.max(r1[1] - r1[0], r2[1] - r2[0]) * 0.6;
      return [[c[0] - h, c[0] + h], [c[1] - h, c[1] + h]];
    };
    const [lx, ly] = side(disk ? [-1, 1] : xr, disk ? [-1, 1] : yr);
    const [rx, ry] = side(imgX, imgY);
    const left = makeFrame(lx, ly, { equal: true, width: 240, height: 240 });
    const right = makeFrame(rx, ry, { equal: true, width: 240, height: 240 });
    const panel = (frame: Frame, ls: typeof lines, label: string) => {
      const clip = clipToBox(frame);
      let inner = '';
      for (const l of ls) inner += path(polyline(frame, l.pts), { stroke: l.color, 'stroke-width': 1.2, 'stroke-opacity': 0.85 });
      return clip.defs + axes(frame) + `<g clip-path="${clip.attr}">${inner}</g>` + text(frame.box.left + 4, frame.box.top + 14, label, { 'font-size': 13, 'font-style': 'italic' });
    };
    const gap = 50;
    let body = panel(left, lines, 'z-plane');
    body += `<g transform="translate(${left.width + gap},0)">${panel(right, images, 'w-plane')}</g>`;
    const ay = left.height / 2;
    body += arrow(left.width + 6, ay, left.width + gap - 6, ay, { 'stroke-width': 1.6 });
    body += text(left.width + gap / 2, ay - 10, `w = ${fText}`, { 'font-size': 12, 'text-anchor': 'middle', 'font-style': 'italic' });
    return { ok: true, svg: svg(left.width + gap + right.width, Math.max(left.height, right.height), body, 'Conformal map'), notes: [] };
  },
};

export const COMPLEX_COMMANDS: FigureCommand[] = [complex, roots, contourpath, conformal];
