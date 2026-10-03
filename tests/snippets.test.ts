import { describe, it, expect } from 'vitest';
import { findExpansion, parseTemplate } from '../src/snippets';

/** Type `before` in math mode and return the resulting text (stops removed). */
function expand(before: string, mode: 'math' | 'text' = 'math'): string | null {
  const e = findExpansion(before, mode);
  if (!e) return null;
  return before.slice(0, before.length - e.length) + parseTemplate(e.template).text;
}

describe('equation shortcuts', () => {
  it('greek letters', () => {
    expect(expand('@a')).toBe('\\alpha');
    expect(expand('x+@G')).toBe('x+\\Gamma');
    expect(expand('@q')).toBeNull();
  });

  it('fractions take the term before the slash', () => {
    expect(expand('x^2/')).toBe('\\frac{x^2}{}');
    expect(expand('1+(a+b)/')).toBe('1+\\frac{a+b}{}');
    expect(expand('2\\pi/')).toBe('\\frac{2\\pi}{}');
    expect(expand('\\sqrt{x}/')).toBe('\\frac{\\sqrt{x}}{}');
    expect(expand('a + /')).toBe('a + \\frac{}{}');
  });

  it('postfix accents', () => {
    expect(expand('xbar')).toBe('\\bar{x}');
    expect(expand('y = xhat')).toBe('y = \\hat{x}');
    expect(expand('vvec')).toBe('\\vec{v}');
    expect(expand('xddot')).toBe('\\ddot{x}');
    expect(expand('\\alphahat')).toBe('\\hat{\\alpha}');
  });

  it('does not break real LaTeX commands', () => {
    expect(expand('a \\cdot')).toBeNull();
    expect(expand('\\ldot')).toBeNull();
    expect(expand('\\int')).toBeNull();
    expect(expand('\\sin')).toBeNull();
    expect(expand('\\mat')).toBeNull();
    expect(expand('\\widehat')).toBeNull();
  });

  it('operators and matrices', () => {
    expect(expand('int')).toBe('\\int_{}^{}  \\,dx');
    expect(expand('sum')).toBe('\\sum_{i=1}^{n} ');
    expect(expand('lim')).toBe('\\lim_{n \\to \\infty} ');
    expect(expand('sqrt')).toBe('\\sqrt{}');
    expect(expand('mat')).toBe('\\begin{pmatrix}  \\end{pmatrix}');
    expect(expand('bmat')).toBe('\\begin{bmatrix}  \\end{bmatrix}');
  });

  it('symbols and functions', () => {
    expect(expand('sin')).toBe('\\sin');
    expect(expand('arctan')).toBe('\\arctan');
    expect(expand('x ->')).toBe('x \\to');
    expect(expand('ooo')).toBe('\\infty');
    expect(expand('RR')).toBe('\\mathbb{R}');
    expect(expand('xsr')).toBe('x^{2}');
    expect(expand('a <=')).toBe('a \\le');
  });

  it('text mode only opens math', () => {
    expect(expand('so mk', 'text')).toBe('so $$');
    expect(expand('sin', 'text')).toBeNull();
    expect(expand('x/', 'text')).toBeNull();
  });

  it('parses stops in visiting order, $0 last', () => {
    const t = parseTemplate('\\sum_{${1:i=1}}^{${2:n}} $0');
    expect(t.text).toBe('\\sum_{i=1}^{n} ');
    expect(t.stops.map((s) => t.text.slice(s.from, s.to))).toEqual(['i=1', 'n', '']);
    expect(t.stops[2].from).toBe(t.text.length);
  });
});

describe('more shortcuts', () => {
  it('calculus and delimiters', () => {
    expect(expand('par')).toBe('\\frac{\\partial }{\\partial }');
    expect(expand('ddx')).toBe('\\frac{d}{dx}');
    expect(expand('grad')).toBe('\\nabla');
    expect(expand('norm')).toBe('\\left\\|  \\right\\|');
    expect(expand('binom')).toBe('\\binom{}{}');
  });
  it('sets, relations, algebra', () => {
    expect(expand('A sub')).toBe('A \\subseteq');
    expect(expand('A cup')).toBe('A \\cup');
    expect(expand('a ===')).toBe('a \\equiv');
    expect(expand('x |->')).toBe('x \\mapsto');
    expect(expand('Ainv')).toBe('A^{-1}');
    expect(expand('Atp')).toBe('A^{\\top}');
    expect(expand('ker')).toBe('\\operatorname{ker}');
    expect(expand('sup')).toBe('\\sup');
    expect(expand('EV')).toBe('\\mathbb{E}\\left[  \\right]');
  });
  it('typing infty still works through inf', () => {
    expect(expand('inf')).toBe('\\inf');
  });
  it('does not fire inside \\text{} or \\begin{}', () => {
    expect(expand('\\text{the sub')).toBeNull();
    expect(expand('\\begin{pmat')).toBeNull();
    expect(expand('\\begin{cases')).toBeNull();
  });
});

describe('does not break common exponents', () => {
  it('e^{imx} stays as typed', () => expect(expand('e^{im')).toBeNull());
});
