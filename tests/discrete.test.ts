import { describe, it, expect } from 'vitest';
import { suggestFor, runFigure } from '../src/figures';

describe('suggested answers', () => {
  it('truth table of an implication and its contrapositive', () => {
    expect(suggestFor('/truthtable p -> q, ~q -> ~p')).toEqual(['= T F T T', '= T F T T']);
  });
  it('only the columns not yet filled', () => {
    expect(suggestFor('/truthtable p & q, p | q\n  + = T F F F')).toEqual(['= T T T F']);
  });
  it('Z4 group table', () => {
    expect(suggestFor('/cayley Z4')).toEqual(['0 1 2 3', '1 2 3 0', '2 3 0 1', '3 0 1 2']);
  });
  it('U(8) is the Klein four-group in disguise', () => {
    expect(suggestFor('/cayley U(8)')).toEqual(['1 3 5 7', '3 1 7 5', '5 7 1 3', '7 5 3 1']);
  });
  it('D3: rs is a reflection and r^3 = e', () => {
    const rows = suggestFor('/cayley D3')!;
    expect(rows[0].split(' ')).toEqual(['e', 'r', 'r^2', 's', 'rs', 'r^2s']);
    expect(rows[1].split(' ')[2]).toBe('e'); // r · r^2
    expect(rows[3].split(' ')[3]).toBe('e'); // s · s
  });
  it('S3 composes right to left', () => {
    const rows = suggestFor('/cayley S3')!;
    // (1 2)(1 3): apply (1 3) first: 1→3→3, 3→1→2, 2→2→1 → (1 3 2)
    expect(rows[1].split(/ (?![^()]*\))/)[2]).toBe('(1 3 2)');
  });
  it('permutation cycles, order and sign', () => {
    expect(suggestFor('/perm (1 2 3)(3 4)')).toEqual(['= (1 2 3 4), order 4, odd']);
  });
  it('Venn shading and logic errors give hints, not crashes', () => {
    expect(runFigure("/venn A ∩ B'").output.ok).toBe(true);
    expect(runFigure('/venn A B C shade A ∪ (B ∩ C)').output.ok).toBe(true);
    expect(runFigure('/truthtable p -> ').output.ok).toBe(false);
  });
});
