# Note taker

Keyboard-first maths notes for undergraduates. Type Markdown with `$math$`, and short commands turn into clean figures and maths blocks:

```
/plot sin x, cos x from -pi to pi
  + tangent at 0
  + shade 0..pi/2

/triangle ABC
  + altitude from A
  + circumcircle

/rowops 1 2 | 5
  + 3 4 | 6
  + R2 - 3R1
```

There are **100 commands** covering calculus, multivariable calculus and 3D, linear algebra, differential equations, proofs and discrete maths, abstract algebra, probability and statistics, complex analysis, geometry, topology, number theory and numerical methods. See **[COMMANDS.md](COMMANDS.md)** for all of them, or open **`/gallery`** in the app to see each one drawn.

Typos are fine (`/trinagle ABC rigth at C` still works), and nothing waits on the network.

This is a **prototype**. It exists to test two questions:
1. Can students draw blackboard figures from keyboard commands fast enough during a lecture?
2. Does typo tolerance feel instant (no waiting, no popups)?

The hidden page **`/stats`** shows what the local usage log says about both.

## Using it

- **Left:** the editor. **Right:** the rendered note. Click a block on the right to jump to it.
- Notes save automatically in your browser (localStorage). **Cmd/Ctrl+S** downloads the note as `.md`. **Open** loads a `.md` file.
- Figures have a **Download SVG** button; maths blocks have **Copy LaTeX** (hover over them).
- **Ctrl+/** opens the cheat sheet (with a filter box). **`/gallery`** shows every command.

### Figures and blocks

- A line starting with `/` is a figure. Details go on `+` lines below it (**Shift+Enter** starts one), or on the same line after `;`. Both mean the same.
- Typo tolerance is deterministic (no AI): edit distance on command names, a synonym table (`/graph` → `/plot`, `/cylinder` → `/solid cylinder`, `/normal` → `/dist normal`, …), unique prefixes, and the same forgiveness for keywords and function names (`rigth`, `form`, `sni`). Ambiguous guesses are refused. If a command can't be read, a one-line hint appears once you move off it. Never a popup.
- 3D figures use the simple “cabinet” projection from textbooks: hidden edges dashed, surfaces painted back to front.

### The Compute switch

Off by default. When it is on, commands that have an answer (determinants, inverses, the next row operation, eigenvalues, solutions of systems, truth tables, group tables, permutations, Euclid's algorithm, probabilities, LP optima, parallel-line angles) show it as **faint suggested `+` lines** under the command. **Tab** accepts, **Esc** hides. The app never writes an answer into your note by itself, and figures only draw what is in the text.

### Equation shortcuts (inside `$…$`)

Following Obsidian Latex Suite: `x/` → `\frac{x}{}`, `@a` → `\alpha`, `xbar` → `\bar{x}`, `sqrt`, `int`, `sum`, `lim`, `par` (∂), `grad`, `mat`/`cases`/`align` (Tab = next column, Enter = next row), `Ainv` → `A^{-1}`, `norm`, `binom`, `sub` (⊆), `cup`, `===` (≡), `|->` (↦), `EV` (𝔼), and more. **Tab** jumps to the next box, then out of the bracket, then out of the math. `mk` and `dm` start inline and display math. Undo right after an expansion gives back what you typed. Shortcuts don't fire inside `\text{…}`. The full list is in the cheat sheet.

## Running it locally

Needs Node 22 (see `.node-version`).

```bash
npm install
npm run dev
```

Then open http://localhost:5173. Other scripts:

- `npm test` runs the unit tests (every command's example, answers such as determinants and probabilities, shortcuts, typo matching)
- `npm run build` type-checks and builds the static site into `dist/`
- `npm run preview` serves the built site
- `npm run docs` regenerates `COMMANDS.md` from the code (a test fails if it is out of date)

## Putting it online (GitHub + Cloudflare Pages)

1. Create an empty repository on GitHub (for example `note-taker`), then push:

   ```bash
   git remote add origin https://github.com/YOUR-USERNAME/note-taker.git
   git push -u origin main
   ```

2. In the Cloudflare dashboard go to **Workers & Pages → Create → Pages → Connect to Git**, pick the repository, and use:
   - Framework preset: **Vite** (or None)
   - Build command: `npm run build`
   - Build output directory: `dist`

   The Node version comes from `.node-version`. There are no environment variables or secrets.

3. Every push to `main` redeploys. `public/_redirects` makes `/stats` and `/gallery` work on Pages.

If Cloudflare created a **Worker** instead of a Pages project (its build log ends with `npx wrangler deploy`), that works too: `wrangler.jsonc` tells it to upload `dist/` as a static site, with unknown paths like `/stats` served by `index.html`. Keep the build command `npm run build` and the deploy command `npx wrangler deploy`.

## How the code is laid out

```
src/
  main.ts            picks the page: notes, /stats or /gallery
  notesApp.ts        the main screen: toolbar, editor, preview, saving, Compute switch
  editor.ts          CodeMirror setup and highlighting of math / figure lines
  markdown.ts        tiny Markdown reader + KaTeX rendering
  preview.ts         the right-hand side; re-renders only changed blocks
  figureBlocks.ts    finds a figure and its "+" lines in the editor
  suggestions.ts     Compute switch, ghost suggestions, Tab to accept, Shift+Enter
  snippets.ts        equation shortcut rules (pure, unit-tested)
  shortcuts.ts       connects the rules to the editor: Tab, Enter, undo
  fuzzy.ts           edit distance and "closest word"
  figureHints.ts     the quiet hints at the end of figure lines
  usageLog.ts / logStore.ts / stats.ts     usage log and the /stats page
  cheatSheet.ts / gallery.ts               the Ctrl+/ panel and the /gallery page
  figures/
    index.ts         command lookup (typos, synonyms), running, suggestions
    registry.ts      the list of all commands
    types.ts         what a command looks like (draw, and optional suggest)
    expr.ts          formula reader → syntax tree → real or complex functions (no eval)
    args.ts range.ts helpers for reading arguments
    svg.ts           hand-written SVG helpers: axes, ticks, contours, region filling
    three.ts         the simple 3D (cabinet projection) kit
    geo2d.ts         plane geometry helpers (intersections, centres, angle marks)
    rational.ts      exact fractions, matrices, row operations
    graphs.ts curves.ts signchart.ts regions.ts multivar.ts linalg.ts diffeq.ts
    discrete.ts algebra.ts probability.ts complexan.ts geometry.ts triangle.ts
    misc.ts blocks.ts plane.ts interval.ts diagram.ts     the commands, by subject
    element.ts       a figure (Download SVG) or block (Copy LaTeX) in the preview
tests/               vitest unit tests
```

Out of scope for this prototype: accounts, sync, collaboration, OCR, mobile, AI, any backend.
