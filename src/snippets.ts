// Equation shortcuts, following Obsidian Latex Suite conventions.
//
// Each rule looks at the text just before the cursor (including the key that
// was just typed). If its pattern matches, the matched text is replaced by a
// template. Templates mark cursor stops with $1, $2, … and $0 (the last stop);
// ${1:x} is a stop that starts out containing "x", selected.
//
// This file has no editor code in it so it can be unit-tested on its own.

export type Mode = 'math' | 'text';

export interface Expansion {
  /** How many characters before the cursor (including the typed key) to replace. */
  length: number;
  template: string;
}

interface Rule {
  mode: Mode;
  /** Must end with $ so it only matches right before the cursor. */
  pattern: RegExp;
  template: string | ((m: RegExpMatchArray) => string | null);
}

// Not after a letter or backslash: stops "\cdot" turning into "\c" + dot, etc.
const B = '(?<![A-Za-z\\\\])';
// Same, and not straight after "{" (so typing \begin{pmatrix} by hand works).
const BE = '(?<![A-Za-z\\\\{])';

const GREEK: Record<string, string> = {
  a: 'alpha', b: 'beta', g: 'gamma', G: 'Gamma', d: 'delta', D: 'Delta', e: 'epsilon',
  z: 'zeta', h: 'eta', t: 'theta', T: 'Theta', i: 'iota', k: 'kappa', l: 'lambda',
  L: 'Lambda', m: 'mu', n: 'nu', x: 'xi', X: 'Xi', p: 'pi', P: 'Pi', r: 'rho',
  s: 'sigma', S: 'Sigma', u: 'upsilon', f: 'phi', F: 'Phi', c: 'chi', y: 'psi',
  Y: 'Psi', o: 'omega', O: 'Omega',
};
const GREEK_CMD = Object.values(GREEK).join('|');
const ACCENTS = 'ddot|dot|bar|hat|vec|tilde';

