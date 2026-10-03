// The note a first-time visitor sees. It doubles as a quick tour.

export const WELCOME_NOTE = `# Welcome to Note taker

Type on the left, read on the right. Everything saves in this browser as you type. **Cmd/Ctrl+S** downloads the note as Markdown, and **Ctrl+/** opens the cheat sheet with every command.

## Math
Inline math goes between dollars: $e^{i\\pi} + 1 = 0$. Display math uses double dollars:

$$
\\int_0^1 x^2 \\,dx = \\frac{1}{3}
$$

Try it: on a new line type \`mk\`, then \`x/2\`, press Tab, then \`@a\`. Shortcuts only fire inside math.

## Figures
A line that starts with / draws a figure. Details go on "+" lines below it (Shift+Enter starts one). Typos are fine.

/plot sin x, cos x from -pi to pi
  + tangent at 0
  + shade 0..pi/2

/trinagle ABC rigth at C
  + altitude from C
  + circumcircle

/surface z = x^2 - y^2

/venn A ∩ B'

## Blocks and answers
Some commands write maths for you to fill in. Switch **Compute** on in the top bar, put the cursor in the block below, and the next row operation appears as a faint suggestion: press Tab to accept it.

/rowops 1 2 | 5
  + 3 4 | 6

/thm [Intermediate value] If f is continuous on [a, b] and y lies between f(a) and f(b), then f(c) = y for some c in [a, b].
`;
