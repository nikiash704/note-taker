import { describe, it, expect } from 'vitest';
import { suggestFor, runFigure } from '../src/figures';
import { parseRowOp, Q, applyOp, nextRrefStep, type M } from '../src/figures/rational';

const m = (rows: number[][]): M => rows.map((r) => r.map((x) => new Q(x)));

describe('row operations', () => {
  it('reads the usual ways of writing them', () => {
    expect(parseRowOp('R2 - 3R1', 2)).toEqual({ kind: 'add', i: 1, j: 0, k: new Q(-3) });
    expect(parseRowOp('R2 -> R2 - 3R1', 2)).toEqual({ kind: 'add', i: 1, j: 0, k: new Q(-3) });
    expect(parseRowOp('R2 -= 3R1', 2)).toEqual({ kind: 'add', i: 1, j: 0, k: new Q(-3) });
    expect(parseRowOp('R1 <-> R2', 2)).toEqual({ kind: 'swap', i: 0, j: 1 });
    expect(parseRowOp('swap R1 R2', 2)).toEqual({ kind: 'swap', i: 0, j: 1 });
    expect(parseRowOp('1/2 R1', 2)).toEqual({ kind: 'scale', i: 0, k: new Q(1, 2) });
    expect(parseRowOp('R1/2', 2)).toEqual({ kind: 'scale', i: 0, k: new Q(1, 2) });
    expect(parseRowOp('-R2', 2)).toEqual({ kind: 'scale', i: 1, k: new Q(-1) });
    expect(typeof parseRowOp('R3 - R1', 2)).toBe('string');
  });

  it('Gauss–Jordan suggestions reach reduced row echelon form', () => {
    let a = m([[0, 2, 4], [1, 1, 1], [2, 4, 8]]);
    for (let i = 0; i < 20; i++) { const op = nextRrefStep(a); if (!op) break; a = applyOp(a, op); }
    expect(a.map((r) => r.map(String))).toEqual([['1', '0', '0'], ['0', '1', '0'], ['0', '0', '1']]);
    expect(nextRrefStep(a)).toBeNull();
  });
});

describe('suggested answers', () => {
  it('determinant', () => expect(suggestFor('/det 2 1\n  + 4 3')).toEqual(['= 2']));
  it('inverse', () => expect(suggestFor('/inverse 2 1\n  + 5 3')).toEqual(['= [3 -1; -5 2]']));
  it('singular matrix', () => expect(suggestFor('/inverse 1 2; 2 4')).toEqual(['not invertible (det = 0)']));
  it('eigenvalues and eigenvectors', () => expect(suggestFor('/eigen 2 1\n  + 1 2')).toEqual(['λ = 1, 3', 'v = (1, -1), (1, 1)']));
  it('irrational eigenvalues', () => expect(suggestFor('/eigen 1 1; 1 0')![0]).toBe('λ = 1/2 ± 1/2√5'));
  it('system of equations', () => expect(suggestFor('/system x + y + z = 6\n  + 2x - y = 0\n  + y - z = -1')).toEqual(['⇒ x = 1, y = 2, z = 3']));
  it('system with infinitely many solutions', () => expect(suggestFor('/system x + y = 2; 2x + 2y = 4')).toEqual(['⇒ x = 2 - t, y = t']));
  it('first row operation', () => expect(suggestFor('/rowops 1 2 | 5\n  + 3 4 | 6')).toEqual(['R2 - 3R1']));
  it('no suggestion once answered', () => expect(suggestFor('/det 2 1; 4 3; = 2')).toBeNull());
  it('the drawing uses only what is written', () => {
    const run = runFigure('/rowops 1 2; 3 4\n  + R2 - 3R1');
    expect(run.output.ok && run.output.latex).toContain('-2');
  });
});

describe('inverse decides between matrix and function', () => {
  it('named matrix on one line', () => expect(suggestFor('/inverse A = 2 1; 5 3')).toEqual(['= [3 -1; -5 2]']));
  it('function', () => expect(runFigure('/inverse e^x').output.ok && !!runFigure('/inverse e^x').output.svg).toBe(true));
});