const RULES: Rule[] = [
  // ---- Text mode: open math ----
  { mode: 'text', pattern: /(?<![A-Za-z])mk$/, template: '$$0$' },
  { mode: 'text', pattern: /(?<![A-Za-z])dm$/, template: '$$\n$0\n$$' },

  // ---- Greek letters: @a → \alpha ----
  { mode: 'math', pattern: /@([A-Za-z])$/, template: (m) => (GREEK[m[1]] ? `\\${GREEK[m[1]]}` : null) },

  // ---- Postfix accents: xbar → \bar{x}, \alphahat → \hat{\alpha} ----
  {
    mode: 'math',
    pattern: new RegExp(`${B}([A-Za-z]|\\\\(?:${GREEK_CMD}))(${ACCENTS})$`),
    template: (m) => `\\${m[2]}{${m[1]}}`,
  },
  // Accent with nothing before it: bar → \bar{}
  { mode: 'math', pattern: new RegExp(`${B}(${ACCENTS})$`), template: (m) => `\\${m[1]}{$1}$0` },

  // ---- Big operators ----
  { mode: 'math', pattern: new RegExp(`${B}sqrt$`), template: '\\sqrt{$1}$0' },
  { mode: 'math', pattern: new RegExp(`${B}oint$`), template: '\\oint_{$1} $2 \\,d${3:s}$0' },
  { mode: 'math', pattern: new RegExp(`${B}int$`), template: '\\int_{$1}^{$2} $3 \\,d${4:x}$0' },
  { mode: 'math', pattern: new RegExp(`${B}sum$`), template: '\\sum_{${1:i=1}}^{${2:n}} $0' },
  { mode: 'math', pattern: new RegExp(`${B}prod$`), template: '\\prod_{${1:i=1}}^{${2:n}} $0' },
  { mode: 'math', pattern: new RegExp(`${B}lim$`), template: '\\lim_{${1:n} \\to ${2:\\infty}} $0' },

  // ---- Matrices: mat/pmat → ( ), bmat → [ ], Bmat → { }, vmat → | | ----
  {
    mode: 'math',
    pattern: new RegExp(`${BE}([pbBvV]?)mat$`),
    template: (m) => {
      const env = `${m[1] || 'p'}matrix`;
      return `\\begin{${env}} $1 \\end{${env}}$0`;
    },
  },

  // ---- Function names get their backslash: sin → \sin ----
  {
    mode: 'math',
    pattern: new RegExp(`${B}(arcsin|arccos|arctan|sinh|cosh|tanh|sin|cos|tan|cot|sec|csc|ln|log|exp|det|max|min|gcd)$`),
    template: (m) => `\\${m[1]}`,
  },
  { mode: 'math', pattern: new RegExp(`${B}pi$`), template: '\\pi' },

  // ---- Sets and logic ----
  { mode: 'math', pattern: new RegExp(`${B}([RNZQC])\\1$`), template: (m) => `\\mathbb{${m[1]}}` },
  { mode: 'math', pattern: new RegExp(`${B}notin$`), template: '\\notin' },
  { mode: 'math', pattern: new RegExp(`${B}inn$`), template: '\\in' },
  { mode: 'math', pattern: new RegExp(`${B}iff$`), template: '\\iff' },
  { mode: 'math', pattern: new RegExp(`${B}EE$`), template: '\\exists' },
  { mode: 'math', pattern: new RegExp(`${B}AA$`), template: '\\forall' },

  // ---- Symbols ----
  { mode: 'math', pattern: /ooo$/, template: '\\infty' },
  { mode: 'math', pattern: /->$/, template: '\\to' },
  { mode: 'math', pattern: /=>$/, template: '\\implies' },
  { mode: 'math', pattern: /<=$/, template: '\\le' },
  { mode: 'math', pattern: />=$/, template: '\\ge' },
  { mode: 'math', pattern: /!=$/, template: '\\neq' },
  { mode: 'math', pattern: /\.\.\.$/, template: '\\dots' },
  { mode: 'math', pattern: /\*\*$/, template: '\\cdot' },
  { mode: 'math', pattern: new RegExp(`${B}xx$`), template: '\\times' },

  // ---- Powers and subscripts: xsr → x^{2}, xcb → x^{3}, xrd → x^{…} ----
  { mode: 'math', pattern: /(?<!\\)sr$/, template: '^{2}' },
  { mode: 'math', pattern: /(?<!\\)cb$/, template: '^{3}' },
  { mode: 'math', pattern: /(?<!\\)rd$/, template: '^{$1}$0' },
  { mode: 'math', pattern: /__$/, template: '_{$1}$0' },

  // ---- More environments ----
  { mode: 'math', pattern: new RegExp(`${BE}cases$`), template: '\\begin{cases} $1 \\end{cases}$0' },
  { mode: 'math', pattern: new RegExp(`${BE}align$`), template: '\\begin{aligned} $1 \\end{aligned}$0' },

  // ---- Calculus ----
  { mode: 'math', pattern: new RegExp(`${B}par$`), template: '\\frac{\\partial $1}{\\partial $2}$0' },
  { mode: 'math', pattern: new RegExp(`${B}dd([xyzt])$`), template: (m) => `\\frac{d}{d${m[1]}}` },
  { mode: 'math', pattern: new RegExp(`${B}(nabla|grad)$`), template: '\\nabla' },
  { mode: 'math', pattern: new RegExp(`${B}div$`), template: '\\nabla \\cdot ' },
  { mode: 'math', pattern: new RegExp(`${B}curl$`), template: '\\nabla \\times ' },

  // ---- Delimiters ----
  { mode: 'math', pattern: new RegExp(`${B}norm$`), template: '\\left\\| $1 \\right\\|$0' },
  { mode: 'math', pattern: new RegExp(`${B}abs$`), template: '\\left| $1 \\right|$0' },
  { mode: 'math', pattern: new RegExp(`${B}ceil$`), template: '\\lceil $1 \\rceil$0' },
  { mode: 'math', pattern: new RegExp(`${B}floor$`), template: '\\lfloor $1 \\rfloor$0' },
  { mode: 'math', pattern: /<<$/, template: '\\langle ' },
  { mode: 'math', pattern: />>$/, template: '\\rangle ' },
  { mode: 'math', pattern: new RegExp(`${B}binom$`), template: '\\binom{$1}{$2}$0' },

  // ---- Sets and relations ----
  { mode: 'math', pattern: new RegExp(`${B}sub$`), template: '\\subseteq' },
  { mode: 'math', pattern: new RegExp(`${B}sps$`), template: '\\supseteq' },
  { mode: 'math', pattern: new RegExp(`${B}(cup|cap|oplus|otimes|circ|propto|approx|equiv|sim)$`), template: (m) => `\\${m[1]}` },
  { mode: 'math', pattern: new RegExp(`${B}empty$`), template: '\\emptyset' },
  { mode: 'math', pattern: new RegExp(`${B}sm$`), template: '\\setminus ' },
  { mode: 'math', pattern: /===$/, template: '\\equiv' },
  { mode: 'math', pattern: /~~$/, template: '\\approx' },
  { mode: 'math', pattern: new RegExp(`${B}pmod$`), template: '\\pmod{$1}$0' },
  { mode: 'math', pattern: new RegExp(`${B}mod$`), template: '\\bmod ' },
  { mode: 'math', pattern: new RegExp(`${B}iso$`), template: '\\cong' },
  { mode: 'math', pattern: new RegExp(`${B}nsub$`), template: '\\trianglelefteq' },
  { mode: 'math', pattern: /\|->$/, template: '\\mapsto' },
  { mode: 'math', pattern: new RegExp(`${B}inj$`), template: '\\hookrightarrow' },
  { mode: 'math', pattern: new RegExp(`${B}surj$`), template: '\\twoheadrightarrow' },
  { mode: 'math', pattern: new RegExp(`${B}iid$`), template: '\\overset{\\text{iid}}{\\sim}' },

  // ---- Linear algebra ----
  { mode: 'math', pattern: /(?<!\\)inv$/, template: '^{-1}' },
  { mode: 'math', pattern: /(?<!\\)tp$/, template: '^{\\top}' },
  { mode: 'math', pattern: /(?<!\\)dag$/, template: '^{\\dagger}' },
  { mode: 'math', pattern: new RegExp(`${B}(tr|rank|ker|span|Re|Im|Var|Cov)$`), template: (m) => `\\operatorname{${m[1]}}` },
  { mode: 'math', pattern: new RegExp(`${B}Int$`), template: '\\operatorname{int}' },

  // ---- Analysis, complex numbers, probability ----
  { mode: 'math', pattern: new RegExp(`${B}lsup$`), template: '\\limsup_{${1:n \\to \\infty}} $0' },
  { mode: 'math', pattern: new RegExp(`${B}linf$`), template: '\\liminf_{${1:n \\to \\infty}} $0' },
  { mode: 'math', pattern: new RegExp(`${B}(sup|inf|arg|Pr)$`), template: (m) => `\\${m[1]}` },
  { mode: 'math', pattern: new RegExp(`${B}(conj|cl)$`), template: '\\overline{$1}$0' },
  { mode: 'math', pattern: new RegExp(`${B}EV$`), template: '\\mathbb{E}\\left[ $1 \\right]$0' },

  // ---- Fonts ----
  { mode: 'math', pattern: new RegExp(`${B}bf$`), template: '\\mathbf{$1}$0' },
  { mode: 'math', pattern: new RegExp(`${B}cal$`), template: '\\mathcal{$1}$0' },
  { mode: 'math', pattern: new RegExp(`${B}frak$`), template: '\\mathfrak{$1}$0' },
];

