import { describe, it, expect } from 'vitest';
import { COMMANDS, runFigure, resolveCommand, SYNONYMS } from '../src/figures';

describe('every command', () => {
  for (const cmd of COMMANDS) {
    it(`/${cmd.name}: its cheat-sheet example draws`, () => {
      const run = runFigure(cmd.example);
      expect(run.output.ok ? 'ok' : run.output.hint).toBe('ok');
      expect(run.ms).toBeLessThan(200);
    });
  }

  it('one line with ";" is the same as "+" lines', () => {
    // Theorem boxes hold prose, where ";" is just punctuation.
    const prose = ['def', 'thm', 'lemma', 'prop', 'cor', 'proof', 'ex', 'note', 'rem'];
    for (const cmd of COMMANDS) {
      const [first, ...more] = cmd.example.split('\n');
      if (!more.length || prose.includes(cmd.name)) continue;
      const oneLine = [first, ...more.map((l) => l.replace(/^\s*\+\s*/, ''))].join('; ');
      const a = runFigure(cmd.example).output;
      const b = runFigure(oneLine).output;
      expect(b.ok ? 'ok' : `${oneLine}: ${b.hint}`).toBe('ok');
      const norm = (o: typeof a) => (o.ok ? (o.svg ?? o.latex ?? o.html ?? '').replace(/clip-\d+/g, 'clip') : '');
      expect(norm(a) === norm(b), `/${cmd.name}: one-line and multi-line differ`).toBe(true);
    }
  });

  it('names and synonyms resolve to themselves', () => {
    for (const cmd of COMMANDS) expect(resolveCommand(cmd.name)?.command.name).toBe(cmd.name);
    for (const [word, target] of Object.entries(SYNONYMS)) expect(resolveCommand(word)?.command.name).toBe(target);
  });
});
