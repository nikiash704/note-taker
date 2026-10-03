import { describe, it, expect } from 'vitest';
import { editDistance, closest } from '../src/fuzzy';
import { resolveCommand, runFigure } from '../src/figures';

describe('edit distance', () => {
  it('counts a swap of neighbours as one typo', () => {
    expect(editDistance('trinagle', 'triangle')).toBe(1);
    expect(editDistance('plto', 'plot')).toBe(1);
    expect(editDistance('kitten', 'sitting')).toBe(3);
  });
  it('refuses ambiguous guesses', () => {
    expect(closest('cat', ['bat', 'hat'])).toBeNull();
    expect(closest('fro', ['for', 'from'])).toBe('for');
    expect(closest('form', ['for', 'from', 'on'])).toBe('from');
  });
});

describe('command names', () => {
  const name = (typed: string) => resolveCommand(typed)?.command.name ?? null;
  it('fixes typos, synonyms and short forms', () => {
    expect(name('trinagle')).toBe('triangle');
    expect(name('plto')).toBe('plot');
    expect(name('graph')).toBe('plot');
    expect(name('fn')).toBe('plot');
    expect(name('tri')).toBe('triangle');
    expect(name('grpah')).toBe('plot');
    expect(name('interv')).toBe('interval');
    expect(name('Vector')).toBe('vec');
    expect(name('xyz')).toBeNull();
  });

  it('fixes typos inside arguments', () => {
    const run = runFigure('/trinagle ABC rigth at C');
    expect(run.output.ok).toBe(true);
    expect(run.output.ok && run.output.notes.join(' ')).toContain('rigth → right');
    expect(runFigure('/plot sni x form -pi to pi').output.ok).toBe(true);
    expect(runFigure('/graph cso(x) -pi..pi').output.ok).toBe(true);
  });

  it('resolves in well under 10 ms', () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) resolveCommand('trinaglee');
    expect((performance.now() - start) / 100).toBeLessThan(10);
  });
});

describe('typos across the whole command list', () => {
  const name = (typed: string) => resolveCommand(typed)?.command.name ?? null;
  it('lands on the intended command', () => {
    expect(name('dits')).toBe('dist');
    expect(name('hsit')).toBe('hist');
    expect(name('cicrle')).toBe('circle');
    expect(name('polgyon')).toBe('polygon');
    expect(name('matirx')).toBe('matrix');
    expect(name('eigne')).toBe('eigen');
    expect(name('surfcae')).toBe('surface');
    expect(name('slopfield')).toBe('slopefield');
    expect(name('truthtabel')).toBe('truthtable');
  });
  it('refuses to guess between close names', () => {
    expect(name('dex')).toBeNull(); // def or det?
  });
});

