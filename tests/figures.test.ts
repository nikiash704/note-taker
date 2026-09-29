import { describe, it, expect } from 'vitest';
import { parseExpression } from '../src/figures/expr';
import { runFigure } from '../src/figures';

const f = (src: string, x: number) => {
  const r = parseExpression(src, { vars: ['x'] });
  if (!r.ok) throw new Error(r.message);
  return r.fn(x);
};

describe('expression reader', () => {
  it('accepts the loose ways people write formulas', () => {
    expect(f('sin x', 1)).toBeCloseTo(Math.sin(1));
    expect(f('sin(x)', 1)).toBeCloseTo(Math.sin(1));
    expect(f('2x^2 + 1', 3)).toBe(19);
    expect(f('x²', 3)).toBe(9);
    expect(f('sin 2x', 1)).toBeCloseTo(Math.sin(2));
    expect(f('sin x cos x', 1)).toBeCloseTo(Math.sin(1) * Math.cos(1));
    expect(f('sin^2 x', 1)).toBeCloseTo(Math.sin(1) ** 2);
    expect(f('e^-x', 1)).toBeCloseTo(Math.exp(-1));
    expect(f('|x - 2|', 0)).toBe(2);
    expect(f('2pix', 1)).toBeCloseTo(2 * Math.PI);
    expect(f('\\sqrt{x}', 4)).toBe(2);
    expect(f('xsinx', 1)).toBeCloseTo(Math.sin(1));
  });

  it('explains what it could not read', () => {
    const r = parseExpression('foo x', { vars: ['x'] });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.message).toContain('foo');
  });
});

describe('figure commands', () => {
  const ok = (line: string) => {
    const run = runFigure(line);
    if (!run.output.ok) throw new Error(`${line}: ${run.output.hint}`);
    return run;
  };

  it('draws the examples from the spec', () => {
    for (const line of [
      '/plot sin(x) from -pi to pi',
      '/plot sin x -pi..pi',
      '/plot x^2 [0, 2]',
      '/axes',
      '/vec (2,3)',
      '/triangle ABC right at C',
      '/interval [0,1)',
      '/diagram A -> B -> C',
    ]) expect(ok(line).output.ok).toBe(true);
  });

  it('draws the README examples', () => {
    for (const line of [
      '/plot x^2, 2x+1 [-3, 3]', '/graph cos x -pi..pi',
      '/axes -3..3', '/axes x -2..4 y -1..3', '/axes A(1,2) B(3,-1)',
      '/vec u=(2,3) v=(-1,2)', '/vec (1,1) -> (3,2)',
      '/triangle PQR isosceles at P', '/triangle ABC right at C a=3 b=4', '/triangle ABC AB=5 BC=7 CA=6 A=60',
      '/interval (-inf, 2] U (3, 5]', '/interval 0 <= x < pi',
      '/diagram A -f-> B; A -g-> C; B -h-> D; C -k-> D',
      '/trinagle ABC rigth at C a=3 b=4', '/interval [0,1) U (2, inf)',
    ]) expect(ok(line).output.ok).toBe(true);
  });

  it('gives quiet hints for things it cannot draw', () => {
    const run = runFigure('/triangle ABC right at D');
    expect(run.output.ok).toBe(false);
    expect(!run.output.ok && run.output.hint).toContain('D');
    expect(runFigure('/triangle ABC AB=1 BC=1 CA=5').output.ok).toBe(false);
    expect(runFigure('/interval [3, 1]').output.ok).toBe(false);
  });

  it('is fast', () => {
    const run = ok('/plot sin x, cos x, tan x from -2pi to 2pi');
    expect(run.ms).toBeLessThan(10);
  });
});