/**
 * Find the shortcut (if any) that fires now.
 * `before` is the text of the current line up to the cursor, with the key
 * just typed already on the end.
 */
export function findExpansion(before: string, mode: Mode): Expansion | null {
  // Nothing fires inside \text{…}: that's words, not maths.
  if (mode === 'math' && /\\(text|mathrm|operatorname)\{[^}]*$/.test(before)) return null;
  if (mode === 'math' && before.endsWith('/')) return fraction(before);
  if (mode === 'math' && before.endsWith('|->')) return { length: 3, template: '\\mapsto' };
  for (const rule of RULES) {
    if (rule.mode !== mode) continue;
    const m = before.match(rule.pattern);
    if (!m) continue;
    const template = typeof rule.template === 'string' ? rule.template : rule.template(m);
    if (template !== null) return { length: m[0].length, template };
  }
  return null;
}

/** How many shortcut rules there are (shown in the help panel). */
export const RULE_COUNT = RULES.length + 1;

// ---------------------------------------------------------------------------
// Fractions: "x^2/" → \frac{x^2}{▮}, "(a+b)/" → \frac{a+b}{▮}, "/" → \frac{▮}{}

const OPEN: Record<string, string> = { ')': '(', '}': '{', ']': '[' };

function fraction(before: string): Expansion {
  const body = before.slice(0, -1);
  const start = termStart(body);
  let term = body.slice(start);
  // A single parenthesised group loses its parentheses: (a+b)/ → \frac{a+b}{}
  if (term.startsWith('(') && term.endsWith(')') && matchingOpen(term, term.length - 1) === 0) {
    term = term.slice(1, -1);
  }
  const template = term ? `\\frac{${term}}{$1}$0` : '\\frac{$1}{$2}$0';
  return { length: body.length - start + 1, template };
}

/** Walk backwards over the "term" that ends at the cursor. */
function termStart(s: string): number {
  let i = s.length;
  while (i > 0) {
    const c = s[i - 1];
    if (c in OPEN) {
      const open = matchingOpen(s, i - 1);
      if (open < 0) break;
      i = open;
    } else if (/[A-Za-z]/.test(c)) {
      while (i > 0 && /[A-Za-z]/.test(s[i - 1])) i--;
      if (s[i - 1] === '\\') i--;
    } else if (/[0-9.^_']/.test(c)) {
      i--;
    } else {
      break;
    }
  }
  return i;
}

function matchingOpen(s: string, closeIndex: number): number {
  const close = s[closeIndex];
  const open = OPEN[close];
  let depth = 0;
  for (let j = closeIndex; j >= 0; j--) {
    if (s[j] === close) depth++;
    else if (s[j] === open && --depth === 0) return j;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Templates

export interface ParsedTemplate {
  text: string;
  /** Stops in the order Tab visits them ($1, $2, …, then $0). Offsets are into `text`. */
  stops: { from: number; to: number }[];
}

export function parseTemplate(template: string): ParsedTemplate {
  let text = '';
  const found: { n: number; from: number; to: number }[] = [];
  for (let i = 0; i < template.length; i++) {
    const c = template[i];
    const next = template[i + 1];
    // "$" followed by a digit or "{digit" is a stop; any other "$" is literal.
    if (c === '$' && next !== undefined && /[0-9]/.test(next)) {
      found.push({ n: Number(next), from: text.length, to: text.length });
      i++;
    } else if (c === '$' && next === '{') {
      const close = template.indexOf('}', i);
      const [n, ...rest] = template.slice(i + 2, close).split(':');
      const placeholder = rest.join(':');
      found.push({ n: Number(n), from: text.length, to: text.length + placeholder.length });
      text += placeholder;
      i = close;
    } else {
      text += c;
    }
  }
  found.sort((a, b) => (a.n === 0 ? 1 : b.n === 0 ? -1 : a.n - b.n));
  return { text, stops: found.map(({ from, to }) => ({ from, to })) };
}
